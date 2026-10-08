import { COLOR_FAMILIES, type ColorFamily } from "@/types";
import { listProducts, type ProductSort } from "@/server/catalog";
import { jsonData, withErrorHandling } from "@/server/errors";
import { localeFromRequest } from "@/server/request";

const SORTS: ProductSort[] = ["recommended", "price_asc", "price_desc"];
const list = (v: string | null) => v?.split(",").filter(Boolean).slice(0, 100);
const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/**
 * GET /api/v1/products?locale=pt&category=convidada&type=vestidos-longos&size=6US/38EUR/S&color=blue
 *     &priceMin=20000&priceMax=30000&new=true&q=8G1&sort=price_asc&slugs=a,b
 * EN: Lists visible products in one language. `category` includes sub-categories; lists are comma-separated.
 * PT: Lista produtos visíveis num idioma. `category` inclui subcategorias; listas separadas por vírgulas.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const p = new URL(request.url).searchParams;
  const sort = p.get("sort") as ProductSort | null;
  const isNew = p.get("new");

  const products = await listProducts(
    {
      category: p.get("category") ?? undefined,
      types: list(p.get("type")),
      sizes: list(p.get("size")),
      colors: list(p.get("color"))?.filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c)),
      priceMin: num(p.get("priceMin")),
      priceMax: num(p.get("priceMax")),
      slugs: list(p.get("slugs")),
      isNew: isNew === null ? undefined : isNew === "true",
      search: p.get("q")?.slice(0, 60) || undefined,
      sort: sort && SORTS.includes(sort) ? sort : undefined,
    },
    localeFromRequest(request),
  );
  return jsonData(products);
});
