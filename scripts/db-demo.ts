import { loadEnvConfig } from "@next/env";

/**
 * EN: Demo data for LOCAL testing only (team of every role incl. "demo.super", customers, orders, deliveries, fittings),
 *     marked as demo and removable. It never runs against the production database (DATABASE_URL set → refused), and
 *     it is no longer in the back-office. With PGlite, stop `npm run dev` first.
 *       npm run db:demo          → load (replaces previous demo data)
 *       npm run db:demo -- clear → remove the demo data (real data is never touched)
 * PT: Dados de exemplo SÓ para testes em local (equipa de todos os papéis incluindo "demo.super", clientes, encomendas,
 *     entregas, provas), marcados como exemplo e apagáveis. Nunca corre na base de produção (com DATABASE_URL é
 *     recusado) e já não está na gestão. Com PGlite, parar o `npm run dev` primeiro.
 */
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.DATABASE_URL) {
    console.error("Refused: DATABASE_URL is set (demo data is local only) / Recusado: só em local, sem DATABASE_URL.");
    process.exit(1);
  }
  const clear = process.argv.includes("clear");
  const { clearDemoData, loadDemoData } = await import("../src/server/demo");
  await (clear ? clearDemoData() : loadDemoData());
  console.log(clear ? "✓ Demo data removed / Dados de exemplo apagados" : "✓ Demo data loaded / Dados de exemplo carregados (password = DEMO_PASSWORD)");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
