import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { whatsappLink } from "@/data/site";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { audit } from "../audit";
import { hashPassword, temporaryPassword } from "../auth/crypto";
import { destroyAllSessions } from "../auth/sessions";
import { getDb } from "../db";
import { roles, staffUsers, staffUserStores, stores } from "../db/schema";
import { AppError } from "../errors";
import { sendMessage } from "../messaging";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · A1 Utilizadores internos". Rules from the design:
 *     - Superadministrador creates any role; Administrador creates Gestor, Atendedor, Entregador;
 *       Gestor creates Atendedor and Entregador for their own stores only.
 *     - Nobody manages someone of a higher or equal level (except the Superadministrador). Only the
 *       Superadministrador deletes. New accounts get a temporary password that must be changed on first sign-in.
 * PT: Regras do design: quem cria quem, ninguém gere nível igual ou superior (excepto o Superadministrador),
 *     só o Superadministrador apaga, contas novas com palavra-passe temporária.
 */

export type RoleKey = "super" | "admin" | "gestor" | "atendedor" | "entregador";
export const CAN_CREATE: Record<string, RoleKey[]> = {
  super: ["super", "admin", "gestor", "atendedor", "entregador"],
  admin: ["gestor", "atendedor", "entregador"],
  gestor: ["atendedor", "entregador"],
};

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function listStaffFor(me: StaffContext) {
  const db = await getDb();
  const rows = await db
    .select({ user: staffUsers, role: roles })
    .from(staffUsers)
    .innerJoin(roles, eq(staffUsers.roleId, roles.id))
    .orderBy(desc(roles.level), asc(staffUsers.name));
  const links = rows.length ? await db.select().from(staffUserStores).where(inArray(staffUserStores.staffUserId, rows.map((r) => r.user.id))) : [];
  const storeRows = await db.select().from(stores);
  return rows
    .map((r) => {
      const storeIds = links.filter((l) => l.staffUserId === r.user.id).map((l) => l.storeId);
      return { ...r.user, roleKey: r.role.key as RoleKey, roleName: r.role.name.pt, level: r.role.level, storeIds, storeCodes: storeRows.filter((s) => storeIds.includes(s.id)).map((s) => s.code).sort() };
    })
    .filter((u) => {
      if (me.roleKey === "super" || me.roleKey === "admin") return true;
      // EN: Store managers see themselves and their stores' assistants and drivers. PT: Gestoras vêem-se a si e às suas equipas.
      return u.id === me.id || (u.level < me.level && u.storeIds.some((id) => me.storeIds.includes(id)));
    });
}

type StaffRow = Awaited<ReturnType<typeof listStaffFor>>[number];

export function canManage(me: StaffContext, u: Pick<StaffRow, "id" | "level" | "storeIds">): boolean {
  if (me.roleKey === "super") return true;
  if (u.id === me.id || u.level >= me.level) return false;
  return me.roleKey === "admin" || u.storeIds.some((id) => me.storeIds.includes(id));
}

async function loadManageable(me: StaffContext, id: string): Promise<StaffRow> {
  const u = (await listStaffFor(me)).find((x) => x.id === id);
  if (!u || !canManage(me, u)) throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  return u;
}

function welcomeMessage(name: string, roleName: string, username: string, password: string) {
  return `Olá, ${name}. Foi criada a sua conta na gestão da Eterna (${roleName}).\nUtilizador: ${username}\nPalavra-passe temporária: ${password}\nEntre em eterna.co.mz/gestao e defina a sua palavra-passe.`;
}

export interface StaffInput {
  name: string;
  username: string;
  phone: string;
  email?: string;
  role: RoleKey;
  storeCodes: string[];
  vehicleType?: string;
  vehiclePlate?: string;
  sendWhatsapp: boolean;
  sendEmail: boolean;
}

/** EN: Returns the temporary password ONCE, to show and send. PT: Devolve a palavra-passe temporária UMA vez. */
export async function createStaff(me: StaffContext, input: StaffInput) {
  if (!(CAN_CREATE[me.roleKey] ?? []).includes(input.role)) throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const phone = normalizeMsisdn(input.phone);
  if (!phone) throw new AppError("VALIDATION_ERROR", "Número de WhatsApp inválido.", 400);
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new AppError("VALIDATION_ERROR", "Nome de utilizador: 3 a 30 letras, números, ponto ou hífen.", 400);
  if (input.name.trim().length < 2) throw new AppError("VALIDATION_ERROR", "Escreva o nome completo.", 400);

  const db = await getDb();
  const storeRows = await db.select().from(stores);
  const storeIds = storeRows.filter((s) => input.storeCodes.includes(s.code)).map((s) => s.id);
  if (me.roleKey === "gestor" && (!storeIds.length || storeIds.some((id) => !me.storeIds.includes(id)))) {
    throw new AppError("FORBIDDEN", "Só pode criar pessoas para as suas lojas.", 403);
  }
  const [role] = await db.select().from(roles).where(eq(roles.key, input.role));
  const existing = await db.select({ username: staffUsers.username, phone: staffUsers.phone, email: staffUsers.email }).from(staffUsers);
  if (existing.some((e) => e.username === username)) throw new AppError("CONFLICT", "Esse nome de utilizador já existe.", 409);
  if (existing.some((e) => e.phone === phone)) throw new AppError("CONFLICT", "Esse número já pertence a outra pessoa da equipa.", 409);
  const email = input.email?.trim().toLowerCase() || null;
  if (email && existing.some((e) => e.email === email)) throw new AppError("CONFLICT", "Esse e-mail já pertence a outra pessoa da equipa.", 409);

  const password = temporaryPassword();
  const [row] = await db
    .insert(staffUsers)
    .values({
      name: input.name.trim(),
      username,
      phone,
      email,
      roleId: role.id,
      status: "temp_password",
      passwordHash: await hashPassword(password),
      vehicleType: input.role === "entregador" ? input.vehicleType || null : null,
      vehiclePlate: input.role === "entregador" ? input.vehiclePlate || null : null,
      createdById: me.id,
    })
    .returning();
  if (storeIds.length) await db.insert(staffUserStores).values(storeIds.map((storeId) => ({ staffUserId: row.id, storeId })));

  const message = welcomeMessage(row.name, role.name.pt, username, password);
  if (input.sendWhatsapp) await sendMessage("whatsapp", phone, message);
  if (input.sendEmail && email) await sendMessage("email", email, message);
  await audit({ actor: actor(me), action: "Utilizador criado", detail: `${row.name} · ${role.name.pt}` });
  return { id: row.id, password, message, whatsappUrl: whatsappLink(message, `258${phone}`) };
}

export async function setSuspended(me: StaffContext, id: string, suspended: boolean) {
  const u = await loadManageable(me, id);
  const db = await getDb();
  await db
    .update(staffUsers)
    .set({ status: suspended ? "suspended" : u.passwordHash ? "active" : "temp_password" })
    .where(eq(staffUsers.id, id));
  if (suspended) await destroyAllSessions("staff", id);
  await audit({ actor: actor(me), action: suspended ? "Utilizador suspenso" : "Utilizador reactivado", detail: u.name });
}

export async function newTemporaryPassword(me: StaffContext, id: string) {
  const u = await loadManageable(me, id);
  const password = temporaryPassword();
  const db = await getDb();
  await db.update(staffUsers).set({ passwordHash: await hashPassword(password), status: "temp_password", failedAttempts: 0, lockedUntil: null }).where(eq(staffUsers.id, id));
  await destroyAllSessions("staff", id);
  const message = `Olá, ${u.name}. A sua nova palavra-passe temporária da gestão Eterna é ${password}. Entre em eterna.co.mz/gestao e defina uma nova.`;
  if (u.phone) await sendMessage("whatsapp", u.phone, message);
  await audit({ actor: actor(me), action: "Nova palavra-passe temporária", detail: u.name });
  return { password, whatsappUrl: u.phone ? whatsappLink(message, `258${u.phone}`) : null };
}

export async function endSessions(me: StaffContext, id: string) {
  const u = await loadManageable(me, id);
  await destroyAllSessions("staff", id);
  await audit({ actor: actor(me), action: "Sessões terminadas", detail: u.name });
}

export async function deleteStaff(me: StaffContext, id: string) {
  if (me.roleKey !== "super" || id === me.id) throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const db = await getDb();
  const [u] = await db.select().from(staffUsers).where(eq(staffUsers.id, id));
  if (!u) return;
  await db.delete(staffUsers).where(eq(staffUsers.id, id));
  await audit({ actor: actor(me), action: "Utilizador apagado", detail: u.name });
}

export async function updateStaff(me: StaffContext, id: string, input: { name: string; email: string; storeCodes: string[] }) {
  const u = await loadManageable(me, id);
  const db = await getDb();
  const storeRows = await db.select().from(stores);
  const storeIds = storeRows.filter((s) => input.storeCodes.includes(s.code)).map((s) => s.id);
  if (me.roleKey === "gestor" && storeIds.some((sid) => !me.storeIds.includes(sid))) throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  await db.transaction(async (tx) => {
    await tx.update(staffUsers).set({ name: input.name.trim() || u.name, email: input.email.trim().toLowerCase() || null }).where(eq(staffUsers.id, id));
    await tx.delete(staffUserStores).where(eq(staffUserStores.staffUserId, id));
    if (storeIds.length) await tx.insert(staffUserStores).values(storeIds.map((storeId) => ({ staffUserId: id, storeId })));
  });
  await audit({ actor: actor(me), action: "Utilizador editado", detail: `${u.name} · lojas ${input.storeCodes.join(", ") || "—"}` });
}
