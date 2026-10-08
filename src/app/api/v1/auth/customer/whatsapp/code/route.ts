import { whatsappCodeSchema } from "@/lib/auth-schemas";
import { sendWhatsappSignupCode } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/auth/customer/whatsapp/code  { phone }
 * EN: "Criar conta · Com WhatsApp", step 1. PT: Passo 1 do registo por WhatsApp.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { phone } = await parseJson(request, whatsappCodeSchema);
  return jsonData(await sendWhatsappSignupCode(phone));
});
