import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { settings } from "./db/schema";

/**
 * EN: Key/value settings stored in the database (editable in the back-office).
 * PT: Definições chave/valor guardadas na base de dados (editáveis na gestão).
 */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (row?.value === undefined || row.value === null) return fallback;
  // EN: Objects are merged with the default so new fields appear. PT: Objectos juntam-se ao valor por omissão.
  if (typeof fallback === "object" && fallback && !Array.isArray(fallback)) return { ...fallback, ...(row.value as object) } as T;
  return row.value as T;
}

export async function setSetting(key: string, value: unknown, staffUserId?: string | null): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value, updatedById: staffUserId ?? null })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), updatedById: staffUserId ?? null } });
}

/** EN: Atomic counter (e.g. fitting codes PR-0042). PT: Contador atómico (ex.: códigos PR-0042). */
export async function nextCounter(key: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .insert(settings)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`to_jsonb((${settings.value})::text::int + 1)` } })
    .returning({ value: settings.value });
  return Number(row.value);
}
