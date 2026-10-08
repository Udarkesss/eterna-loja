import { loadEnvConfig } from "@next/env";

/**
 * EN: Loads the design data (stores, categories, products, home content, payments, zones, roles).
 *     Safe to run again. With PGlite, stop `npm run dev` first (one process per database folder).
 * PT: Carrega os dados do design (lojas, categorias, produtos, conteúdo, pagamentos, zonas, papéis).
 *     Pode voltar a correr. Com PGlite, parar o `npm run dev` primeiro.
 */
loadEnvConfig(process.cwd());

async function main() {
  const { createDatabase } = await import("../src/server/db/client");
  const { seedAll } = await import("../src/server/db/seed");
  const connection = createDatabase();
  try {
    await connection.migrate();
    await seedAll(connection.db);
    console.log(`✓ Design data loaded (${connection.kind}) / Dados do design carregados`);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
