import type { CategoryKind, Localized } from "@/types";

/**
 * EN: Category tree from the design menu (Noivas · Ocasiões · Beyond Time · Acessórios · Modeladores) and the
 *     product editor (Colecção, Ocasiões). Slugs match the old eterna.co.mz URLs (/produtos/<slug>).
 * PT: Árvore de categorias do menu do design e do editor de produto (Colecção, Ocasiões).
 *     Os slugs coincidem com os endereços do eterna.co.mz antigo (/produtos/<slug>).
 */

export interface CategorySeed {
  slug: string;
  kind: CategoryKind;
  name: Localized;
  singular?: Localized;
  description?: Localized;
  children?: CategorySeed[];
}

const node = (kind: CategoryKind, slug: string, pt: string, en: string, extra: Partial<CategorySeed> = {}): CategorySeed => ({
  kind,
  slug,
  name: { pt, en },
  ...extra,
});

/** EN: A garment type with singular + plural names. PT: Um tipo de peça com nome no singular e plural. */
const type = (slug: string, pt: string, en: string, ptOne: string, enOne: string) =>
  node("type", slug, pt, en, { singular: { pt: ptOne, en: enOne } });

export const categoryTree: CategorySeed[] = [
  node("department", "noivas", "Noivas", "Bridal", {
    description: {
      pt: "Da leveza etérea da The White Collection ao esplendor escultórico da Eterna Privée — cada noiva encontra o vestido que traduz o seu sonho.",
      en: "From the ethereal lightness of The White Collection to the sculptural splendour of Eterna Privée — every bride finds the dress that tells her dream.",
    },
    children: [
      node("collection", "white-collection", "The White Collection", "The White Collection", {
        description: { pt: "Leveza etérea e fluidez.", en: "Ethereal lightness and flow." },
      }),
      node("collection", "eterna-privee", "Eterna Privée", "Eterna Privée", {
        description: { pt: "Silhuetas dramáticas.", en: "Dramatic silhouettes." },
      }),
      node("department", "acessorios-noiva", "Acessórios de Noiva", "Bridal Accessories", {
        description: { pt: "Véus, tiaras e detalhes.", en: "Veils, tiaras and details." },
        children: [
          type("veus-noiva", "Véus", "Veils", "Véu", "Veil"),
          type("tiaras-noiva", "Tiaras", "Tiaras", "Tiara", "Tiara"),
          type("capas-noiva", "Capas", "Capes", "Capa", "Cape"),
          type("sapatos-noiva", "Sapatos de noiva", "Bridal shoes", "Sapatos de noiva", "Bridal shoes"),
          type("cintos-noiva", "Cintos", "Belts", "Cinto", "Belt"),
          type("pochettes-noiva", "Pochettes de noiva", "Bridal clutches", "Pochette de noiva", "Bridal clutch"),
        ],
      }),
    ],
  }),
  node("department", "ocasioes", "Ocasiões", "Occasions", {
    description: {
      pt: "Criações pensadas para acompanhar os grandes momentos da vida.",
      en: "Pieces made for life's great moments.",
    },
    children: [
      node("occasion", "convidada", "Convidada", "Wedding guest", {
        description: {
          pt: "Para casamentos, aniversários e galas: vestidos longos, cocktail e macacões com cortes que valorizam a silhueta e tecidos escolhidos com cuidado.",
          en: "For weddings, birthdays and galas: long dresses, cocktail dresses and jumpsuits with flattering cuts and carefully chosen fabrics.",
        },
      }),
      node("occasion", "evento-corporativo", "Evento Corporativo", "Corporate Event"),
      node("occasion", "finalistas-debutantes", "Finalistas & Debutantes", "Graduation & Debutante"),
      node("occasion", "gala", "Gala", "Gala"),
      node("occasion", "madrinha-mae-noiva", "Madrinha & Mãe da Noiva", "Bridesmaid & Mother of the Bride"),
      node("occasion", "noivado-lobolo", "Noivado & Lobolo", "Engagement & Lobolo"),
    ],
  }),
  node("collection", "beyond-time", "Beyond Time", "Beyond Time", {
    description: {
      pt: "Requinte, sofisticação e intemporalidade para celebrações, eventos e a rotina executiva.",
      en: "Refinement, sophistication and timelessness for celebrations, events and working life.",
    },
    children: [
      type("vestidos", "Vestidos", "Dresses", "Vestido", "Dress"),
      type("vestidos-midi", "Vestidos midi", "Midi dresses", "Vestido midi", "Midi dress"),
      type("vestidos-longos", "Vestidos longos", "Long dresses", "Vestido longo", "Long dress"),
      type("vestidos-cocktail", "Cocktail", "Cocktail", "Vestido cocktail", "Cocktail dress"),
      type("fatos-cerimonia", "Fatos de cerimónia", "Ceremony suits", "Fato de cerimónia", "Ceremony suit"),
      type("macaoes-festa", "Macacões", "Jumpsuits", "Macacão", "Jumpsuit"),
      type("vestidos-executivos", "Vestidos executivos", "Business dresses", "Vestido executivo", "Business dress"),
      type("fatos-executivos", "Fatos executivos", "Business suits", "Fato executivo", "Business suit"),
      type("macaoes-executivos", "Macacões executivos", "Business jumpsuits", "Macacão executivo", "Business jumpsuit"),
      type("blazers-casacos", "Blazers & casacos", "Blazers & coats", "Blazer", "Blazer"),
      type("calcas", "Calças", "Trousers", "Calças", "Trousers"),
      type("saias", "Saias", "Skirts", "Saia", "Skirt"),
      type("blusas", "Blusas", "Blouses", "Blusa", "Blouse"),
    ],
  }),
  node("department", "acessorios", "Acessórios", "Accessories", {
    children: [
      type("pochettes", "Pochettes", "Clutches", "Pochette", "Clutch"),
      type("fascinators", "Fascinators", "Fascinators", "Fascinator", "Fascinator"),
      type("echarpes", "Echarpes", "Scarves", "Echarpe", "Scarf"),
      type("sapatos-cerimonia", "Sapatos de cerimónia", "Occasion shoes", "Sapatos", "Shoes"),
      type("bijuteria", "Bijuteria", "Jewellery", "Bijuteria", "Jewellery"),
      type("carteiras", "Carteiras", "Handbags", "Carteira", "Handbag"),
    ],
  }),
  node("department", "modeladores", "Modeladores", "Shapewear", {
    children: [
      type("bodys-modeladores", "Bodys modeladores", "Shaping bodysuits", "Body modelador", "Shaping bodysuit"),
      type("calcoes-modeladores", "Calções modeladores", "Shaping shorts", "Calções modeladores", "Shaping shorts"),
      type("soutiens", "Soutiens", "Bras", "Soutien", "Bra"),
      type("calcinhas-modeladoras", "Calcinhas modeladoras", "Shaping briefs", "Calcinha modeladora", "Shaping briefs"),
      type("modeladores-bracos", "Modeladores de braços", "Arm shapers", "Modelador de braços", "Arm shaper"),
      type("saias-modeladoras", "Saias modeladoras", "Shaping skirts", "Saia modeladora", "Shaping skirt"),
      type("macaoes-modeladores", "Macacões modeladores", "Shaping jumpsuits", "Macacão modelador", "Shaping jumpsuit"),
    ],
  }),
];

/** EN: Size scale used by the category filter. PT: Escala de tamanhos do filtro de categoria. */
export const SIZE_SCALE = [
  "4US/36EUR/S",
  "6US/38EUR/S",
  "8US/40EUR/M",
  "10US/42EUR/M",
  "12US/44EUR/L",
  "14US/46EUR/L",
  "16US/48EUR/XL",
  "18US/50EUR/XL",
];
