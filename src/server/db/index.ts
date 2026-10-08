import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, type Database } from "./client";
import { ensureReferenceData, seedIfEmpty } from "./seed";

export type { Database };

/**
 * EN: One shared connection per server process (kept on globalThis to survive `next dev` reloads).
 *     In development (PGlite) the schema is migrated and seeded automatically on first use, and new migration files
 *     (npm run db:generate) are applied on the next request — no server restart needed.
 *     In production (DATABASE_URL) migrations run during deploy (scripts/db-deploy.ts).
 * PT: Uma ligação partilhada por processo. Em desenvolvimento (PGlite) o esquema é migrado e preenchido no primeiro
 *     uso, e as migrações novas são aplicadas no pedido seguinte — sem reiniciar o servidor.
 *     Em produção (DATABASE_URL) as migrações correm no deploy.
 */
const globalForDb = globalThis as {
  __eternaDb?: Promise<Database>;
  __eternaMigrate?: () => Promise<void>;
  __eternaMigrations?: number;
};

/** EN: Number of migrations in drizzle/meta/_journal.json. PT: Número de migrações no diário. */
function migrationCount(): number {
  try {
    const journal = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as { entries: unknown[] };
    return journal.entries.length;
  } catch {
    return 0;
  }
}

async function init(): Promise<Database> {
  const connection = createDatabase();
  if (connection.kind === "pglite") {
    await connection.migrate();
    globalForDb.__eternaMigrate = connection.migrate;
    globalForDb.__eternaMigrations = migrationCount();
    await seedIfEmpty(connection.db);
    await ensureReferenceData(connection.db);
  }
  return connection.db;
}

export async function getDb(): Promise<Database> {
  globalForDb.__eternaDb ??= init().catch((error) => {
    globalForDb.__eternaDb = undefined; // EN: allow a retry. PT: permitir nova tentativa.
    throw error;
  });
  const db = await globalForDb.__eternaDb;
  const migrate = globalForDb.__eternaMigrate;
  if (migrate && process.env.NODE_ENV !== "production") {
    const count = migrationCount();
    if (count !== globalForDb.__eternaMigrations) {
      globalForDb.__eternaMigrations = count;
      await migrate(); // EN: a new migration appeared. PT: apareceu uma migração nova.
      await ensureReferenceData(db);
    }
  }
  return db;
}
