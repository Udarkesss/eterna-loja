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
    "Olá! Bem-vinda à ETERNA. Posso ajudar com as nossas colecções, tamanhos, reservas, pagamentos, provas de noiva, horário e encomendas. Será também um prazer recebê-la na nossa loja no Glória Mall. A qualquer momento pode falar com uma pessoa da equipa.",
    "Hello! Welcome to ETERNA. I can help with our collections, sizes, reservations, payments, bridal fittings, opening hours and orders. We'd also love to welcome you at our store in Glória Mall. You can talk to a person from the team at any time.",
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
      text: L(
        locale,
        `O ${p.code}${type} custa ${price}, mas neste momento está esgotado. Como as nossas peças são únicas, não há reposição garantida; a nossa equipa terá todo o prazer em sugerir alternativas.`,
        `${p.code}${type} costs ${price}, but it is sold out right now. As our pieces are unique, a restock is not guaranteed; our team will be happy to suggest alternatives.`,
      ),
      action: { label: L(locale, "Ver a peça", "See the piece"), href },
    };
  const colorLine = colors.length ? L(locale, ` Existe em ${colors.join(", ")}`, ` It comes in ${colors.join(", ")}`) : "";
  const sizeLine = L(locale, `${colorLine ? "," : " Existe em"} tamanhos ${sizes.join(", ")}.`, `${colorLine ? "," : " Sizes"} ${sizes.join(", ")}.`);
  const unique = L(locale, " Como as nossas peças são únicas, a disponibilidade pode mudar rapidamente: confirme com a equipa ou visite-nos.", " As our pieces are unique, availability can change quickly: check with the team or visit us.");
  return {
    text:
      (withStock
      ? L(locale, `O ${p.code}${type} tem em stock os tamanhos ${sizes.join(", ")}${colors.length ? `, em ${colors.join(", ")}` : ""}. Custa ${price}.`, `${p.code}${type} is in stock in ${sizes.join(", ")}${colors.length ? `, in ${colors.join(", ")}` : ""}. It costs ${price}.`)
      : L(locale, `O ${p.code}${type} custa ${price}.${colorLine}${sizeLine}`, `${p.code}${type} costs ${price}.${colorLine}${sizeLine}`)) + unique,
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
          "Recomendamos que consulte o guia de tamanhos e compare as suas medidas de busto, cintura e anca. Se estiver entre dois tamanhos, a recomendação geral é escolher o maior; o corte e o tecido também influenciam o ajuste. Temos tamanhos do XS ao XXL, mas como as peças são únicas variam de peça para peça: diga-me a referência e vejo os tamanhos no site. A melhor forma de confirmar é experimentar na loja.",
          "We recommend checking the size guide and comparing your bust, waist and hip measurements. If you are between two sizes, the general advice is to choose the larger one; cut and fabric also affect the fit. We carry XS to XXL, but as pieces are unique sizes vary per piece: tell me the reference and I'll check the sizes on the site. The best way to be sure is to try it on in store.",
        ),
        action: { label: L(locale, "Guia de tamanhos", "Size guide"), href: `/${locale}/info/tamanhos` },
      };
    case "reservations": {
      const r = await reservationSettings();
      return {
        text: L(
          locale,
          `Sim. A reserva faz-se com um sinal de ${r.depositPct}% do valor e a peça fica reservada em seu nome até ${r.days} dias (${r.bridalDays} nos vestidos de noiva e peças da Bridal). O restante paga-se no levantamento. Se a peça não for levantada no prazo, a reserva termina automaticamente. O sinal não é reembolsável e a reserva não pode ser transferida para outro artigo.`,
          `Yes. You reserve with a ${r.depositPct}% deposit and the piece is kept in your name for up to ${r.days} days (${r.bridalDays} for bridal pieces). You pay the rest when you collect it. If it is not collected in time, the reservation ends automatically. The deposit is not refundable and the reservation cannot be moved to another piece.`,
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
          `A ETERNA Bridal Showroom (Glória Mall, Loja 22) funciona exclusivamente mediante marcação, feita no nosso website com pelo menos ${b.advanceHours} horas de antecedência; fica confirmada depois do pagamento do pacote. ${pk}. Pode trazer até ${b.companions} acompanhantes e juntar até ${b.extraMax} vestidos extra a ${formatMZN(b.extraPrice, locale).replace(",00", "")} cada. O valor da prova é descontado no vestido se o comprar em ${b.discountDays} dias.`,
          `The ETERNA Bridal Showroom (Glória Mall, Store 22) works by appointment only, booked on our website at least ${b.advanceHours} hours ahead and confirmed once the package is paid. ${pk}. You can bring up to ${b.companions} companions and add up to ${b.extraMax} extra dresses at ${formatMZN(b.extraPrice, locale).replace(",00", "")} each. The fitting fee is deducted from the dress if you buy it within ${b.discountDays} days.`,
        ),
        action: { label: L(locale, "Agendar prova", "Book a fitting"), href: `/${locale}/fitting` },
      };
    }
    case "hours": {
      const stores = await listStores(locale);
      const lines = stores.map((s) => `${s.location}${s.hours ? ` · ${s.hours}` : ""}`).join(". ");
      return {
        text: L(locale, `Estamos no Glória Mall, em Maputo. ${lines}. Será um prazer recebê-la!`, `We're at Glória Mall, Maputo. ${lines}. We look forward to welcoming you!`),
        action: { label: L(locale, "Como chegar", "Directions"), href: `/${locale}#contactos` },
      };
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

  // EN: Hand-off message of the owner's guide. PT: Mensagem de encaminhamento do guia da dona.
  return {
    miss: true,
    text: L(
      locale,
      "Para lhe dar uma informação correcta, será necessário confirmar este detalhe com a nossa equipa. Será um prazer ajudá-la: prefere falar com uma pessoa?",
      "To give you the right information, we need to confirm this with our team. We'll be happy to help: would you like to talk to a person?",
    ),
  };
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
