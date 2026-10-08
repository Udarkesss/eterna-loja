import "server-only";
import { createDatabase, type Database } from "./client";
import { seedIfEmpty } from "./seed";

export type { Database };

/**
 * EN: One shared connection per server process (kept on globalThis to survive `next dev` reloads).
 *     In development (PGlite) the schema is migrated and seeded automatically on first use.
 *     In production (DATABASE_URL) run `npm run db:migrate` during deploy instead.
 * PT: Uma ligação partilhada por processo (guardada em globalThis para sobreviver aos recarregamentos do `next dev`).
 *     Em desenvolvimento (PGlite) o esquema é migrado e preenchido automaticamente no primeiro uso.
 *     Em produção (DATABASE_URL) correr `npm run db:migrate` no deploy.
 */
const globalForDb = globalThis as { __eternaDb?: Promise<Database> };

async function init(): Promise<Database> {
  const connection = createDatabase();
  if (connection.kind === "pglite") {
    await connection.migrate();
    await seedIfEmpty(connection.db);
  }
  return connection.db;
}

export function getDb(): Promise<Database> {
  globalForDb.__eternaDb ??= init().catch((error) => {
    globalForDb.__eternaDb = undefined; // EN: allow a retry. PT: permitir nova tentativa.
    throw error;
  });
  return globalForDb.__eternaDb;
}
