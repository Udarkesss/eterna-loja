import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "../db";
import { sessions } from "../db/schema";
import { randomToken, sha256 } from "./crypto";

/**
 * EN: Cookie sessions for customers and staff (separate cookies, so a customer never reaches the back-office).
 *     The browser keeps a random token; the database keeps only its hash.
 *     The mobile app can send the same token as "Authorization: Bearer <token>".
 * PT: Sessões por cookie para clientes e equipa (cookies separados: uma cliente nunca chega à gestão).
 *     O browser guarda um token aleatório; a base de dados guarda só o hash.
 *     A app móvel pode enviar o mesmo token em "Authorization: Bearer <token>".
 */

export type SubjectType = "customer" | "staff";

const COOKIE: Record<SubjectType, string> = { customer: "eterna_session", staff: "eterna_staff" };
const DAYS: Record<SubjectType, number> = { customer: 60, staff: 1 }; // EN: staff: one working day. PT: equipa: um dia.

export async function requestOrigin(): Promise<{ userAgent: string | null; ip: string | null; label: string }> {
  const h = await headers();
  const userAgent = h.get("user-agent");
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const device = /mobile|android|iphone/i.test(userAgent ?? "") ? "Telemóvel" : "Computador";
  const maskedIp = ip ? ip.replace(/^(\d+)\..*$/, "$1.xxx").replace(/^::1$/, "local") : "local";
  return { userAgent, ip, label: `${device} · ${maskedIp}` };
}

export async function createSession(subjectType: SubjectType, subjectId: string): Promise<string> {
  const db = await getDb();
  const token = randomToken();
  const { userAgent, ip } = await requestOrigin();
  const expiresAt = new Date(Date.now() + DAYS[subjectType] * 86_400_000);
  await db.insert(sessions).values({ subjectType, subjectId, tokenHash: sha256(token), userAgent, ip, expiresAt });
  // EN: Clean old sessions now and then. PT: Limpar sessões antigas de vez em quando.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  const jar = await cookies();
  jar.set(COOKIE[subjectType], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

/** EN: Returns the subject id of the current session, or null. PT: Devolve o id do sujeito da sessão, ou null. */
export async function currentSubjectId(subjectType: SubjectType): Promise<string | null> {
  const jar = await cookies();
  let token = jar.get(COOKIE[subjectType])?.value;
  if (!token) {
    const auth = (await headers()).get("authorization");
    if (auth?.startsWith("Bearer ")) token = auth.slice(7);
  }
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ subjectId: sessions.subjectId })
    .from(sessions)
    .where(
      and(eq(sessions.tokenHash, sha256(token)), eq(sessions.subjectType, subjectType), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);
  return row?.subjectId ?? null;
}

export async function destroyCurrentSession(subjectType: SubjectType): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE[subjectType])?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(COOKIE[subjectType]);
}

/** EN: "Terminar sessões" in Gestão · A1. PT: Termina todas as sessões de alguém. */
export async function destroyAllSessions(subjectType: SubjectType, subjectId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(and(eq(sessions.subjectType, subjectType), eq(sessions.subjectId, subjectId)));
}
