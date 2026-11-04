import type { Localized } from "@/types";

/**
 * EN: Times of the year of design V3 (Gestão · Conteúdo do site → Épocas do ano): yearly dates, the visual effect over
 *     the page, the home section before or after the collection (text right / left / above / below; photo, slides or
 *     video; colours; four pieces) and the top-bar line. Everything goes away by itself after the dates.
 * PT: Épocas do ano do V3: datas anuais, o efeito por cima da página, a secção no Início antes ou depois da colecção
 *     (texto à direita / esquerda / em cima / em baixo; foto, slides ou vídeo; cores; quatro peças) e a frase da barra
 *     do topo. Tudo sai sozinho no fim das datas.
 */

export interface SeasonColors {
  band: string;
  desc: string;
  title: string;
  accent: string;
  text: string;
  button: string;
  buttonText: string;
}

export interface Season {
  id: string;
  on: boolean;
  name: Localized;
  from: string; // EN: "11-20" (month-day, every year). PT: mês-dia, todos os anos.
  to: string; // "12-31"
  effect: "sparkles" | "snow" | "hearts" | "none";
  placement: "before" | "after" | "none";
  textSide: "right" | "left" | "top" | "bottom";
  media: "photo" | "slides" | "video";
  images: string[];
  video: string;
  badge: Localized;
  title: Localized; // EN: *word* = accent italic. PT: *palavra* = itálico de destaque.
  text: Localized;
  button: Localized;
  href: string;
  bar: Localized;
  codes: string[]; // EN: four pieces. PT: quatro peças.
  colors: SeasonColors;
}

export const SEASON_COLORS: SeasonColors = { band: "#E9D8CF", desc: "#FAF7F2", title: "#2B2320", accent: "#8E1F2B", text: "#655047", button: "#1C1917", buttonText: "#FAF7F2" };

const L = (pt: string, en: string): Localized => ({ pt, en });

export const SEASONS_DEFAULT: Season[] = [
  {
    id: "natal",
    on: true,
    name: L("Natal & Réveillon", "Christmas & New Year"),
    from: "11-20",
    to: "12-31",
    effect: "sparkles",
    placement: "after",
    textSide: "right",
    media: "photo",
    images: ["/images/v3/s-festa.webp"],
    video: "",
    badge: L("Edição especial · dentro da Essenza", "Special edition · within Essenza"),
    title: L("Natal & *Réveillon*", "Christmas & *New Year*"),
    text: L(
      "Brilho, veludo e vermelho para as festas de fim de ano: vestidos para a noite de Natal e para entrar no ano novo.",
      "Sparkle, velvet and red for the end-of-year parties: dresses for Christmas night and to welcome the new year.",
    ),
    button: L("Ver as peças de festa", "See the party pieces"),
    href: "category:roupa-de-festa",
    bar: L("Natal & Réveillon · peças de festa para fechar o ano", "Christmas & New Year · party pieces to close the year"),
    codes: [],
    colors: SEASON_COLORS,
  },
  {
    id: "namorados",
    on: true,
    name: L("Dia dos Namorados", "Valentine's Day"),
    from: "02-01",
    to: "02-14",
    effect: "hearts",
    placement: "before",
    textSide: "right",
    media: "photo",
    images: ["/images/v3/s-convidada.webp"],
    video: "",
    badge: L("Dia dos Namorados", "Valentine's Day"),
    title: L("Para um dia *especial*", "For a *special* day"),
    text: L("Vestidos para um jantar a dois.", "Dresses for a dinner for two."),
    button: L("Ver as peças", "See the pieces"),
    href: "category:convidada",
    bar: L("Dia dos Namorados · vestidos para um dia especial", "Valentine's Day · dresses for a special day"),
    codes: [],
    colors: SEASON_COLORS,
  },
  {
    id: "mae",
    on: false,
    name: L("Dia da Mãe", "Mother's Day"),
    from: "04-20",
    to: "05-03",
    effect: "none",
    placement: "after",
    textSide: "right",
    media: "photo",
    images: ["/images/v3/s-festa.webp"],
    video: "",
    badge: L("Dia da Mãe", "Mother's Day"),
    title: L("Para a *mãe*", "For *mum*"),
    text: L("Peças para oferecer.", "Pieces to give."),
    button: L("Ver as peças", "See the pieces"),
    href: "category:madrinha-mae-noiva",
    bar: L("Dia da Mãe · peças para oferecer", "Mother's Day · pieces to give"),
    codes: [],
    colors: SEASON_COLORS,
  },
];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const seasonDates = (s: Pick<Season, "from" | "to">) => {
  const [m1, d1] = s.from.split("-").map(Number);
  const [m2, d2] = s.to.split("-").map(Number);
  return m1 === m2 ? `${d1} – ${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
};

/** EN: Today (Maputo "MM-DD") inside the yearly dates, also across New Year. PT: Hoje dentro das datas, também na passagem de ano. */
export const inSeason = (s: Pick<Season, "from" | "to">, today: string) => (s.from <= s.to ? today >= s.from && today <= s.to : today >= s.from || today <= s.to);
