import { loadEnvConfig } from "@next/env";

/**
 * EN: Runs on every production deploy (Vercel "vercel-build"): applies pending migrations and, only when the
 *     database is empty, loads the design data. It never overwrites what the team edited in the back-office.
 * PT: Corre em cada publicação (Vercel "vercel-build"): aplica as migrações pendentes e, só se a base de dados estiver
 *     vazia, carrega os dados do design. Nunca apaga o que a equipa alterou na gestão.
 */
loadEnvConfig(process.cwd());

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing / falta o DATABASE_URL (Vercel → Settings → Environment Variables)");
    process.exit(1);
  }
  const { createDatabase } = await import("../src/server/db/client");
  const { seedIfEmpty } = await import("../src/server/db/seed");
  const connection = createDatabase();
  try {
    await connection.migrate();
    await seedIfEmpty(connection.db);
    console.log("✓ Database ready / Base de dados pronta");
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
