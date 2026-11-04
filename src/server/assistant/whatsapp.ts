import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting, nextCounter } from "../settings";

/**
 * EN: WhatsApp Business Cloud API (Meta), in coexistence with the WhatsApp Business app on the store phone. Keys in the
 *     environment (never in the code): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET.
 *     Without them the channel stays "por ligar" and nothing is sent.
 * PT: API do WhatsApp Business (Meta), em coexistência com a app no telemóvel da loja. Chaves no ambiente (nunca no
 *     código). Sem elas o canal fica "por ligar" e nada é enviado.
 */

export const whatsappConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

const monthKey = () => `whatsapp.sent.${new Date().toISOString().slice(0, 7)}`;
export const whatsappSentThisMonth = () => getSetting<number>(monthKey(), 0);

export async function sendWhatsapp(to: string, text: string): Promise<boolean> {
  if (!whatsappConfigured()) return false;
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000), preview_url: true } }),
  }).catch(() => null);
  if (!res?.ok) return false;
  await nextCounter(monthKey());
  return true;
}

/** EN: Checks Meta's signature (X-Hub-Signature-256). PT: Confirma a assinatura da Meta. */
export function validSignature(body: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
