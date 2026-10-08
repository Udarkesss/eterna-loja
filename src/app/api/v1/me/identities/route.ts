import { IDENTITY_PROVIDERS } from "@/types";
import { requireCustomer, unlinkIdentity } from "@/server/accounts";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

/**
 * DELETE /api/v1/me/identities?provider=google
 * EN: "Formas de entrar · Desligar". At least one must stay. PT: Tem de ficar pelo menos uma.
 * TODO (fase 6): POST to link Google / Facebook once Eterna creates the developer apps.
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const customer = await requireCustomer();
  const provider = new URL(request.url).searchParams.get("provider");
  if (!IDENTITY_PROVIDERS.includes(provider as never)) throw new AppError("VALIDATION_ERROR", "provider", 400);
  return jsonData(await unlinkIdentity(customer.id, provider as (typeof IDENTITY_PROVIDERS)[number]));
});
