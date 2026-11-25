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

/**
 * EN: What the API may reveal in demo mode: only on this computer, or online when MESSAGING_MODE is explicitly "demo".
 *     Online the codes are never shown by default (owner 2026-11-25): with real customers and the team's accounts,
 *     a code on the screen would let anyone who knows a phone number or username take over that account.
 * PT: O que a API pode mostrar em modo de demonstração: só neste computador, ou online com MESSAGING_MODE="demo".
 *     Online os códigos nunca aparecem por defeito (dona 25-11-2026): com clientes reais e as contas da equipa, um
 *     código no ecrã deixaria quem sabe um número ou utilizador entrar nessa conta.
 */
export function devOnly<T>(value: T): T | undefined {
  if (messagingIsLive()) return undefined;
  const online = process.env.NODE_ENV === "production" && process.env.MESSAGING_MODE !== "demo";
  return online ? undefined : value;
}
