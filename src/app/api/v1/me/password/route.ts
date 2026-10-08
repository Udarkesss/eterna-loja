import { z } from "zod";
import { passwordSchema } from "@/lib/auth-schemas";
import { changePassword, requireCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/** POST /api/v1/me/password { current, next } — EN: "Alterar palavra-passe". PT: Alterar palavra-passe. */
export const POST = withErrorHandling(async (request: Request) => {
  const customer = await requireCustomer();
  const { current, next } = await parseJson(request, z.object({ current: z.string().max(200), next: passwordSchema }));
  await changePassword(customer.id, current, next);
  return jsonData({ changed: true });
});
