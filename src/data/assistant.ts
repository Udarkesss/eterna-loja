/**
 * EN: Store assistant of design V3 (V3-Chat and V3-G-Assistente): no paid AI. Each question ("Tema") has words that
 *     trigger it and an answer that reads the site's data (prices, stock, reservations, payments, fittings, hours,
 *     orders) or a fixed text. It hands the conversation to a person when the customer asks or after unanswered
 *     questions. Everything is edited in Gestão → Assistente (setting "assistant").
 * PT: Assistente da loja do V3: sem inteligência artificial paga. Cada tema tem palavras que o activam e uma resposta
 *     que lê os dados do site ou um texto fixo. Passa a conversa a uma pessoa quando a cliente pede ou depois de
 *     perguntas sem resposta. Tudo se edita em Gestão → Assistente (definição "assistant").
 */

export type TopicKind = "price" | "stock" | "reservations" | "payments" | "fittings" | "hours" | "order" | "exchanges" | "deliveries" | "custom";

export const TOPIC_SOURCES: Record<TopicKind, string> = {
  price: "Lê o preço e o desconto da peça no site",
  stock: "Lê os tamanhos e as cores em stock",
  reservations: "Regras de Reservas (sinal e prazos)",
  payments: "Formas de pagamento ligadas na gestão",
  fittings: "Pacotes e regras de Provas · Bridal",
  hours: "Contactos e redes sociais",
  order: "Lê o estado pelo número da encomenda",
  exchanges: "Texto fixo",
  deliveries: "Desligado enquanto as entregas estiverem desligadas",
  custom: "Texto fixo",
};

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  kind: TopicKind;
  text: string; // EN: fixed answer (exchanges, custom) or extra line. PT: resposta fixa ou linha extra.
  site: boolean;
  whatsapp: boolean;
  on: boolean;
}

export interface AssistantSettings {
  site: boolean;
  whatsapp: boolean;
  alwaysHuman: boolean;
  handoffAfter: number;
  teamWeek: string; // "09:00–18:00"
  teamSat: string;
  offHours: string;
  waSilence: boolean;
  topics: Topic[];
}

const T = (id: string, name: string, keywords: string, kind: TopicKind, text = ""): Topic => ({
  id,
  name,
  keywords: keywords.split("·").map((x) => x.trim()),
  kind,
  text,
  site: true,
  whatsapp: true,
  on: true,
});

export const ASSISTANT_DEFAULT: AssistantSettings = {
  site: true,
  whatsapp: true,
  alwaysHuman: true,
  handoffAfter: 2,
  teamWeek: "09:00–18:00",
  teamSat: "09:00–14:00",
  offHours: "Obrigada pela mensagem. A equipa responde no dia útil seguinte, a partir das 09:00.",
  waSilence: true,
  topics: [
    T("preco", "Preço de uma peça", "quanto custa · preço · valor", "price"),
    T("tamanho", "Tamanho e stock", "tamanho · tem em · M · 38 · serve-me", "stock"),
    T("reservas", "Reservas", "reservar · sinal · guardar", "reservations"),
    T("pagamentos", "Pagamentos", "m-pesa · mpesa · e-mola · emola · mkesh · cartão · pagar · pagamento · visa · transferência", "payments"),
    T("provas", "Provas de noiva", "prova · noiva · marcar · pacote · bridal · casamento", "fittings"),
    T("horario", "Horário e morada", "horário · onde fica · morada · abre · fecha · localização · glória · endereço", "hours"),
    T("encomenda", "Estado da encomenda", "encomenda · ET- · quando chega · pedido · levantar", "order"),
    T(
      "trocas",
      "Trocas e devoluções",
      "trocar · devolver · reembolso · troca · devolução",
      "exchanges",
      "Todas as vendas da Eterna são finais, não sendo aceites trocas nem devoluções. Antes de pagar, confirme a peça e o tamanho; se tiver dúvidas, venha experimentar à loja.",
    ),
    T("entregas", "Entregas", "entrega · enviar · casa · envio · domicílio · província", "deliveries"),
  ],
};

/** EN: Lower case without accents, for matching. PT: Minúsculas sem acentos, para comparar. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
