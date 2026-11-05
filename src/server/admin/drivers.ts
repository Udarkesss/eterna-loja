import "server-only";
import { and, count, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { site, whatsappLink } from "@/data/site";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { audit } from "../audit";
import { checkCode, issueCode } from "../auth/codes";
import { hashPassword, passwordProblem, randomToken, sha256 } from "../auth/crypto";
import { createSession, destroyAllSessions } from "../auth/sessions";
import { getDb } from "../db";
import { orders, roles, staffUsers, staffUserStores, stores } from "../db/schema";
import { AppError } from "../errors";
import { devOnly, sendMessage } from "../messaging";
import { getSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Entregas · Entregadores" of design V3-G-Entregadores and the driver's invitation (V3-E-Convite, V3-E-Primeiro-
 *     Acesso): the team gets a WhatsApp link valid 48 hours, confirms the details, confirms the number with a 6-digit
 *     code and creates the password. Drivers only enter the driver app.
 * PT: Entregadores do V3 e o convite do entregador: a pessoa recebe um link de WhatsApp válido 48 horas, confirma os
 *     dados, confirma o número com um código de 6 dígitos e cria a palavra-passe. Entra só na app do entregador.
 */

const INVITE_MS = 48 * 3600_000;
const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export interface DriverRow {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  plate: string | null;
  commissionPct: number | null;
  store: string | null;
  monthDeliveries: number;
  state: "active" | "suspended" | "invited" | "expired";
}

async function driverRole() {
  const db = await getDb();
  const [role] = await db.select().from(roles).where(eq(roles.key, "entregador"));
  if (!role) throw new AppError("NOT_FOUND", "Papel de entregador em falta.", 404);
  return role;
}

export async function listDrivers(): Promise<{ drivers: DriverRow[]; general: number }> {
  const db = await getDb();
  const role = await driverRole();
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.roleId, role.id));
  const ids = rows.map((r) => r.id);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [done, links, storeRows, general] = await Promise.all([
    ids.length
      ? db
          .select({ id: orders.driverId, n: count() })
          .from(orders)
          .where(and(inArray(orders.driverId, ids), isNotNull(orders.deliveredAt), gte(orders.deliveredAt, start)))
          .groupBy(orders.driverId)
      : [],
    ids.length ? db.select().from(staffUserStores).where(inArray(staffUserStores.staffUserId, ids)) : [],
    db.select().from(stores),
    getSetting<number>("delivery.commissionPct", 70),
  ]);
  const drivers = rows
    .map((r): DriverRow => {
      const link = links.find((l) => l.staffUserId === r.id);
      const st = storeRows.find((s) => s.id === link?.storeId);
      const invited = !r.passwordHash && !!r.inviteTokenHash;
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        vehicle: r.vehicleType,
        plate: r.vehiclePlate,
        commissionPct: r.commissionPct,
        store: st ? `Loja ${Number(st.code)}` : null,
        monthDeliveries: Number(done.find((d) => d.id === r.id)?.n ?? 0),
        state: r.status === "suspended" ? "suspended" : invited ? (r.inviteExpiresAt && r.inviteExpiresAt > new Date() ? "invited" : "expired") : "active",
      };
    })
    .sort((a, b) => Number(a.state !== "active") - Number(b.state !== "active") || b.monthDeliveries - a.monthDeliveries || a.name.localeCompare(b.name, "pt"));
  return { drivers, general };
}

export interface InviteInput {
  name: string;
  phone: string;
  vehicle: "Mota" | "Carro" | "Bicicleta";
  plate: string;
  commissionPct: number | null;
  storeCode: string;
}

function inviteMessage(token: string) {
  return `Eterna: foi convidado para a equipa de entregas. Abra o link para aceitar (válido 48 horas): ${site.url}/gestao/convite/${token}`;
}

async function issueInvite(id: string) {
  const token = randomToken(24);
  const db = await getDb();
  await db.update(staffUsers).set({ inviteTokenHash: sha256(token), inviteExpiresAt: new Date(Date.now() + INVITE_MS) }).where(eq(staffUsers.id, id));
  return token;
}

export async function inviteDriver(me: StaffContext, input: InviteInput) {
  const name = input.name.trim().slice(0, 80);
  const phone = normalizeMsisdn(input.phone);
  if (name.length < 2) throw new AppError("VALIDATION_ERROR", "Escreva o nome.", 400);
  if (!phone) throw new AppError("VALIDATION_ERROR", "Número de WhatsApp inválido (ex.: 84 000 0001).", 400);
  if (input.commissionPct !== null && (input.commissionPct < 0 || input.commissionPct > 100)) throw new AppError("VALIDATION_ERROR", "Comissão entre 0 e 100%.", 400);
  const db = await getDb();
  const [store] = await db.select().from(stores).where(eq(stores.code, input.storeCode));
  if (!store) throw new AppError("VALIDATION_ERROR", "Escolha a loja de partida.", 400);
  const [taken] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.phone, phone));
  if (taken) throw new AppError("CONFLICT", "Esse número já pertence a outra pessoa da equipa.", 409);
  const role = await driverRole();
  const [row] = await db
    .insert(staffUsers)
    .values({
      name,
      username: `entregador.${phone}`,
      phone,
      roleId: role.id,
      status: "temp_password",
      passwordHash: null,
      vehicleType: input.vehicle,
      vehiclePlate: input.plate.trim().slice(0, 20) || null,
      commissionPct: input.commissionPct,
      createdById: me.id,
    })
    .returning();
  await db.insert(staffUserStores).values({ staffUserId: row.id, storeId: store.id });
  const token = await issueInvite(row.id);
  const message = inviteMessage(token);
  await sendMessage("whatsapp", phone, message);
  await audit({ actor: actor(me), action: "Entregador convidado", detail: `${name} · ${input.vehicle}` });
  return { whatsappUrl: whatsappLink(message, `258${phone}`) };
}

async function driverById(id: string) {
  const db = await getDb();
  const role = await driverRole();
  const [row] = await db.select().from(staffUsers).where(and(eq(staffUsers.id, id), eq(staffUsers.roleId, role.id)));
  if (!row) throw new AppError("NOT_FOUND", "Entregador não encontrado.", 404);
  return row;
}

export async function resendInvite(me: StaffContext, id: string) {
  const row = await driverById(id);
  if (row.passwordHash) throw new AppError("CONFLICT", "Este entregador já activou a conta.", 409);
  const token = await issueInvite(row.id);
  const message = inviteMessage(token);
  if (row.phone) await sendMessage("whatsapp", row.phone, message);
  await audit({ actor: actor(me), action: "Convite de entregador reenviado", detail: row.name });
  return { whatsappUrl: row.phone ? whatsappLink(message, `258${row.phone}`) : null };
}

export async function setDriverActive(me: StaffContext, id: string, active: boolean) {
  const row = await driverById(id);
  const db = await getDb();
  await db
    .update(staffUsers)
    .set({ status: active ? (row.passwordHash ? "active" : "temp_password") : "suspended" })
    .where(eq(staffUsers.id, id));
  if (!active) await destroyAllSessions("staff", id);
  await audit({ actor: actor(me), action: active ? "Entregador activado" : "Entregador desactivado", detail: row.name });
}

// ── Public invitation / Convite (sem sessão) ──────────────────────────

async function byToken(token: string) {
  if (!token || token.length > 64) return null;
  const db = await getDb();
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.inviteTokenHash, sha256(token)));
  if (!row || row.passwordHash || row.status === "suspended" || !row.inviteExpiresAt || row.inviteExpiresAt < new Date()) return null;
  return row;
}

/** EN: What the invitation page shows. PT: O que a página do convite mostra. */
export async function invitationView(token: string) {
  const row = await byToken(token);
  if (!row) return null;
  const db = await getDb();
  const [link] = await db.select().from(staffUserStores).where(eq(staffUserStores.staffUserId, row.id));
  const [store] = link ? await db.select().from(stores).where(eq(stores.id, link.storeId)) : [];
  const [inviter] = row.createdById ? await db.select({ name: staffUsers.name }).from(staffUsers).where(eq(staffUsers.id, row.createdById)) : [];
  const general = await getSetting<number>("delivery.commissionPct", 70);
  return {
    name: row.name,
    inviter: inviter?.name ?? "A gestão",
    phone: row.phone ? `+258 ${row.phone.slice(0, 2)} ${row.phone.slice(2, 5)} ${row.phone.slice(5)}` : "",
    vehicle: row.vehicleType ?? "—",
    store: store ? `Loja ${Number(store.code)} · ${store.code === "22" ? "Eterna Bridal" : "Glória Mall"}` : "—",
    commission: row.commissionPct ?? general,
  };
}

/** EN: "Aceitar convite": sends the 6-digit code by WhatsApp. PT: Envia o código de 6 dígitos por WhatsApp. */
export async function acceptInvitation(token: string) {
  const row = await byToken(token);
  if (!row?.phone) throw new AppError("NOT_FOUND", "O convite expirou ou já foi usado. Peça um novo à gestão.", 404);
  const code = await issueCode({ subjectType: "staff", subjectId: row.id, purpose: "staff_invite", channel: "whatsapp", target: row.phone });
  await sendMessage("whatsapp", row.phone, `Eterna: o seu código de confirmação é ${code}.`);
  // EN: Demo mode shows the code on screen (messaging not live yet). PT: Em demonstração o código aparece no ecrã.
  return { code: devOnly(code) };
}

export async function checkInvitationCode(token: string, code: string) {
  const row = await byToken(token);
  if (!row?.phone) throw new AppError("NOT_FOUND", "O convite expirou ou já foi usado.", 404);
  const r = await checkCode({ subjectType: "staff", purpose: "staff_invite", target: row.phone, code, consume: false });
  if (!r.ok || r.subjectId !== row.id) throw new AppError("VALIDATION_ERROR", "Código errado ou expirado.", 400);
}

/** EN: "Activar e entrar": checks the code again, saves the password and signs in. PT: Guarda a palavra-passe e entra. */
export async function activateDriver(token: string, code: string, password: string, repeat: string) {
  const row = await byToken(token);
  if (!row?.phone) throw new AppError("NOT_FOUND", "O convite expirou ou já foi usado.", 404);
  if (password !== repeat) throw new AppError("VALIDATION_ERROR", "As duas palavras-passe não são iguais.", 400);
  const problem = passwordProblem(password);
  if (problem) throw new AppError("VALIDATION_ERROR", problem === "too_short" ? "Use pelo menos 10 caracteres." : "Escolha uma palavra-passe menos comum.", 400);
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) throw new AppError("VALIDATION_ERROR", "Use uma letra maiúscula e um número.", 400);
  const r = await checkCode({ subjectType: "staff", purpose: "staff_invite", target: row.phone, code, consume: true });
  if (!r.ok || r.subjectId !== row.id) throw new AppError("VALIDATION_ERROR", "Código errado ou expirado.", 400);
  const db = await getDb();
  await db
    .update(staffUsers)
    .set({ passwordHash: await hashPassword(password), status: "active", inviteTokenHash: null, inviteExpiresAt: null, failedAttempts: 0 })
    .where(eq(staffUsers.id, row.id));
  await createSession("staff", row.id);
  await audit({ actor: { type: "staff", id: row.id, name: row.name, role: "Entregador" }, action: "Convite aceite", detail: "Conta de entregador activada" });
}
