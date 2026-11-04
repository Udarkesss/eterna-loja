import { NextResponse } from "next/server";
import { whatsappIncoming, whatsappTeamEcho } from "@/server/assistant/chat";
import { validSignature } from "@/server/assistant/whatsapp";

/**
 * EN: Meta WhatsApp Business webhook. GET = subscription check (WHATSAPP_VERIFY_TOKEN); POST = messages, signed with
 *     WHATSAPP_APP_SECRET (unsigned requests are refused). Echoes of the team's replies from the app silence the assistant.
 * PT: Webhook do WhatsApp Business da Meta. GET = verificação; POST = mensagens assinadas (sem assinatura são
 *     recusadas). Os ecos das respostas da equipa pela app calam o assistente.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = url.searchParams.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

type Msg = { from?: string; to?: string; type?: string; text?: { body?: string } };
type Change = { field?: string; value?: { contacts?: { profile?: { name?: string }; wa_id?: string }[]; messages?: Msg[]; message_echoes?: Msg[] } };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return new NextResponse("Forbidden", { status: 403 });
  let payload: { entry?: { changes?: Change[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const m of v.messages ?? []) {
        if (m.type === "text" && m.from && m.text?.body) {
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
          await whatsappIncoming(m.from, name, m.text.body);
        }
      }
      for (const m of v.message_echoes ?? []) {
        if (m.to && m.text?.body) await whatsappTeamEcho(m.to, m.text.body);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
