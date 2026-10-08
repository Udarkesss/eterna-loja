import "server-only";

/**
 * EN: Outgoing WhatsApp / SMS / e-mail. No provider is connected yet (phase 6), so messages are written to the
 *     server log. While MESSAGING_MODE is not "live", codes are also returned to the screen (`devCode`) so the
 *     flows can be tested — the screen says clearly that it is demo mode.
 * PT: Envio de WhatsApp / SMS / e-mail. Ainda não há fornecedor (fase 6), por isso as mensagens vão para o registo
 *     do servidor. Enquanto MESSAGING_MODE não for "live", os códigos também aparecem no ecrã (`devCode`) para se
 *     poder testar — o ecrã diz claramente que é modo de demonstração.
 */

export type Channel = "whatsapp" | "sms" | "email";

export const messagingIsLive = () => process.env.MESSAGING_MODE === "live";

export async function sendMessage(channel: Channel, to: string, text: string): Promise<void> {
  // TODO (fase 6): WhatsApp Business API, SMS gateway, e-mail provider.
  console.info(`[messaging:${channel}] → ${to}\n${text}`);
}

/** EN: What the API may reveal in demo mode. PT: O que a API pode mostrar em modo de demonstração. */
export function devOnly<T>(value: T): T | undefined {
  return messagingIsLive() ? undefined : value;
}
