import { searchSuggestions } from "@/server/catalog";
import { jsonData, withErrorHandling } from "@/server/errors";
import { localeFromRequest } from "@/server/request";

/**
 * GET /api/v1/search?locale=pt&q=8G1
 * EN: Suggestions while typing (collections and occasions, types with counts, first three pieces). The full results
 *     are GET /api/v1/products?q=…
 * PT: Sugestões enquanto escreve (colecções e ocasiões, tipos com contagem, três primeiras peças). Os resultados
 *     completos estão em GET /api/v1/products?q=…
 */
export const GET = withErrorHandling(async (request: Request) => {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 60) ?? "";
  return jsonData(await searchSuggestions(q, localeFromRequest(request)));
});
