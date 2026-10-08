import { registerEmailSchema } from "@/lib/auth-schemas";
import { registerWithEmail } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/auth/customer/register  { name, email, password, locale }
 * EN: "Criar conta · Com e-mail". Starts a session. 409 ACCOUNT_EXISTS if the e-mail already has an account.
 * PT: "Criar conta · Com e-mail". Inicia sessão. 409 ACCOUNT_EXISTS se o e-mail já tem conta.
 */
export const POST = withErrorHandling(async (request: Request) =>
  jsonData(await registerWithEmail(await parseJson(request, registerEmailSchema)), 201),
);
