import { newsletterSchema } from "@/lib/validation";
import { getDb } from "@/server/db";
import { newsletterSubscribers } from "@/server/db/schema";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

/**
 * POST /api/v1/newsletter  { email, locale }
 * EN: Footer "Receba as novidades". Subscribing twice is fine (no error, no duplicate).
 * PT: "Receba as novidades" do rodapé. Subscrever duas vezes não dá erro nem duplica.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = newsletterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid e-mail", 400);
  const db = await getDb();
  await db
    .insert(newsletterSubscribers)
    .values({ email: parsed.data.email.toLowerCase(), locale: parsed.data.locale })
    .onConflictDoNothing();
  return jsonData({ subscribed: true }, 201);
});
