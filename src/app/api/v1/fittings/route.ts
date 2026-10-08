import { fittingRequestSchema } from "@/lib/auth-schemas";
import { currentCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { createFittingRequest } from "@/server/fittings";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/fittings  { locale, name, phone, kind, storeCode, date, time, productSlugs?, notes? }
 * EN: "Agendar prova". Creates the request (PR-0042) and returns the WhatsApp link with the message already written.
 *     Signed-in customers get the request in "As minhas provas". 409 SLOT_TAKEN if the time was just taken.
 * PT: Cria o pedido (PR-0042) e devolve o link do WhatsApp com a mensagem escrita.
 *     Clientes com sessão vêem-no em "As minhas provas". 409 SLOT_TAKEN se a hora acabou de ser ocupada.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const input = await parseJson(request, fittingRequestSchema);
  const customer = await currentCustomer();
  return jsonData(await createFittingRequest(input, customer?.id ?? null), 201);
});
