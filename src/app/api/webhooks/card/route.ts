import { createWebhookHandler } from "@/server/webhooks";

/**
 * POST /api/webhooks/card
 * EN: The card gateway calls this URL after 3-D Secure. PT: O gateway do cartão chama este endereço depois do 3-D Secure.
 */
export const POST = createWebhookHandler("card");
