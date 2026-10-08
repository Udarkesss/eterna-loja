import { profileSchema } from "@/lib/auth-schemas";
import { currentCustomer, requireCustomer, toCustomerDTO, updateProfile } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * GET /api/v1/me — EN: the signed-in customer, or null. PT: a cliente com sessão, ou null.
 * PATCH /api/v1/me { name } — EN: update the profile. PT: actualizar os dados.
 */
export const GET = withErrorHandling(async () => {
  const row = await currentCustomer();
  return jsonData(row ? await toCustomerDTO(row) : null);
});

export const PATCH = withErrorHandling(async (request: Request) => {
  const customer = await requireCustomer();
  return jsonData(await updateProfile(customer.id, await parseJson(request, profileSchema)));
});
