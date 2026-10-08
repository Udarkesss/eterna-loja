import { whatsappVerifySchema } from "@/lib/auth-schemas";
import { verifyWhatsappSignupCode } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/** POST /api/v1/auth/customer/whatsapp/verify  { phone, code } — EN: step 2. PT: passo 2. */
export const POST = withErrorHandling(async (request: Request) => {
  const { phone, code } = await parseJson(request, whatsappVerifySchema);
  return jsonData(await verifyWhatsappSignupCode(phone, code));
});
