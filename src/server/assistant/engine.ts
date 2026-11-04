import "server-only";
import { eq } from "drizzle-orm";
import { ASSISTANT_DEFAULT, norm, type AssistantSettings, type Topic } from "@/data/assistant";
import { BRIDAL_DEFAULT } from "@/data/bridal";
import { formatMZN } from "@/lib/format";
import { productHref } from "@/lib/links";
import type { Locale } from "@/types";
import { listProducts } from "../catalog";
import { deliveryEnabled, enabledPaymentMethods, listStores } from "../content";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { reservationSettings } from "../reservations";
import { getSetting } from "../settings";

/**
 * EN: The assistant's answers (design V3-Chat): words that ask for a person, an order number, a piece code, then the
 *     questions of Gestão → Assistente in order. Answers read the live data of the site, so a price, a package or an
 *     hour changed in the back-office is answered at once. No paid AI: nothing is sent outside.
 * PT: As respostas do assistente (V3-Chat): palavras que pedem uma pessoa, número de encomenda, código de peça e depois
 *     as perguntas da gestão, por ordem. As respostas lêem os dados do site, por isso uma mudança na gestão responde-se
 *     logo. Sem inteligência artificial paga: nada sai do site.
 */

export const assistantSettings = () => getSetting<AssistantSettings>("assistant", ASSISTANT_DEFAULT);

export interface Answer {
  text: string;
  action?: { label: string; href: string };
  human?: boolean;
  miss?: boolean;
}

const L = (locale: Locale, pt: string, en: string) => (locale === "pt" ? pt : en);
const HUMAN = ["pessoa", "humano", "atendente", "falar com", "alguem", "gerente", "person", "human", "someone", "agent"];
const HELLO = ["ola", "bom dia", "boa tarde", "boa noite", "obrigad", "hello", "hi ", "thanks", "thank you"];
const PAY_NAMES: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  card: "cartão Visa ou Mastercard",
  paypal: "PayPal",
  transfer: "transferência bancária",
  cod: "pagamento na entrega",
  test: "",
};
const STATUS: Record<string, [string, string]> = {
  pending: ["está a ser preparada", "is being prepared"],
  ready: ["está pronta para levantar na loja", "is ready to collect in store"],
  collected: ["já foi levantada", "has been collected"],
  assigned: ["está pronta e já tem entregador", "is ready and has a driver"],
  in_transit: ["está a caminho", "is on its way"],
  delivered: ["foi entregue", "has been delivered"],
  confirmed: ["foi entregue", "has been delivered"],
  cancelled: ["foi cancelada", "was cancelled"],
};

/** EN: Greeting at the start of a conversation. PT: Saudação no início da conversa. */
export const greeting = (locale: Locale) =>
  L(
    locale,
    "Olá! Sou o assistente da Eterna. Posso ajudar com preços, tamanhos, reservas, pagamentos, provas de noiva, horário e encomendas. A qualquer momento pode falar com uma pessoa da equipa.",
    "Hello! I'm the Eterna assistant. I can help with prices, sizes, reservations, payments, bridal fittings, opening hours and orders. You can talk to a person from the team at any time.",
  );

export const humanText = (s: AssistantSettings, locale: Locale) =>
  L(
    locale,
    `Claro. A equipa responde de segunda a sexta, ${s.teamWeek}, e ao sábado, ${s.teamSat}. Passamos esta conversa, para não ter de repetir nada. Como prefere continuar?`,
    `Of course. The team answers Monday to Friday, ${s.teamWeek}, and Saturday, ${s.teamSat}. We pass this conversation on so you don't have to repeat anything. How would you like to continue?`,
  );

/**
 * EN: A word of a question in the text: short words (1–2 letters, "M", "38") must be whole words; longer ones may start
 *     a word ("reserv" → "reservar").
 * PT: Palavras curtas têm de ser palavras inteiras; as mais longas podem começar uma palavra.
 */
function matches(n: string, word: string) {
  const w = norm(word).trim();
  if (!w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(w.length <= 2 ? `(^|[^a-z0-9])${esc}([^a-z0-9-]|$)` : `(^|[^a-z0-9])${esc}`).test(n);
}

/** EN: Piece codes in the text ("M164", "SUIT311", "8G1L7"). PT: Códigos de peça no texto. */
function codesIn(text: string) {
  return [...new Set((text.toUpperCase().match(/\b[A-Z0-9]*\d[A-Z0-9]*\b/g) ?? []).filter((x) => x.length >= 3 && !/^\d{1,2}$/.test(x) && !/^ET$/.test(x)))].slice(0, 3);
}

async function pieceAnswer(code: string, locale: Locale, withStock: boolean): Promise<Answer | null> {
  const [p] = await listProducts({ slugs: [code.toLowerCase()] }, locale);
  if (!p) return null;
  const type = p.type?.name ? ` (${p.type.name.toLowerCase()})` : "";
  const colors = p.colors.map((c) => c.name.toLowerCase());
  const sizes = [...new Set(p.variants.filter((v) => v.stock > 0).map((v) => v.size.split("/").pop() ?? v.size))];
  const price = p.salePrice && p.salePrice < p.price ? `${formatMZN(p.salePrice, locale)} (${L(locale, "antes", "was")} ${formatMZN(p.price, locale)})` : formatMZN(p.price, locale);
  const href = productHref(p.slug, locale);
  if (!sizes.length)
    return {
      text: L(locale, `O ${p.code}${type} custa ${price}, mas neste momento está esgotado. A equipa pode avisar quando voltar.`, `${p.code}${type} costs ${price}, but it is sold out right now. The team can let you know when it is back.`),
      action: { label: L(locale, "Ver a peça", "See the piece"), href },
    };
  const colorLine = colors.length ? L(locale, ` Existe em ${colors.join(", ")}`, ` It comes in ${colors.join(", ")}`) : "";
  const sizeLine = L(locale, `${colorLine ? "," : " Existe em"} tamanhos ${sizes.join(", ")}.`, `${colorLine ? "," : " Sizes"} ${sizes.join(", ")}.`);
  return {
    text: withStock
      ? L(locale, `O ${p.code}${type} tem em stock os tamanhos ${sizes.join(", ")}${colors.length ? `, em ${colors.join(", ")}` : ""}. Custa ${price}.`, `${p.code}${type} is in stock in ${sizes.join(", ")}${colors.length ? `, in ${colors.join(", ")}` : ""}. It costs ${price}.`)
      : L(locale, `O ${p.code}${type} custa ${price}.${colorLine}${sizeLine} Com o seu desconto de cliente, paga menos no checkout.`, `${p.code}${type} costs ${price}.${colorLine}${sizeLine} With your customer discount you pay less at checkout.`),
    action: { label: L(locale, "Ver a peça", "See the piece"), href },
  };
}

async function orderAnswer(number: string, locale: Locale): Promise<Answer> {
  const db = await getDb();
  const [o] = await db.select({ number: orders.number, status: orders.fulfillmentStatus, payment: orders.paymentStatus, type: orders.fulfillmentType }).from(orders).where(eq(orders.number, number));
  if (!o) return { text: L(locale, `Não encontro a encomenda ${number}. Confirme o número (começa por ET-, por exemplo ET-2026-0024).`, `I can't find order ${number}. Please check the number (it starts with ET-, e.g. ET-2026-0024).`) };
  if (o.payment === "pending") return { text: L(locale, `A encomenda ${o.number} está à espera da confirmação do pagamento.`, `Order ${o.number} is waiting for the payment to be confirmed.`) };
  const st = STATUS[o.status] ?? STATUS.pending;
  const tail =
    o.status === "pending"
      ? L(locale, o.type === "pickup" ? " Avisamos por WhatsApp quando estiver pronta para levantar na loja." : " Avisamos por WhatsApp quando sair para entrega.", o.type === "pickup" ? " We'll message you on WhatsApp when it's ready to collect." : " We'll message you on WhatsApp when it leaves for delivery.")
      : "";
  return { text: L(locale, `A encomenda ${o.number} ${st[0]}.${tail}`, `Order ${o.number} ${st[1]}.${tail}`) };
}

async function topicAnswer(t: Topic, text: string, locale: Locale): Promise<Answer> {
  switch (t.kind) {
    case "price":
      return { text: L(locale, "Diga-me a referência da peça (por exemplo SUIT311 ou M164) e digo-lhe o preço, as cores e os tamanhos que temos.", "Tell me the piece reference (e.g. SUIT311 or M164) and I'll tell you the price, colours and sizes we have.") };
    case "stock":
      return {
        text: L(
          locale,
          "S = 4–6 US · 36–38 EU, M = 8–10 US · 40–42 EU, L = 12–14 US · 44–46 EU, XL = 16 US · 48 EU. Se estiver entre dois tamanhos, a equipa ajuda-a a escolher. Diga-me a referência da peça e vejo os tamanhos em stock.",
          "S = 4–6 US · 36–38 EU, M = 8–10 US · 40–42 EU, L = 12–14 US · 44–46 EU, XL = 16 US · 48 EU. If you're between two sizes, the team will help you choose. Tell me the piece reference and I'll check the sizes in stock.",
        ),
        action: { label: L(locale, "Guia de tamanhos", "Size guide"), href: `/${locale}/info/tamanhos` },
      };
    case "reservations": {
      const r = await reservationSettings();
      return {
        text: L(
          locale,
          `Sim. Pague ${r.depositPct}% do valor como sinal e a peça fica separada em seu nome ${r.days} dias (${r.bridalDays} nos vestidos de noiva e peças da Bridal). No levantamento paga o restante. Fora do prazo, o sinal não é reembolsável.`,
          `Yes. Pay ${r.depositPct}% as a deposit and the piece is kept in your name for ${r.days} days (${r.bridalDays} for bridal pieces). You pay the rest when you collect it. After the deadline the deposit is not refundable.`,
        ),
        action: { label: L(locale, "Como reservar", "How to reserve"), href: `/${locale}/como-comprar` },
      };
    }
    case "payments": {
      const names = (await enabledPaymentMethods()).map((m) => PAY_NAMES[m] ?? m).filter(Boolean);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${L(locale, "e", "and")} ${names[names.length - 1]}` : (names[0] ?? "");
      return {
        text: L(
          locale,
          `Aceitamos ${list}. Nos pagamentos por telemóvel, o PIN introduz-se no seu telemóvel: o site nunca o pede.`,
          `We accept ${list}. For mobile payments the PIN is entered on your phone: the site never asks for it.`,
        ),
      };
    }
    case "fittings": {
      const b = await getSetting("fittings.bridal", BRIDAL_DEFAULT);
      const pk = b.packages
        .filter((p) => p.status === "active")
        .map((p) => `${p.name}: ${p.dresses} ${L(locale, "vestidos", "dresses")}, ${p.minutes >= 60 ? `${p.minutes / 60} ${L(locale, p.minutes === 60 ? "hora" : "horas", p.minutes === 60 ? "hour" : "hours")}` : `${p.minutes} min`}, ${formatMZN(p.price, locale).replace(",00", "")}`)
        .join(". ");
      return {
        text: L(
          locale,
          `As provas são no showroom Eterna Bridal (Loja 22), só por marcação e com 48 horas de antecedência. ${pk}. O valor desconta no vestido se comprar em ${b.discountDays} dias.`,
          `Fittings are at the Eterna Bridal showroom (Store 22), by appointment only, booked 48 hours ahead. ${pk}. The fee is deducted from the dress if you buy within ${b.discountDays} days.`,
        ),
        action: { label: L(locale, "Agendar prova", "Book a fitting"), href: `/${locale}/fitting` },
      };
    }
    case "hours": {
      const stores = await listStores(locale);
      const lines = stores.map((s) => `${s.location}${s.hours ? ` · ${s.hours}` : ""}`).join(". ");
      return { text: L(locale, `Estamos no Glória Mall, em Maputo. ${lines}.`, `We're at Glória Mall, Maputo. ${lines}.`), action: { label: L(locale, "Como chegar", "Directions"), href: `/${locale}#contactos` } };
    }
    case "order":
      return { text: L(locale, "Diga-me o número da encomenda (começa por ET-, por exemplo ET-2026-0024) e vejo como está.", "Tell me the order number (it starts with ET-, e.g. ET-2026-0024) and I'll check it.") };
    case "deliveries":
      if (await deliveryEnabled())
        return { text: L(locale, "Entregamos em Maputo e Matola. O valor e o prazo da sua zona aparecem no checkout, antes de pagar.", "We deliver in Maputo and Matola. The fee and time for your area show at checkout, before you pay.") };
      return {
        miss: true,
        text: L(
          locale,
          "Neste momento as compras levantam-se na loja do Glória Mall, em Maputo. As entregas ao domicílio estão a ser preparadas. Para envios para outra cidade, a equipa pode ajudar: quer falar com uma pessoa?",
          "Right now purchases are collected at our Glória Mall store in Maputo. Home delivery is being prepared. For other cities the team can help: would you like to talk to a person?",
        ),
      };
    default:
      return { text: t.text || text };
  }
}

/**
 * EN: The answer to one message. `channel` filters the questions switched on for the site or WhatsApp.
 * PT: A resposta a uma mensagem. `channel` filtra as perguntas ligadas para o site ou o WhatsApp.
 */
export async function answer(text: string, locale: Locale, channel: "site" | "whatsapp", s?: AssistantSettings): Promise<Answer> {
  const settings = s ?? (await assistantSettings());
  const n = ` ${norm(text)} `;
  const has = (words: string[]) => words.some((w) => matches(n, w));
  const topics = settings.topics.filter((t) => t.on && t[channel]);
  const topic = (kind: Topic["kind"]) => topics.find((t) => t.kind === kind);

  if (has(HUMAN)) return { human: true, text: humanText(settings, locale) };

  const ord = text.toUpperCase().match(/ET-\d{4}-\d{3,5}/);
  if (ord && topic("order")) return orderAnswer(ord[0], locale);

  const codes = codesIn(text);
  if (codes.length && (topic("price") || topic("stock"))) {
    const stockWords = topic("stock")?.keywords ?? [];
    for (const code of codes) {
      const a = await pieceAnswer(code, locale, has(stockWords) && !has(topic("price")?.keywords ?? []));
      if (a) return a;
    }
  }

  // EN: The question whose matched word is the most specific (longest) wins: "m-pesa" beats "M". PT: Ganha a palavra
  //     mais específica (mais longa).
  let best: { t: Topic; score: number } | null = null;
  for (const x of topics) {
    const score = Math.max(0, ...x.keywords.filter((w) => matches(n, w)).map((w) => norm(w).length));
    if (score && (!best || score > best.score)) best = { t: x, score };
  }
  if (best) return topicAnswer(best.t, text, locale);

  if (has(HELLO))
    return {
      text: L(locale, "Olá! Em que posso ajudar? Pode perguntar por preços, tamanhos, reservas, pagamentos, provas de noiva ou encomendas.", "Hello! How can I help? You can ask about prices, sizes, reservations, payments, bridal fittings or orders."),
    };

  return { miss: true, text: L(locale, "Não tenho a certeza da resposta a essa pergunta. Prefere falar com uma pessoa da equipa?", "I'm not sure about the answer to that. Would you like to talk to a person from the team?") };
}

/** EN: Is the team working now (Maputo time)? PT: A equipa está a trabalhar agora (hora de Maputo)? */
export function teamOnline(s: AssistantSettings, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Maputo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hm = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
  const range = day === "Sun" ? "" : day === "Sat" ? s.teamSat : s.teamWeek;
  const m = range.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!m) return false;
  const pad = (x: string) => x.padStart(5, "0");
  return hm >= pad(m[1]) && hm < pad(m[2]);
}
