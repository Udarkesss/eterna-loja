import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { oneTimeCodes } from "../db/schema";
import { randomCode, sha256 } from "./crypto";

/**
 * EN: One-time codes (WhatsApp sign-up, password reset): 6 digits, valid 30 minutes, single use, 5 tries.
 * PT: Códigos de uso único (registo por WhatsApp, recuperação): 6 dígitos, 30 minutos, uma vez, 5 tentativas.
 */

type Purpose = "whatsapp_signup" | "password_reset" | "email_verify";
const VALID_MS = 30 * 60_000;
const MAX_ATTEMPTS = 5;

export async function issueCode(input: {
  subjectType: "customer" | "staff";
  subjectId?: string | null;
  purpose: Purpose;
  channel: "whatsapp" | "email";
  target: string;
}): Promise<string> {
  const db = await getDb();
  const code = randomCode();
  await db.insert(oneTimeCodes).values({
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    purpose: input.purpose,
    channel: input.channel,
    target: input.target,
    codeHash: sha256(`${input.target}:${code}`),
    expiresAt: new Date(Date.now() + VALID_MS),
  });
  return code;
}

/**
 * EN: Checks the latest code for this target. `consume` marks it used. Returns the stored subject id.
 * PT: Verifica o último código deste destino. `consume` marca-o como usado. Devolve o id guardado.
 */
export async function checkCode(input: {
  subjectType: "customer" | "staff";
  purpose: Purpose;
  target: string;
  code: string;
  consume: boolean;
}): Promise<{ ok: true; subjectId: string | null } | { ok: false }> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(oneTimeCodes)
    .where(
      and(
        eq(oneTimeCodes.subjectType, input.subjectType),
        eq(oneTimeCodes.purpose, input.purpose),
        eq(oneTimeCodes.target, input.target),
        isNull(oneTimeCodes.usedAt),
        gt(oneTimeCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(oneTimeCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) return { ok: false };

  if (row.codeHash !== sha256(`${input.target}:${input.code}`)) {
    await db.update(oneTimeCodes).set({ attempts: row.attempts + 1 }).where(eq(oneTimeCodes.id, row.id));
    return { ok: false };
  }
  if (input.consume) await db.update(oneTimeCodes).set({ usedAt: new Date() }).where(eq(oneTimeCodes.id, row.id));
  return { ok: true, subjectId: row.subjectId };
}
