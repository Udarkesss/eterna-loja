import { z } from "zod";
import { addFavorites, listFavoriteSlugs, removeFavorite, requireCustomer } from "@/server/accounts";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * GET    /api/v1/me/favorites            → string[] (slugs)
 * POST   /api/v1/me/favorites { slugs }  → EN: add (also merges the browser list after sign-in). PT: junta.
 * DELETE /api/v1/me/favorites?slug=8g1l7 → EN: remove. PT: remove.
 */
export const GET = withErrorHandling(async () => jsonData(await listFavoriteSlugs((await requireCustomer()).id)));

export const POST = withErrorHandling(async (request: Request) => {
  const customer = await requireCustomer();
  const { slugs } = await parseJson(request, z.object({ slugs: z.array(z.string().min(1).max(100)).max(200) }));
  return jsonData(await addFavorites(customer.id, slugs));
});

export const DELETE = withErrorHandling(async (request: Request) => {
  const customer = await requireCustomer();
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) throw new AppError("VALIDATION_ERROR", "slug required", 400);
  return jsonData(await removeFavorite(customer.id, slug));
});
