import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, gte, sql } from "drizzle-orm";
import { whatsappLink } from "@/data/site";
import type { Locale } from "@/types";
import { getDb } from "../db";
import { chatConversations, chatMessages } from "../db/schema";
import { AppError } from "../errors";
import { answer, assistantSettings, greeting, teamOnline } from "./engine";
import { sendWhatsapp, whatsappConfigured, whatsappSentThisMonth } from "./whatsapp";

/**
 * EN: Conversations of the assistant: the site chat (a secret token kept in the browser), WhatsApp (by number), the
 *     hand-off to the team and the team's replies (Gestão → Assistente · "Para a equipa").
 * PT: Conversas do assistente: o chat do site (um token secreto guardado no browser), o WhatsApp (pelo número), a
 *     passagem à equipa e as respostas da equipa (Gestão → Assistente · "Para a equipa").
 */

type Conversation = typeof chatConversations.$inferSelect;
export interface ChatMessageDTO {
  id: string;
  from: "customer" | "bot" | "team";
  text: string;
  action: { label: string; href: string } | null;
  at: string;
}

const dto = (m: typeof chatMessages.$inferSelect): ChatMessageDTO => ({ id: m.id, from: m.sender, text: m.text, action: m.action ?? null, at: m.createdAt.toISOString() });

async function push(conversationId: string, sender: ChatMessageDTO["from"], text: string, action: ChatMessageDTO["action"] = null, staffUserId: string | null = null) {
  const db = await getDb();
  const [m] = await db.insert(chatMessages).values({ conversationId, sender, text, action, staffUserId }).returning();
  await db.update(chatConversations).set({ lastMessageAt: new Date() }).where(eq(chatConversations.id, conversationId));
  return m;
}

async function byToken(token: string) {
  const db = await getDb();
  const [c] = await db.select().from(chatConversations).where(and(eq(chatConversations.token, token), eq(chatConversations.channel, "site")));
  return c ?? null;
}

/** EN: Too many messages in a minute (abuse). PT: Mensagens a mais num minuto (abuso). */
async function flooding(conversationId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ n: count() })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, "customer"), gt(chatMessages.createdAt, new Date(Date.now() - 60_000))));
  return r.n >= 12;
}

/** EN: What the chat window shows after a message. PT: O que a janela mostra depois de uma mensagem. */
export interface SiteReply {
  token: string;
  messages: ChatMessageDTO[];
  human: boolean;
  unsure: boolean;
  withTeam: boolean;
}

/**
 * EN: A message written in the site chat. The first one opens the conversation (greeting + token). While the
 *     conversation is with the team, the assistant stays quiet and the message waits for a person.
 * PT: Uma mensagem no chat do site. A primeira abre a conversa (saudação + token). Enquanto está com a equipa, o
 *     assistente fica calado e a mensagem espera por uma pessoa.
 */
export async function siteMessage(token: string | null, text: string, locale: Locale, customerId: string | null): Promise<SiteReply> {
  const s = await assistantSettings();
  if (!s.site) throw new AppError("FORBIDDEN", "Assistant off", 403);
  const db = await getDb();
  let c = token ? await byToken(token) : null;
  const fresh: ChatMessageDTO[] = [];
  if (!c) {
    [c] = await db
      .insert(chatConversations)
      .values({ channel: "site", token: randomBytes(24).toString("base64url"), locale, customerId })
      .returning();
    // EN: The window already shows the greeting; it is kept for the team's history. PT: A janela já mostra a saudação.
    await push(c.id, "bot", greeting(locale));
  }
  if (await flooding(c.id)) throw new AppError("LOCKED", "Too many messages", 429);
  fresh.push(dto(await push(c.id, "customer", text)));
  // EN: With the team (waiting, or a person answered in the last 24 hours): the message goes to a person.
  // PT: Com a equipa (à espera, ou uma pessoa respondeu nas últimas 24 horas): a mensagem vai para uma pessoa.
  if (c.needsTeam || (c.teamRepliedAt && Date.now() - c.teamRepliedAt.getTime() < 24 * 3600_000)) {
    if (!c.needsTeam) await db.update(chatConversations).set({ needsTeam: true }).where(eq(chatConversations.id, c.id));
    return { token: c.token, messages: fresh, human: true, unsure: false, withTeam: true };
  }
  const a = await answer(text, locale, "site", s);
  const misses = a.miss ? c.misses + 1 : 0;
  fresh.push(dto(await push(c.id, "bot", a.text, a.action ?? null)));
  const pass = misses >= s.handoffAfter;
  if (pass) {
    fresh.push(dto(await push(c.id, "bot", locale === "pt" ? "Vou passar a conversa à equipa, para não ficar sem resposta." : "I'll pass this conversation to the team so you get an answer.")));
  }
  await db
    .update(chatConversations)
    .set({ misses, ...(pass ? { needsTeam: true, handedOff: true } : {}) })
    .where(eq(chatConversations.id, c.id));
  return { token: c.token, messages: fresh, human: !!a.human || pass, unsure: !!a.miss && !pass, withTeam: pass };
}

/**
 * EN: "Falar com uma pessoa": leave the message here (the team answers in this window) or continue on WhatsApp (the
 *     conversation goes as the first message, so nothing is repeated).
 * PT: "Falar com uma pessoa": deixar mensagem aqui (a equipa responde nesta janela) ou continuar no WhatsApp (a conversa
 *     vai como primeira mensagem, para não repetir nada).
 */
export async function siteHandoff(token: string, mode: "here" | "whatsapp", name?: string): Promise<{ messages: ChatMessageDTO[]; whatsappUrl?: string }> {
  const s = await assistantSettings();
  const c = await byToken(token);
  if (!c) throw new AppError("NOT_FOUND", "Conversation not found", 404);
  const db = await getDb();
  const pt = c.locale === "pt";
  if (mode === "whatsapp") {
    const rows = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, c.id)).orderBy(asc(chatMessages.createdAt));
    const asked = rows.filter((m) => m.sender === "customer").map((m) => `• ${m.text}`).slice(-5);
    const text = [pt ? "Olá, vim do chat do site da Eterna." : "Hello, I come from the Eterna website chat.", ...asked].join("\n");
    await db.update(chatConversations).set({ handedOff: true }).where(eq(chatConversations.id, c.id));
    return { messages: [], whatsappUrl: whatsappLink(text) };
  }
  await db
    .update(chatConversations)
    .set({ needsTeam: true, handedOff: true, name: name?.trim().slice(0, 60) || c.name })
    .where(eq(chatConversations.id, c.id));
  const online = teamOnline(s);
  const text = online
    ? pt
      ? "Passámos a conversa à equipa. Pode continuar a escrever aqui: a resposta aparece nesta janela."
      : "We've passed the conversation to the team. You can keep writing here: the answer will appear in this window."
    : s.offHours;
  return { messages: [dto(await push(c.id, "bot", text))] };
}

/** EN: Messages after a moment (the window asks every few seconds while open). PT: Mensagens depois de um momento. */
export async function siteMessagesSince(token: string, since: string | null) {
  const c = await byToken(token);
  if (!c) throw new AppError("NOT_FOUND", "Conversation not found", 404);
  const db = await getDb();
  const after = since ? new Date(since) : new Date(0);
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, c.id), gt(chatMessages.createdAt, Number.isNaN(after.getTime()) ? new Date(0) : after)))
    .orderBy(asc(chatMessages.createdAt))
    .limit(200);
  const withTeam = c.needsTeam || (!!c.teamRepliedAt && Date.now() - c.teamRepliedAt.getTime() < 24 * 3600_000);
  return { messages: rows.map(dto), human: c.needsTeam, withTeam };
}

// ── WhatsApp ──────────────────────────────────────────────────────────

/**
 * EN: A WhatsApp message received (Meta webhook). The assistant answers unless it is off, the conversation is with the
 *     team, or the team answered in the last 24 hours ("fica calado 24 horas").
 * PT: Uma mensagem de WhatsApp recebida. O assistente responde, a não ser que esteja desligado, a conversa esteja com
 *     a equipa ou a equipa tenha respondido nas últimas 24 horas.
 */
export async function whatsappIncoming(phone: string, name: string | null, text: string) {
  const s = await assistantSettings();
  const db = await getDb();
  const token = `wa:${phone}`;
  let [c] = await db.select().from(chatConversations).where(eq(chatConversations.token, token));
  if (!c) [c] = await db.insert(chatConversations).values({ channel: "whatsapp", token, phone, name, locale: "pt" }).returning();
  await push(c.id, "customer", text.slice(0, 2000));
  if (!s.whatsapp) return;
  const silent = c.needsTeam || (s.waSilence && c.teamRepliedAt && Date.now() - c.teamRepliedAt.getTime() < 24 * 3600_000);
  if (silent) return;
  const a = await answer(text, "pt", "whatsapp", s);
  const misses = a.miss ? c.misses + 1 : 0;
  const pass = !!a.human || misses >= s.handoffAfter;
  let reply = a.action ? `${a.text}\n${a.action.label}: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${a.action.href}` : a.text;
  if (a.human) reply = `${reply.replace(/ Como prefere continuar\?$/, "")} ${teamOnline(s) ? "Uma pessoa responde já a seguir." : s.offHours}`;
  else if (pass) reply = `${reply}\nVou passar a conversa à equipa, para não ficar sem resposta.`;
  await push(c.id, "bot", reply);
  await db.update(chatConversations).set({ misses, ...(pass ? { needsTeam: true, handedOff: true } : {}) }).where(eq(chatConversations.id, c.id));
  await sendWhatsapp(phone, reply);
}

/** EN: The team answered from the WhatsApp Business app (coexistence echo). PT: A equipa respondeu pela app. */
export async function whatsappTeamEcho(phone: string, text: string) {
  const db = await getDb();
  const [c] = await db.select().from(chatConversations).where(eq(chatConversations.token, `wa:${phone}`));
  if (!c) return;
  await push(c.id, "team", text.slice(0, 2000));
  await db.update(chatConversations).set({ needsTeam: false, teamRepliedAt: new Date() }).where(eq(chatConversations.id, c.id));
}

// ── Back-office / Gestão ──────────────────────────────────────────────

export async function inbox() {
  const db = await getDb();
  const rows = await db.select().from(chatConversations).where(eq(chatConversations.needsTeam, true)).orderBy(desc(chatConversations.lastMessageAt)).limit(50);
  const out = [];
  for (const c of rows) {
    const msgs = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, c.id)).orderBy(desc(chatMessages.createdAt)).limit(30);
    const lastCustomer = msgs.find((m) => m.sender === "customer");
    const askedHuman = lastCustomer && /pessoa|humano|alguem|alguém|person|human|someone/i.test(lastCustomer.text);
    out.push({
      id: c.id,
      channel: c.channel,
      who: c.channel === "whatsapp" && c.phone ? `+${c.phone.slice(0, 3)} ${c.phone.slice(3, 5)} ••• ${c.phone.slice(-2)}` : `Site${c.name ? ` · ${c.name}` : ""}`,
      phone: c.phone,
      at: c.lastMessageAt.toISOString(),
      last: askedHuman ? "Pediu para falar com uma pessoa" : lastCustomer ? `“${lastCustomer.text.slice(0, 140)}”` : "",
      messages: msgs.reverse().map(dto),
    });
  }
  return out;
}

export async function teamReply(conversationId: string, text: string, staffUserId: string): Promise<{ whatsappUrl?: string; sent: boolean }> {
  const db = await getDb();
  const [c] = await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId));
  if (!c) throw new AppError("NOT_FOUND", "Conversa não encontrada.", 404);
  await push(c.id, "team", text, null, staffUserId);
  await db.update(chatConversations).set({ needsTeam: false, teamRepliedAt: new Date(), misses: 0 }).where(eq(chatConversations.id, c.id));
  if (c.channel === "whatsapp" && c.phone) {
    // EN: Through the API when connected; otherwise the WhatsApp app opens with the text. PT: Pela API ou pela app.
    if (whatsappConfigured()) return { sent: await sendWhatsapp(c.phone, text) };
    return { sent: false, whatsappUrl: whatsappLink(text, c.phone) };
  }
  return { sent: true };
}

/** EN: "Fechar" a conversation without answering here (answered by phone, etc.). PT: Fechar sem responder aqui. */
export async function closeConversation(conversationId: string) {
  const db = await getDb();
  await db.update(chatConversations).set({ needsTeam: false }).where(eq(chatConversations.id, conversationId));
}

export async function assistantStats() {
  const db = await getDb();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [r] = await db
    .select({
      total: count(),
      site: sql<number>`count(*) filter (where ${chatConversations.channel} = 'site')`,
      whatsapp: sql<number>`count(*) filter (where ${chatConversations.channel} = 'whatsapp')`,
      handed: sql<number>`count(*) filter (where ${chatConversations.handedOff})`,
    })
    .from(chatConversations)
    .where(gte(chatConversations.createdAt, start));
  const [p] = await db.select({ n: count() }).from(chatConversations).where(eq(chatConversations.needsTeam, true));
  const total = Number(r.total);
  return {
    total,
    site: Number(r.site),
    whatsapp: Number(r.whatsapp),
    handed: Number(r.handed),
    pending: Number(p.n),
    resolvedPct: total ? Math.round(((total - Number(r.handed)) / total) * 100) : 0,
    waSent: await whatsappSentThisMonth(),
  };
}

export const pendingCount = async () => {
  const db = await getDb();
  const [p] = await db.select({ n: count() }).from(chatConversations).where(eq(chatConversations.needsTeam, true));
  return Number(p.n);
};

export type { Conversation };
