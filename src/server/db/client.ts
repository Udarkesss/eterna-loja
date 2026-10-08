import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * EN: Opens the database. Two modes, same PostgreSQL schema:
 *     - DATABASE_URL set  → real PostgreSQL (production: Neon, Supabase, RDS, …).
 *     - DATABASE_URL empty → PGlite, an embedded PostgreSQL saved in .data/pglite (development, nothing to install).
 *     No "server-only" here on purpose: the scripts in /scripts use this file too.
 * PT: Abre a base de dados. Dois modos, o mesmo esquema PostgreSQL:
 *     - DATABASE_URL definido → PostgreSQL real (produção: Neon, Supabase, RDS, …).
 *     - DATABASE_URL vazio    → PGlite, um PostgreSQL embutido guardado em .data/pglite (desenvolvimento, nada a instalar).
 *     Sem "server-only" de propósito: os scripts em /scripts também usam este ficheiro.
 */

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  kind: "postgres" | "pglite";
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
export const PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");

export function createDatabase(): DatabaseConnection {
  const url = process.env.DATABASE_URL;

  if (url) {
    // EN: Small pool: online each serverless instance opens its own (use Neon's "-pooler" address).
    // PT: Pool pequeno: online cada instância abre o seu (usar o endereço "-pooler" do Neon).
    const pool = new Pool({ connectionString: url, max: 3 });
    const db = drizzlePg(pool, { schema });
    return {
      db,
      kind: "postgres",
      migrate: () => migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => pool.end(),
    };
  }

  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  const pgliteDb = drizzlePglite(client, { schema });
  return {
    // EN: Same query API as node-postgres, so the app uses one type. PT: Mesma API, por isso a app usa um só tipo.
    db: pgliteDb as unknown as Database,
    kind: "pglite",
    migrate: () => migratePglite(pgliteDb, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.close(),
  };
}
