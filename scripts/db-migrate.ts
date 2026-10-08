import { loadEnvConfig } from "@next/env";

/**
 * EN: Applies pending migrations (folder /drizzle). Run on every deploy: `npm run db:migrate`.
 * PT: Aplica as migrações pendentes (pasta /drizzle). Correr em cada deploy: `npm run db:migrate`.
 */
loadEnvConfig(process.cwd());

async function main() {
  const { createDatabase } = await import("../src/server/db/client");
  const connection = createDatabase();
  try {
    await connection.migrate();
    console.log(`✓ Migrations applied (${connection.kind}) / Migrações aplicadas`);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
