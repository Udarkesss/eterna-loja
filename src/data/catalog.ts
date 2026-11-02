import type { CategoryKind, Localized } from "@/types";

/**
 * EN: Category tree of design V3 (menu Essenza · Ocasiões · Noivas · Acessórios · Modeladores; type groups of
 *     "Gestão → Tipos de peça"). Slugs match the old eterna.co.mz collection handles (/collections/<slug>), so old
 *     links can be redirected. Changes to an existing database are applied by src/server/db/seed.ts (catalogue version).
 * PT: Árvore de categorias do design V3 (menu e grupos de "Tipos de peça"). Os slugs coincidem com as colecções do
 *     eterna.co.mz antigo, para redireccionar os links antigos. Numa base já criada, as mudanças entram pelo seed.ts.
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
  // EN: Active seasonal collection (menu "Essenza"); its page shows Festa / Executiva. PT: Colecção activa (menu "Essenza").
  node("collection", "essenza", "Essenza", "Essenza", {
    description: {
      pt: "Descubra a ESSENZA, a nova colecção ETERNA que celebra a mulher através da elegância, sofisticação, versatilidade e feminilidade, do universo executivo às ocasiões especiais.",
      en: "Discover ESSENZA, the new ETERNA collection celebrating women through elegance, sophistication, versatility and femininity, from the business world to special occasions.",
    },
  }),
  node("department", "roupa-de-festa", "Roupa de Festa", "Party Wear", {
    description: { pt: "Brilho para a noite, do cocktail à gala.", en: "Sparkle for the evening, from cocktail to gala." },
    children: [
      type("vestidos-longos", "Vestidos longos", "Long dresses", "Vestido longo", "Long dress"),
      type("vestidos-cocktail", "Vestidos cocktail", "Cocktail dresses", "Vestido cocktail", "Cocktail dress"),
      type("fatos-cerimonia", "Fatos de cerimónia", "Ceremony suits", "Fato de cerimónia", "Ceremony suit"),
      type("macaoes-festa", "Macacões de festa", "Party jumpsuits", "Macacão de festa", "Party jumpsuit"),
    ],
  }),
  node("department", "roupa-executiva", "Roupa Executiva", "Business Wear", {
    description: { pt: "Corte impecável, do escritório à reunião.", en: "Impeccable tailoring, from the office to the meeting room." },
    children: [
      type("fatos-executivos", "Fatos executivos", "Business suits", "Fato executivo", "Business suit"),
      type("vestidos-executivos", "Vestidos executivos", "Business dresses", "Vestido executivo", "Business dress"),
      type("macaoes-executivos", "Macacões executivos", "Business jumpsuits", "Macacão executivo", "Business jumpsuit"),
      type("blazers-casacos", "Blazers", "Blazers", "Blazer", "Blazer"),
      type("casaquinhos", "Casaquinhos", "Cardigans", "Casaquinho", "Cardigan"),
      type("calcas", "Calças", "Trousers", "Calças", "Trousers"),
      type("saias", "Saias", "Skirts", "Saia", "Skirt"),
      type("blusas", "Blusas", "Blouses", "Blusa", "Blouse"),
    ],
  }),
  node("department", "ocasioes", "Ocasiões", "Occasions", {
    description: {
      pt: "Na ETERNA, cada ocasião merece um look à sua altura. Descubra vestidos, macacões e conjuntos pensados para casamentos, galas, formaturas, eventos corporativos e outras celebrações especiais.",
      en: "At ETERNA, every occasion deserves a look to match. Discover dresses, jumpsuits and sets for weddings, galas, graduations, corporate events and other special celebrations.",
    },
    children: [
      node("occasion", "madrinha-mae-noiva", "Madrinha & Mãe da Noiva", "Bridesmaid & Mother of the Bride"),
      node("occasion", "noivado-lobolo", "Noivado & Lobolo", "Engagement & Lobolo"),
      node("occasion", "evento-corporativo", "Evento Corporativo", "Corporate Event"),
      node("occasion", "gala", "Gala", "Gala"),
      node("occasion", "convidada", "Convidada", "Wedding guest"),
      node("occasion", "finalistas-debutantes", "Finalistas & Debutantes", "Graduation & Debutante"),
    ],
  }),
  node("department", "noivas", "Noivas", "Bridal", {
    description: {
      pt: "Entre a suavidade etérea da THE WHITE COLLECTION e o esplendor da ETERNA PRIVÉE, cada noiva descobre o vestido que traduz os seus sonhos.",
      en: "Between the ethereal softness of THE WHITE COLLECTION and the splendour of ETERNA PRIVÉE, every bride finds the dress that tells her dream.",
    },
    children: [
      node("collection", "white-collection", "The White Collection", "The White Collection", {
        description: { pt: "Leveza etérea e fluidez de cortes clássicos.", en: "Ethereal lightness and the flow of classic cuts." },
      }),
      node("collection", "eterna-privee", "Eterna Privée", "Eterna Privée", {
        description: { pt: "A elegância envolvente de silhuetas mais ajustadas.", en: "The captivating elegance of more fitted silhouettes." },
      }),
      type("vestidos-de-noiva", "Vestidos de noiva", "Wedding dresses", "Vestido de noiva", "Wedding dress"),
      node("department", "acessorios-noiva", "Acessórios de Noiva", "Bridal Accessories", {
        description: { pt: "Véus, tiaras e detalhes.", en: "Veils, tiaras and details." },
        children: [
          type("veus-noiva", "Véus", "Veils", "Véu", "Veil"),
          type("tiaras-noiva", "Tiaras", "Tiaras", "Tiara", "Tiara"),
          type("capas-noiva", "Capas", "Capes", "Capa", "Cape"),
          type("sapatos-noiva", "Sapatos de noiva", "Bridal shoes", "Sapatos de noiva", "Bridal shoes"),
          type("cintos-noiva", "Cintos", "Belts", "Cinto", "Belt"),
          type("pochettes-de-noiva", "Pochettes de noiva", "Bridal clutches", "Pochette de noiva", "Bridal clutch"),
        ],
      }),
    ],
  }),
  node("department", "acessorios", "Acessórios", "Accessories", {
    children: [
      node("department", "acessorios-festa", "Acessórios de Festa", "Party Accessories", {
        children: [
          type("pochettes", "Pochettes", "Clutches", "Pochette", "Clutch"),
          type("fascinators", "Fascinators", "Fascinators", "Fascinator", "Fascinator"),
          type("echarpes", "Echarpes", "Scarves", "Echarpe", "Scarf"),
          type("sapatos-cerimonia", "Sapatos de cerimónia", "Occasion shoes", "Sapatos", "Shoes"),
          type("bijuteria", "Bijuteria", "Jewellery", "Bijuteria", "Jewellery"),
        ],
      }),
      node("department", "acessorios-executivos", "Acessórios Executivos", "Business Accessories", {
        children: [
          type("carteiras", "Carteiras", "Handbags", "Carteira", "Handbag"),
          type("sapatos-executivos", "Sapatos executivos", "Business shoes", "Sapatos executivos", "Business shoes"),
        ],
      }),
    ],
  }),
  node("department", "modeladores", "Modeladores", "Shapewear", {
    children: [
      type("bodys-modeladores", "Bodys", "Shaping bodysuits", "Body modelador", "Shaping bodysuit"),
      type("calcoes-modeladores", "Calções", "Shaping shorts", "Calções modeladores", "Shaping shorts"),
      type("soutiens", "Soutiens", "Bras", "Soutien", "Bra"),
      type("calcinhas-modeladoras", "Calcinhas", "Shaping briefs", "Calcinha modeladora", "Shaping briefs"),
      type("modeladores-bracos", "Modeladores de braços", "Arm shapers", "Modelador de braços", "Arm shaper"),
      type("saias-modeladoras", "Saias modeladoras", "Shaping skirts", "Saia modeladora", "Shaping skirt"),
      type("macaoes-modeladores", "Macacões modeladores", "Shaping jumpsuits", "Macacão modelador", "Shaping jumpsuit"),
    ],
  }),
];

/**
 * EN: Old eterna.co.mz (Shopify) collection handles whose name differs from the category slug here. Every other old
 *     handle that matches a slug maps to itself. Used by the import (which categories a product is in) and by the
 *     redirects of old links (/collections/<handle>). Old collections without an equivalent (Plus Size, Natal…) are left out.
 * PT: Colecções do eterna.co.mz antigo (Shopify) cujo nome é diferente do slug daqui; as restantes que coincidem com um
 *     slug ligam a si mesmas. Usado na importação e nos redireccionamentos dos links antigos. As que não têm
 *     equivalente (Plus Size, Natal…) ficam de fora.
 */
export const OLD_COLLECTIONS: Record<string, string> = {
  "acessorios-1": "acessorios",
  acessorios: "acessorios-festa",
  "convidada-list": "convidada",
  "evento-corporativo-new": "evento-corporativo",
  "finalistas-debutants-new": "finalistas-debutantes",
  "gala-new": "gala",
  "madrinha-mae-da-noiva-new": "madrinha-mae-noiva",
  "noivado-lobolo-new": "noivado-lobolo",
};

/** EN: Every slug in the tree. PT: Todos os slugs da árvore. */
export function categorySlugs(nodes: CategorySeed[] = categoryTree, out: string[] = []): string[] {
  for (const n of nodes) {
    out.push(n.slug);
    if (n.children) categorySlugs(n.children, out);
  }
  return out;
}

/** EN: Category for an old Shopify collection handle, or null. PT: Categoria de uma colecção antiga, ou null. */
export function categoryForOldCollection(handle: string): string | null {
  if (OLD_COLLECTIONS[handle]) return OLD_COLLECTIONS[handle];
  return categorySlugs().includes(handle) ? handle : null;
}

/** EN: Size scale used by the category filter. PT: Escala de tamanhos do filtro de categoria. */
export const SIZE_SCALE = [
  "00US/30EUR/XXS",
  "0US/32EUR/XS",
  "2US/34EUR/XS",
  "4US/36EUR/S",
  "6US/38EUR/S",
  "8US/40EUR/M",
  "10US/42EUR/M",
  "12US/44EUR/L",
  "14US/46EUR/L",
  "16US/48EUR/XL",
  "18US/50EUR/XL",
  "20US/52EUR/XXL",
  "22US/54EUR/XXL",
];
