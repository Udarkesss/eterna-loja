import { createWebhookHandler } from "@/server/webhooks";

/**
 * POST /api/webhooks/emola
 * EN: Movitel (or the aggregator) calls this URL when the customer confirms or declines with her PIN.
 * PT: A Movitel (ou o agregador) chama este endereço quando a cliente confirma ou recusa com o PIN.
 */
export const POST = createWebhookHandler("emola");
