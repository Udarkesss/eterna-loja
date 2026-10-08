import { findProduct } from "@/server/catalog";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { localeFromRequest } from "@/server/request";

/**
 * GET /api/v1/products/:slug?locale=pt
 * EN: One product in one language. The slug is the lower-case store code (e.g. 9j253).
 * PT: Um produto num idioma. O slug é o código da loja em minúsculas (ex.: 9j253).
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const product = await findProduct(slug, localeFromRequest(request));
    if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);
    return jsonData(product);
  },
);
