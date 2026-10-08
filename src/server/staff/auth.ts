import "server-only";
import { and, count, eq, or } from "drizzle-orm";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { audit } from "../audit";
import { checkCode, issueCode } from "../auth/codes";
import { timingSafeEqual } from "node:crypto";
import { hashPassword, passwordProblem, sha256, verifyPassword } from "../auth/crypto";
import { createSession, destroyAllSessions, destroyCurrentSession, requestOrigin } from "../auth/sessions";
import { getDb } from "../db";
import { roles, staffUsers, staffUserStores, stores } from "../db/schema";
import { AppError } from "../errors";
import { devOnly, sendMessage } from "../messaging";
import { loadStaff } from "./access";

/**
 * EN: Staff sign-in (design "Gestão · 0 Entrar"): username, e-mail or WhatsApp number + password.
 *     No public sign-up; accounts are created in "Utilizadores internos" with a temporary password that must be
 *     changed on first sign-in. 5 wrong passwords lock the account for 15 minutes. Everything goes to the audit log.
 * PT: Entrada da equipa: utilizador, e-mail ou WhatsApp + palavra-passe. Sem registo público; as contas são criadas
 *     na gestão com palavra-passe temporária, trocada no primeiro acesso. 5 falhas bloqueiam 15 minutos.
 */

type StaffRow = typeof staffUsers.$inferSelect;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

async function findStaff(identifier: string): Promise<StaffRow | null> {
  const db = await getDb();
  const v = identifier.trim().toLowerCase();
  const phone = normalizeMsisdn(v);
  const [row] = await db
    .select()
    .from(staffUsers)
    .where(or(eq(staffUsers.username, v), eq(staffUsers.email, v), phone ? eq(staffUsers.phone, phone) : undefined))
    .limit(1);
  return row ?? null;
}

async function roleName(row: StaffRow) {
  const db = await getDb();
  const [r] = await db.select().from(roles).where(eq(roles.id, row.roleId));
  return r?.name.pt ?? null;
}

export async function loginStaff(identifier: string, password: string): Promise<{ mustChange: boolean; roleKey: string }> {
  const db = await getDb();
  const { label: origin } = await requestOrigin();
  const row = await findStaff(identifier);
  const who = (r: StaffRow | null) => ({ type: "staff" as const, id: r?.id, name: r?.username ?? identifier.slice(0, 40), role: null });

  if (!row) {
    await audit({ actor: who(null), action: "Login falhado", detail: "Utilizador desconhecido", origin, result: "warning" });
    throw new AppError("UNAUTHORIZED", "INVALID_CREDENTIALS", 401);
  }
  if (row.lockedUntil && row.lockedUntil > new Date()) {
    await audit({ actor: who(row), action: "Tentativa com conta bloqueada", origin, result: "blocked" });
    throw new AppError("LOCKED", "LOCKED", 423);
  }
  if (row.status === "suspended") {
    await audit({ actor: who(row), action: "Tentativa com conta suspensa", origin, result: "blocked" });
    throw new AppError("UNAUTHORIZED", "SUSPENDED", 401);
  }
  if (!(await verifyPassword(password, row.passwordHash))) {
    const fails = row.failedAttempts + 1;
    const locked = fails >= MAX_FAILS;
    await db
      .update(staffUsers)
      .set({ failedAttempts: locked ? 0 : fails, lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null })
      .where(eq(staffUsers.id, row.id));
    await audit({
      actor: who(row),
      action: locked ? "Conta bloqueada 15 min" : `Login falhado (${fails}.ª tentativa)`,
      detail: locked ? `${MAX_FAILS} tentativas falhadas` : "Palavra-passe errada",
      origin,
      result: locked ? "blocked" : "warning",
    });
    throw new AppError(locked ? "LOCKED" : "UNAUTHORIZED", locked ? "LOCKED" : "INVALID_CREDENTIALS", locked ? 423 : 401);
  }

  await db.update(staffUsers).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(staffUsers.id, row.id));
  await createSession("staff", row.id);
  const ctx = await loadStaff(row.id);
  await audit({ actor: { type: "staff", id: row.id, name: row.name, role: ctx?.roleName }, action: "Entrada na gestão", origin });
  return { mustChange: row.status === "temp_password", roleKey: ctx?.roleKey ?? "atendedor" };
}

export async function logoutStaff(staff: { id: string; name: string; roleName: string } | null) {
  if (staff) {
    const { label } = await requestOrigin();
    await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Saída da gestão", origin: label });
  }
  await destroyCurrentSession("staff");
}

/** EN: "Recuperar a palavra-passe": neutral answer, code by WhatsApp or e-mail (30 min). PT: Resposta neutra. */
export async function requestStaffReset(identifier: string, channel: "whatsapp" | "email") {
  const row = await findStaff(identifier);
  const target = row ? (channel === "email" ? row.email : row.phone) : null;
  if (!row || !target) return { sent: true };
  const code = await issueCode({ subjectType: "staff", subjectId: row.id, purpose: "password_reset", channel, target: row.id });
  await sendMessage(channel, target, `Eterna Gestão: código para nova palavra-passe: ${code}. Vale 30 minutos.`);
  const { label } = await requestOrigin();
  await audit({
    actor: { type: "staff", id: row.id, name: row.name, role: await roleName(row) },
    action: "Recuperação de palavra-passe",
    detail: `Enviada por ${channel === "email" ? "e-mail" : "WhatsApp"}`,
    origin: label,
  });
  return { sent: true, devCode: devOnly(code) };
}

function checkNewPassword(password: string, repeat: string) {
  if (password !== repeat) throw new AppError("VALIDATION_ERROR", "PASSWORDS_DIFFER", 400);
  const problem = passwordProblem(password);
  if (problem) throw new AppError("VALIDATION_ERROR", problem === "too_short" ? "PASSWORD_TOO_SHORT" : "PASSWORD_TOO_COMMON", 400);
}

export async function resetStaffPassword(input: { identifier: string; code: string; password: string; repeat: string }) {
  checkNewPassword(input.password, input.repeat);
  const row = await findStaff(input.identifier);
  if (!row) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);
  const result = await checkCode({ subjectType: "staff", purpose: "password_reset", target: row.id, code: input.code, consume: true });
  if (!result.ok) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);
  await setStaffPassword(row.id, input.password);
  await destroyAllSessions("staff", row.id);
  return loginStaff(input.identifier, input.password);
}

/** EN: First sign-in: the temporary password is replaced. PT: Primeiro acesso: troca a temporária. */
export async function changeStaffPassword(staffId: string, input: { current: string; password: string; repeat: string }) {
  checkNewPassword(input.password, input.repeat);
  const db = await getDb();
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId));
  if (!row || !(await verifyPassword(input.current, row.passwordHash))) throw new AppError("UNAUTHORIZED", "INVALID_CREDENTIALS", 401);
  await setStaffPassword(staffId, input.password);
  await audit({ actor: { type: "staff", id: row.id, name: row.name, role: await roleName(row) }, action: "Palavra-passe definida" });
}

async function setStaffPassword(staffId: string, password: string) {
  const db = await getDb();
  await db
    .update(staffUsers)
    .set({ passwordHash: await hashPassword(password), status: "active", failedAttempts: 0, lockedUntil: null })
    .where(and(eq(staffUsers.id, staffId)));
}

// ── First Superadministrador / Primeiro Superadministrador ────────────

/** EN: True while no real (non-demo) Superadministrador exists. PT: Enquanto não houver Superadministrador real. */
export async function needsFirstAdmin(): Promise<boolean> {
  const db = await getDb();
  const [superRole] = await db.select().from(roles).where(eq(roles.key, "super"));
  if (!superRole) return false;
  const [{ value }] = await db
    .select({ value: count() })
    .from(staffUsers)
    .where(and(eq(staffUsers.roleId, superRole.id), eq(staffUsers.isDemo, false)));
  return value === 0;
}

/**
 * EN: Installation code for the first sign-up. Online (production) it is REQUIRED: set ADMIN_SETUP_CODE in Vercel,
 *     otherwise nobody can create the Superadministrador. Locally it is optional.
 * PT: Código de instalação do primeiro acesso. Online (produção) é OBRIGATÓRIO: definir ADMIN_SETUP_CODE na Vercel,
 *     senão ninguém consegue criar o Superadministrador. Em local é opcional.
 */
export function setupCodeRequired(): boolean {
  return !!process.env.ADMIN_SETUP_CODE || process.env.NODE_ENV === "production";
}

function checkSetupCode(given: string) {
  const expected = process.env.ADMIN_SETUP_CODE;
  if (!expected) {
    if (process.env.NODE_ENV === "production") throw new AppError("FORBIDDEN", "SETUP_CODE_MISSING", 403);
    return;
  }
  const a = Buffer.from(sha256(given.trim()));
  const b = Buffer.from(sha256(expected.trim()));
  if (!timingSafeEqual(a, b)) throw new AppError("FORBIDDEN", "INVALID_SETUP_CODE", 403);
}

export async function createFirstAdmin(input: { name: string; username: string; phone: string; email?: string; password: string; repeat: string; setupCode: string }) {
  if (!(await needsFirstAdmin())) throw new AppError("FORBIDDEN", "ALREADY_SET_UP", 403);
  try {
    checkSetupCode(input.setupCode);
  } catch (e) {
    const { label } = await requestOrigin();
    await audit({ actor: { type: "system", name: input.username.slice(0, 40) }, action: "Primeiro acesso recusado", detail: "Código de instalação errado ou em falta", origin: label, result: "blocked" });
    throw e;
  }
  checkNewPassword(input.password, input.repeat);
  const db = await getDb();
  const [superRole] = await db.select().from(roles).where(eq(roles.key, "super"));
  const [row] = await db
    .insert(staffUsers)
    .values({
      name: input.name,
      username: input.username.toLowerCase(),
      phone: input.phone,
      email: input.email?.toLowerCase() || null,
      roleId: superRole.id,
      status: "active",
      passwordHash: await hashPassword(input.password),
    })
    .returning();
  const allStores = await db.select({ id: stores.id }).from(stores);
  if (allStores.length) await db.insert(staffUserStores).values(allStores.map((s) => ({ staffUserId: row.id, storeId: s.id })));
  await audit({ actor: { type: "staff", id: row.id, name: row.name, role: "Superadministrador" }, action: "Primeiro acesso configurado" });
  return loginStaff(input.username, input.password);
}
