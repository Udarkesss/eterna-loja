import { loadEnvConfig } from "@next/env";

/**
 * EN: Imports the real catalog from the Nexsory storefront API (the platform behind the current eterna.co.mz).
 *     Needs NEXSORY_STOREFRONT (or NEXSORY_API_KEY) in .env.local — get it from the Nexsory dashboard.
 *     With PGlite, stop `npm run dev` first.
 *
 *     npm run import:nexsory             → dry run: shows the first product as returned by the API
 *     npm run import:nexsory -- --save   → saves products, variants and downloads photos
 *
 * PT: Importa o catálogo real da API de loja da Nexsory (a plataforma por trás do eterna.co.mz actual).
 *     Precisa de NEXSORY_STOREFRONT (ou NEXSORY_API_KEY) no .env.local — obter no painel da Nexsory.
 *     Com PGlite, parar o `npm run dev` primeiro.
 */
loadEnvConfig(process.cwd());

const BASE_URL = process.env.NEXSORY_API_URL || "https://e-commerce.nexsory.cloud/api/storefront/v1";

function headers(): Record<string, string> {
  if (process.env.NEXSORY_API_KEY) return { "X-Nexsory-Key": process.env.NEXSORY_API_KEY };
  if (process.env.NEXSORY_STOREFRONT) return { "X-Nexsory-Storefront": process.env.NEXSORY_STOREFRONT };
  throw new Error(
    "Missing NEXSORY_STOREFRONT or NEXSORY_API_KEY in .env.local / Falta NEXSORY_STOREFRONT ou NEXSORY_API_KEY no .env.local",
  );
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function main() {
  const save = process.argv.includes("--save");

  // EN: Step 1 — look at the real data shape before mapping it. PT: Passo 1 — ver a forma real dos dados antes de a mapear.
  const categories = await get<unknown>("/categories");
  const firstPage = await get<unknown>("/products?page=1&pageSize=5");
  console.log("── categories ──\n", JSON.stringify(categories, null, 2).slice(0, 3000));
  console.log("── products (page 1) ──\n", JSON.stringify(firstPage, null, 2).slice(0, 6000));

  if (save) {
    // TODO EN: map the Nexsory response to ImportedProduct (scripts/import/save.ts) once the shape above is known.
    // TODO PT: mapear a resposta da Nexsory para ImportedProduct (scripts/import/save.ts) quando a forma acima for conhecida.
    throw new Error("Mapping not written yet — run without --save and share the output / Mapeamento ainda por escrever");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
