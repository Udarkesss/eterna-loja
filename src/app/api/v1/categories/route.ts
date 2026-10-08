import { getCategoryTree } from "@/server/catalog";
import { jsonData, withErrorHandling } from "@/server/errors";
import { localeFromRequest } from "@/server/request";

/**
 * GET /api/v1/categories?locale=pt
 * EN: The full category tree (top level with nested children). The mobile app builds its menu from this.
 * PT: A árvore completa de categorias (topo com filhas). A app móvel constrói o menu a partir daqui.
 */
export const GET = withErrorHandling(async (request: Request) => {
  return jsonData(await getCategoryTree(localeFromRequest(request)));
});
