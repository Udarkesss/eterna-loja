import { createWebhookHandler } from "@/server/webhooks";

/**
 * POST /api/webhooks/mpesa
 * EN: Vodacom calls this URL when the customer confirms or declines with her PIN.
 *     Not versioned: it is the callback URL registered with the operator.
 * PT: A Vodacom chama este endereço quando a cliente confirma ou recusa com o PIN.
 *     Sem versão: é o endereço de retorno registado na operadora.
 */
export const POST = createWebhookHandler("mpesa");
