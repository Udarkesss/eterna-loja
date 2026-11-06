import { categoryForOldCollection, categoryTree, type CategorySeed } from "@/data/catalog";
import type { ColorFamily, Localized, ProductColor } from "@/types";
import { parseCsv } from "./csv";
import { englishDescription } from "./shopify-en";

/**
 * EN: Shopify product export (Produtos → Exportar → CSV) and the old site's published data → Eterna products. Pure
 *     code: runs in the browser to show the report before importing, and the server saves the result
 *     (src/server/import/shopify.ts).
 *     - One product per Handle; Title is the reference (e.g. "9J1L6").
 *     - Old-site collections (or Type and tags) → type, collection and occasions (src/data/catalog.ts).
 *     - Sizes "10" → "10US/42EUR/M" (category filter scale); colours "PRETO" → Preto / Black with swatch.
 *     - Photos are the "Image Src" links (Shopify CDN); the server downloads them.
 * PT: Exportação de produtos do Shopify e dados publicados do site antigo → produtos Eterna. Código puro: corre no
 *     browser para mostrar o relatório antes de importar, e o servidor grava o resultado.
 *     - Um produto por Handle; o Title é a referência.
 *     - Colecções do site antigo (ou Type e etiquetas) → tipo, colecção e ocasiões.
 *     - Tamanhos "10" → "10US/42EUR/M"; cores "PRETO" → Preto / Black com amostra.
 *     - As fotos são os links "Image Src" (CDN do Shopify); o servidor descarrega-as.
 */

export interface ImportItem {
  sourceId: string; // "shopify:<handle>"
  code: string;
  name: Localized;
  description: Localized;
  price: number;
  salePrice: number | null;
  type: string | null;
  collection: string | null;
  links: string[]; // EN: occasions and departments. PT: ocasiões e departamentos.
  colors: ProductColor[];
  // EN: available = sold out or not on the old site (null when unknown). PT: esgotado ou não no site antigo (null = sem dado).
  variants: { sku: string; color: string | null; size: string; available: boolean | null }[];
  images: { url: string; color: string | null }[];
  publish: boolean; // EN: goes to the shop (published there, photo and price). PT: vai para a loja.
  origin: "csv" | "site" | "both"; // EN: where the data came from. PT: de onde vieram os dados.
  warnings: string[];
}

export interface ImportReport {
  items: ImportItem[];
  skipped: { code: string; reason: string }[];
  types: { shopify: string; slug: string | null; count: number }[];
  unmappedTags: { tag: string; count: number }[];
  unknownColors: string[];
  imageCount: number;
  oldSite: {
    visible: number; // EN: published on the old site. PT: publicados no site antigo.
    both: number; // EN: in the CSV and on the old site. PT: no CSV e no site antigo.
    siteOnly: number; // EN: on the old site, not in the CSV (newer). PT: só no site antigo (mais recentes que o CSV).
    csvOnly: number; // EN: only in the CSV (drafts). PT: só no CSV (rascunhos).
    collections: { handle: string; title: string; count: number; slug: string | null }[];
  } | null;
}

// ── Categories / Categorias ───────────────────────────────────────────

const TYPE_MAP: Record<string, string | null> = {
  "vestidos longos": "vestidos-longos",
  "vestidos cocktail": "vestidos-cocktail",
  pochettes: "pochettes",
  "vestidos de noiva": "vestidos-de-noiva",
  "fatos executivos": "fatos-executivos",
  "vestidos executivos": "vestidos-executivos",
  bijouteria: "bijuteria",
  bijuteria: "bijuteria",
  blusas: "blusas",
  fascinators: "fascinators",
  "blazers & casacos": "blazers-casacos",
  casaquinhos: "casaquinhos",
  calças: "calcas",
  "macacões de festa": "macaoes-festa",
  "fatos de cerimónia": "fatos-cerimonia",
  "sapatos de cerimónia": "sapatos-cerimonia",
  "sapatos executivos": "sapatos-executivos",
  "véus de noiva": "veus-noiva",
  "tiaras de noiva": "tiaras-noiva",
  "sapatos de noiva": "sapatos-noiva",
  "macacões executivos": "macaoes-executivos",
  "calções modeladores": "calcoes-modeladores",
  carteiras: "carteiras",
  "calcinhas modeladoras": "calcinhas-modeladoras",
  "pochettes de noiva": "pochettes-de-noiva",
  "capas de noiva": "capas-noiva",
  soutiens: "soutiens",
  "cintos de noiva": "cintos-noiva",
  "bodys modeladores": "bodys-modeladores",
  echarpes: "echarpes",
  saias: "saias",
  "modeladores de braços": "modeladores-bracos",
  "saias modeladoras": "saias-modeladoras",
  "macacões modeladores": "macaoes-modeladores",
};
const SKIP_TYPES = ["serviço"]; // EN: fitting booking was a product on Shopify. PT: a marcação de prova era um produto.

const TAG_MAP: Record<string, string> = {
  "convidada-lista": "convidada",
  convidada: "convidada",
  gala: "gala",
  "eventos-lista": "evento-corporativo",
  "evento-corporativo": "evento-corporativo",
  "madrinha-lista": "madrinha-mae-noiva",
  "madrinha-mae-da-noiva": "madrinha-mae-noiva",
  "noivado-lista": "noivado-lobolo",
  "noivado & lobolo": "noivado-lobolo",
  "finalistas-lista": "finalistas-debutantes",
  "finalistas & debutantes": "finalistas-debutantes",
  "white collection": "white-collection",
  "eterna privée": "eterna-privee",
  essenza: "essenza",
};
// EN: When a product is in several, its main collection is the first here. PT: Colecção principal, por esta ordem.
const COLLECTION_PRIORITY = ["white-collection", "eterna-privee", "essenza"];
// EN: Tags that only repeat the type or department (no extra meaning). PT: Etiquetas que só repetem o tipo/departamento.
const SILENT_TAGS = ["roupa de festa", "acessórios", "executivos", "noivas", "modeladores"];

function flatten(nodes: CategorySeed[], parent: string | null = null, out = new Map<string, { node: CategorySeed; parent: string | null }>()) {
  for (const n of nodes) {
    out.set(n.slug, { node: n, parent });
    if (n.children) flatten(n.children, n.slug, out);
  }
  return out;
}
const CATS = flatten(categoryTree);

// ── Colours / Cores ───────────────────────────────────────────────────

type C = [pt: string, en: string, hex: string | null, family: ColorFamily | null];
const COLORS: Record<string, C> = {
  PRETO: ["Preto", "Black", "#141414", "black"],
  VERMELHO: ["Vermelho", "Red", "#B3202A", "red"],
  AZUL: ["Azul", "Blue", "#2F4E8C", "blue"],
  VERDE: ["Verde", "Green", "#2E6B4A", "green"],
  NAVY: ["Azul-marinho", "Navy", "#1F2A44", "blue"],
  BRANCO: ["Branco", "White", "#FFFFFF", "off_white"],
  ROSA: ["Rosa", "Pink", "#E8A3B8", "fuchsia"],
  MARFIM: ["Marfim", "Ivory", "#F4EFE2", "off_white"],
  DOURADO: ["Dourado", "Gold", "#C8A24A", "gold"],
  DOURADA: ["Dourado", "Gold", "#C8A24A", "gold"],
  VINHO: ["Vinho", "Burgundy", "#6B1E2E", "red"],
  PRATEADO: ["Prateado", "Silver", "#C0C0C4", null],
  CHAMPANHE: ["Champanhe", "Champagne", "#E9D9B6", "beige"],
  LARANJA: ["Laranja", "Orange", "#E07B39", null],
  AMARELO: ["Amarelo", "Yellow", "#E8C547", "gold"],
  ESTAMPADO: ["Estampado", "Print", null, null],
  "ESTAMPADO COLORIDO": ["Estampado colorido", "Multicolour print", null, null],
  CINZENTO: ["Cinzento", "Grey", "#8A8A8A", null],
  CINZA: ["Cinzento", "Grey", "#8A8A8A", null],
  BEGE: ["Bege", "Beige", "#D8C3A5", "beige"],
  LILÁS: ["Lilás", "Lilac", "#B9A2D0", "fuchsia"],
  LILAS: ["Lilás", "Lilac", "#B9A2D0", "fuchsia"],
  CASTANHO: ["Castanho", "Brown", "#6B4A35", "beige"],
  PÉROLA: ["Pérola", "Pearl", "#EDE6DA", "off_white"],
  PEROLA: ["Pérola", "Pearl", "#EDE6DA", "off_white"],
  NUDE: ["Nude", "Nude", "#E3C4A8", "beige"],
  NATURAL: ["Natural", "Natural", "#E6D8BF", "beige"],
  BLUSH: ["Blush", "Blush", "#EBC1BC", "fuchsia"],
  CREME: ["Creme", "Cream", "#F3E9D2", "off_white"],
  ROXO: ["Roxo", "Purple", "#5E2B7E", "fuchsia"],
  VIOLETA: ["Violeta", "Violet", "#7F3FBF", "fuchsia"],
  LAVANDA: ["Lavanda", "Lavender", "#B7A6D9", "fuchsia"],
  "VERDE-CLARO": ["Verde-claro", "Light green", "#9CC9A0", "green"],
  "VERDE-SECO": ["Verde-seco", "Olive", "#7A7D4A", "green"],
  "VERDE-MENTA": ["Verde-menta", "Mint", "#A8E0C4", "green"],
  "AZUL-CLARO": ["Azul-claro", "Light blue", "#9EC3E6", "blue"],
  "AZUL CLARO": ["Azul-claro", "Light blue", "#9EC3E6", "blue"],
  "AZUL ESVERDEADO": ["Azul esverdeado", "Teal", "#2F7F7A", "blue"],
  ROSEGOLD: ["Rose gold", "Rose gold", "#B76E79", "gold"],
  "ROSA-DOURADO": ["Rose gold", "Rose gold", "#B76E79", "gold"],
  "ROSA-VELHO": ["Rosa-velho", "Dusty pink", "#C48A8F", "fuchsia"],
  "ROSA-CHOQUE": ["Rosa-choque", "Hot pink", "#E0218A", "fuchsia"],
  FERRUGEM: ["Ferrugem", "Rust", "#A0442A", "red"],
  FRAMBOESA: ["Framboesa", "Raspberry", "#B3245A", "fuchsia"],
  MOSTARDA: ["Mostarda", "Mustard", "#C9A227", "gold"],
  BRONZE: ["Bronze", "Bronze", "#A97142", "gold"],
  SALMÃO: ["Salmão", "Salmon", "#F08F7A", null],
  // EN: Jewellery designs listed as "colour" on Shopify. PT: Modelos de bijuteria registados como "cor".
  CORACAO: ["Coração", "Heart", null, null],
  HEART: ["Coração", "Heart", null, null],
  CRUZ: ["Cruz", "Cross", null, null],
  FLOR: ["Flor", "Flower", null, null],
  FLORES: ["Flores", "Flowers", null, null],
  RELOGIO: ["Relógio", "Watch", null, null],
  TORCIDA: ["Torcida", "Twisted", null, null],
  PEDRAS: ["Pedras", "Stones", null, null],
  ARGOLA: ["Argola", "Hoop", null, null],
  ARGOLAS: ["Argolas", "Hoops", null, null],
  LUA: ["Lua", "Moon", null, null],
  SOL: ["Sol", "Sun", null, null],
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** EN: "PRETO/BRANCO", "VERDE ESTAMPADO" → colour with swatch from the first part. PT: Cor com amostra da primeira parte. */
export function toColor(raw: string, unknown: Set<string>): ProductColor {
  const v = raw.trim().toUpperCase().replace("STAMPADO", "ESTAMPADO").replace("ESTAMPAMP.", "ESTAMPADO").replace("EESTAMPADO", "ESTAMPADO");
  const one = (part: string): C | null => {
    if (COLORS[part]) return COLORS[part];
    const m = part.match(/^(.+?) ESTAMPADO$/);
    if (m && COLORS[m[1]]) {
      const [pt, en, hex, family] = COLORS[m[1]];
      return [`${pt} estampado`, `${en} print`, hex, family];
    }
    const m2 = part.match(/^(\S+) (DOURADO)$/);
    if (m2 && COLORS[m2[1]]) return [`${COLORS[m2[1]][0]} dourado`, `Gold ${COLORS[m2[1]][1].toLowerCase()}`, COLORS[m2[1]][2], COLORS[m2[1]][3]];
    return null;
  };
  const parts = v.split("/").map((p) => p.trim()).filter(Boolean);
  const found = parts.map(one);
  if (found.some((f) => !f)) unknown.add(v);
  const pt = parts.map((p, i) => found[i]?.[0] ?? p.charAt(0) + p.slice(1).toLowerCase()).map((n, i) => (i ? n.toLowerCase() : n)).join("/");
  const en = parts.map((p, i) => found[i]?.[1] ?? p.charAt(0) + p.slice(1).toLowerCase()).map((n, i) => (i ? n.toLowerCase() : n)).join("/");
  return { key: slugify(v), name: { pt, en }, hex: found[0]?.[2] ?? null, family: found[0]?.[3] ?? null };
}

// ── Sizes / Tamanhos ──────────────────────────────────────────────────

const US_SCALE: Record<string, string> = {
  "00": "00US/30EUR/XXS",
  "0": "0US/32EUR/XS",
  "2": "2US/34EUR/XS",
  "4": "4US/36EUR/S",
  "6": "6US/38EUR/S",
  "8": "8US/40EUR/M",
  "10": "10US/42EUR/M",
  "12": "12US/44EUR/L",
  "14": "14US/46EUR/L",
  "16": "16US/48EUR/XL",
  "18": "18US/50EUR/XL",
  "20": "20US/52EUR/XXL",
  "22": "22US/54EUR/XXL",
};

export function toSize(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v || v === "OS" || v === "DEFAULT TITLE" || v === "ÚNICO") return "Único";
  if (US_SCALE[v]) return US_SCALE[v];
  if (v === "MEDIO" || v === "MÉDIO") return "M";
  return v;
}

// ── Texts / Textos ────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * EN: Shopify titles are only the reference, so the name is built: "Vestido longo preto" / "Black long dress".
 *     Handbags use the short first sentence of the description ("Carteira flor").
 * PT: No Shopify o título é só a referência, por isso o nome é construído: "Vestido longo preto".
 *     As carteiras usam a primeira frase curta da descrição ("Carteira flor").
 */
export function buildName(type: string | null, text: string, colors: ProductColor[]): Localized {
  const node = type ? CATS.get(type)?.node : null;
  const one = node?.singular ?? { pt: "Peça", en: "Piece" };
  const color = colors.length === 1 ? colors[0].name : null;
  const en = color ? `${cap(color.en.toLowerCase())} ${one.en.toLowerCase()}` : one.en;
  const first = text.split(/[.\n]/)[0].trim();
  if (first.length <= 40 && /^carteira\b/i.test(first)) {
    const base = cap(first.toLowerCase());
    return { pt: color && !base.includes(color.pt.toLowerCase()) ? `${base} ${agree(color.pt, "f", false)}` : base, en };
  }
  const [g, plural] = GENDER[type ?? ""] ?? ["m", false];
  return { pt: color ? `${one.pt} ${agree(color.pt, g, plural)}` : one.pt, en };
}

/** EN: Grammatical gender and plural of each type's noun. PT: Género e número do nome de cada tipo. */
const GENDER: Record<string, ["m" | "f", boolean]> = {
  pochettes: ["f", false],
  "pochettes-de-noiva": ["f", false],
  bijuteria: ["f", false],
  carteiras: ["f", false],
  blusas: ["f", false],
  saias: ["f", false],
  "saias-modeladoras": ["f", false],
  "calcinhas-modeladoras": ["f", false],
  "tiaras-noiva": ["f", false],
  "capas-noiva": ["f", false],
  echarpes: ["f", false],
  calcas: ["f", true],
  "sapatos-cerimonia": ["m", true],
  "sapatos-noiva": ["m", true],
  "calcoes-modeladores": ["m", true],
  "sapatos-executivos": ["m", true],
};

// EN: Colour nouns used as adjectives do not change. PT: Cores-substantivo não mudam ("vestido vinho").
const INVARIABLE = ["vinho", "marfim", "rosa", "nude", "champanhe", "laranja", "creme", "blush", "salmão", "lilás", "bege", "natural", "bronze", "mostarda", "ferrugem", "framboesa", "lavanda", "pérola", "gold"];

/**
 * EN: Portuguese colour agreement: "preto" → "preta" / "pretos" / "pretas"; "azul" → "azuis". Only the last word of
 *     each part changes ("azul-claro" → "azul-clara").
 * PT: Concordância da cor: "preto" → "preta" / "pretos" / "pretas"; "azul" → "azuis". Só muda a última palavra.
 */
function agree(colorPt: string, g: "m" | "f", plural: boolean): string {
  const word = (w: string) => {
    if (INVARIABLE.includes(w)) return w;
    if (w.endsWith("o")) return w.slice(0, -1) + (g === "f" ? "a" : "o") + (plural ? "s" : "");
    if (!plural) return w;
    if (w === "azul") return "azuis";
    return w.endsWith("e") ? `${w}s` : w;
  };
  return colorPt
    .toLowerCase()
    .split("/")
    .map((part) => part.replace(/[a-zà-ú]+$/, word))
    .join("/");
}

// ── Old site (Shopify storefront) / Site antigo ───────────────────────

/**
 * EN: What the old site (eterna.co.mz on Shopify) publishes, read from its public storefront data
 *     (/products.json and /collections/<handle>/products.json). Only published products appear there.
 * PT: O que o site antigo (eterna.co.mz no Shopify) publica, lido dos dados públicos da loja. Só lá aparecem os
 *     produtos publicados.
 */
export interface OldSite {
  products: OldProduct[];
  collections: { handle: string; title: string }[];
  members: Record<string, string[]>; // EN: collection handle → product handles. PT: colecção → produtos.
}
export interface OldProduct {
  handle: string;
  title: string;
  body_html: string | null;
  product_type: string;
  tags: string[] | string;
  options: { name: string; position: number }[];
  variants: { id: number; option1: string | null; option2: string | null; option3: string | null; sku: string | null; price: string; compare_at_price: string | null; available: boolean }[];
  images: { src: string; position: number; variant_ids: number[] }[];
}

/** EN: One old-site product as Shopify CSV rows, so both sources share the same reader. PT: Produto como linhas do CSV. */
function rowsFromOld(p: OldProduct): Record<string, string>[] {
  const opt = (i: number) => p.options.find((o) => o.position === i)?.name ?? "";
  const imageOf = new Map<number, string>();
  for (const img of p.images) for (const id of img.variant_ids ?? []) imageOf.set(id, img.src);
  const rows: Record<string, string>[] = [];
  const n = Math.max(p.variants.length, p.images.length, 1);
  for (let i = 0; i < n; i++) {
    const v = p.variants[i];
    const img = [...p.images].sort((a, b) => a.position - b.position)[i];
    rows.push({
      Handle: p.handle,
      Title: i ? "" : p.title,
      "Body (HTML)": i ? "" : (p.body_html ?? ""),
      Type: i ? "" : p.product_type,
      Tags: i ? "" : Array.isArray(p.tags) ? p.tags.join(", ") : p.tags,
      Status: i ? "" : "active",
      "Option1 Name": v ? opt(1) : "",
      "Option1 Value": v?.option1 ?? "",
      "Option2 Name": v ? opt(2) : "",
      "Option2 Value": v?.option2 ?? "",
      "Option3 Name": v ? opt(3) : "",
      "Option3 Value": v?.option3 ?? "",
      "Variant SKU": v?.sku ?? "",
      "Variant Price": v?.price ?? "",
      "Variant Compare At Price": v?.compare_at_price ?? "",
      "Variant Image": v ? (imageOf.get(v.id) ?? "") : "",
      "Variant Available": v ? (v.available ? "true" : "false") : "",
      "Image Src": img?.src ?? "",
      "Image Position": img ? String(img.position) : "",
    });
  }
  return rows;
}

// ── Main / Principal ──────────────────────────────────────────────────

const lc = (s: string) => s.trim().toLowerCase();
const num = (s: string) => {
  const n = Number.parseFloat((s || "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/**
 * EN: Reads the Shopify CSV export and, when given, the old site's published data:
 *     - a product published on the old site uses that (newer) data, its collections there decide its type, collection
 *       and occasions, sizes marked sold out get stock 0, and it is published here if it has a photo and a price;
 *     - a product only in the CSV (not published on the old site) is mapped from its type and tags and stays a draft;
 *     - without the old site, Shopify's own status decides (active with photo and price → published).
 * PT: Lê o CSV do Shopify e, se existirem, os dados publicados do site antigo:
 *     - produto publicado no site antigo: usa esses dados (mais recentes); as colecções de lá decidem o tipo, a colecção
 *       e as ocasiões; tamanhos esgotados ficam com stock 0; publica-se aqui se tiver foto e preço;
 *     - produto só no CSV (não publicado no site antigo): tipo e etiquetas; fica em rascunho;
 *     - sem o site antigo, decide o estado do Shopify (activo com foto e preço → publicado).
 */
export function readShopify(csvText: string | null, old: OldSite | null = null): ImportReport {
  const csvRows = csvText ? parseCsv(csvText) : [];
  if (csvText && (!csvRows.length || !("Handle" in csvRows[0]) || !("Variant SKU" in csvRows[0]))) {
    throw new Error("Este ficheiro não parece uma exportação de produtos do Shopify (faltam as colunas Handle e Variant SKU).");
  }
  const groups = new Map<string, { rows: Record<string, string>[]; origin: ImportItem["origin"] }>();
  for (const r of csvRows) {
    const h = r.Handle.trim();
    if (!h) continue;
    if (!groups.has(h)) groups.set(h, { rows: [], origin: "csv" });
    groups.get(h)!.rows.push(r);
  }
  const memberOf = new Map<string, string[]>();
  for (const [handle, list] of Object.entries(old?.members ?? {})) for (const p of list) memberOf.set(p, [...(memberOf.get(p) ?? []), handle]);
  for (const p of old?.products ?? []) groups.set(p.handle, { rows: rowsFromOld(p), origin: groups.has(p.handle) ? "both" : "site" });

  const items: ImportItem[] = [];
  const skipped: ImportReport["skipped"] = [];
  const typeCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const unknownColors = new Set<string>();
  const usedSkus = new Set<string>();
  let imageCount = 0;

  for (const [handle, { rows: g, origin }] of groups) {
    const head = g[0];
    const code = (head.Title || handle).trim().toUpperCase();
    const shopifyType = head.Type.trim();
    typeCount.set(shopifyType, (typeCount.get(shopifyType) ?? 0) + 1);
    if (SKIP_TYPES.includes(lc(shopifyType))) {
      skipped.push({ code: head.Title.trim(), reason: "Serviço, não é uma peça (a prova já tem página própria)" });
      continue;
    }
    const warnings: string[] = [];
    const onOldSite = origin !== "csv";

    // EN: Categories: the old site's collections when published there; otherwise type and tags.
    // PT: Categorias: as colecções do site antigo quando lá está publicado; senão o tipo e as etiquetas.
    const fromSite = (memberOf.get(handle) ?? []).map(categoryForOldCollection).filter((s): s is string => !!s);
    const typeFromField = TYPE_MAP[lc(shopifyType)] ?? null;
    const siteTypes = fromSite.filter((s) => CATS.get(s)?.node.kind === "type");
    const type = siteTypes.includes(typeFromField ?? "") ? typeFromField : (siteTypes[0] ?? typeFromField);
    if (!type) warnings.push(`Tipo "${shopifyType || "—"}" sem correspondência`);
    const tagSlugs = new Set<string>();
    for (const t of head.Tags.split(",").map((x) => x.trim()).filter(Boolean)) {
      const slug = TAG_MAP[lc(t)];
      if (slug) tagSlugs.add(slug);
      else if (!SILENT_TAGS.includes(lc(t)) && lc(t) !== lc(shopifyType) && !TYPE_MAP[lc(t)]) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
    const all = new Set(fromSite.length ? fromSite : [...tagSlugs]);
    if (type) all.add(type);
    const collection = COLLECTION_PRIORITY.find((c) => all.has(c)) ?? null;
    const links = [...all].filter((s) => s !== type && s !== collection);

    // EN: Variants. Some rows have photo links in the option columns (old import): recover them.
    // PT: Variantes. Algumas linhas têm links de fotos nas colunas das opções (importação antiga): recuperar.
    const colorsByKey = new Map<string, ProductColor>();
    const variants: ImportItem["variants"] = [];
    const strayImages: string[] = [];
    let price = 0;
    let compareAt = 0;
    for (const r of g) {
      const opts = ["1", "2", "3"].map((i) => ({ name: lc(r[`Option${i} Name`] ?? ""), value: (r[`Option${i} Value`] ?? "").trim() }));
      for (const o of opts) {
        if (o.name.startsWith("http")) strayImages.push(r[`Option${opts.indexOf(o) + 1} Name`].trim());
        if (o.value.startsWith("http")) strayImages.push(o.value);
      }
      const isVariant = !!(r["Variant SKU"] || r["Variant Price"] || opts.some((o) => o.value && !o.value.startsWith("http")));
      if (!isVariant) continue;
      let size = "";
      let color: ProductColor | null = null;
      for (const o of opts) {
        if (!o.value || o.value.startsWith("http")) continue;
        if (["size", "tamanho", "title"].includes(o.name)) size = o.value;
        else if (["color", "cor"].includes(o.name)) color = toColor(o.value, unknownColors);
      }
      if (!size) {
        const m = strayImages.join(" ").match(/-sz(\d+)/);
        size = m ? m[1] : "";
      }
      if (color) colorsByKey.set(color.key, color);
      const sizeLabel = toSize(size);
      let sku = (r["Variant SKU"] || `${code}-${color?.key ?? "u"}-${sizeLabel}`).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-");
      while (usedSkus.has(sku)) sku += "-2";
      usedSkus.add(sku);
      const available = r["Variant Available"] === "true" ? true : r["Variant Available"] === "false" ? false : null;
      variants.push({ sku, color: color?.key ?? null, size: sizeLabel, available });
      price ||= num(r["Variant Price"]);
      compareAt ||= num(r["Variant Compare At Price"]);
    }
    if (strayImages.length) warnings.push("Linha com colunas desalinhadas no Shopify (rever tamanhos e cores)");
    if (!variants.length) variants.push({ sku: code, color: null, size: "Único", available: null });

    // EN: Photos in Shopify order; a variant photo gets that variant's colour. PT: Fotos pela ordem do Shopify.
    const variantImage = new Map<string, string | null>();
    for (const r of g) {
      if (!r["Variant Image"]) continue;
      const opts = ["1", "2", "3"].find((i) => ["color", "cor"].includes(lc(r[`Option${i} Name`] ?? "")));
      variantImage.set(r["Variant Image"].trim(), opts && r[`Option${opts} Value`] ? toColor(r[`Option${opts} Value`], unknownColors).key : null);
    }
    const seen = new Set<string>();
    const images = g
      .filter((r) => r["Image Src"])
      .sort((a, b) => num(a["Image Position"]) - num(b["Image Position"]))
      .map((r) => r["Image Src"].trim())
      .concat(strayImages)
      .filter((u) => /^https:\/\//.test(u) && !seen.has(u) && !!seen.add(u))
      .map((url) => ({ url, color: variantImage.get(url) ?? null }));
    imageCount += images.length;
    if (!images.length) warnings.push("Sem fotografias");

    const colors = [...colorsByKey.values()];
    const text = htmlToText(head["Body (HTML)"]);
    const name = buildName(type, text, colors);
    if (!price) warnings.push("Sem preço (fica em rascunho)");

    const activeOnShopify = lc(head.Status || (head.Published === "true" ? "active" : "draft")) === "active";
    items.push({
      sourceId: `shopify:${handle}`,
      code,
      name,
      // EN: Shopify has Portuguese only; repeated paragraphs have English (shopify-en.ts). PT: O Shopify só tem português.
      description: { pt: text, en: englishDescription(text, name, code, colors) },
      price: compareAt > price ? compareAt : price,
      salePrice: compareAt > price ? price : null,
      type,
      collection,
      links,
      colors,
      variants,
      images,
      publish: (old ? onOldSite : activeOnShopify) && price > 0 && images.length > 0,
      origin,
      warnings,
    });
  }

  // EN: Cross-check with the old site. PT: Cruzamento com o site antigo.
  const visible = new Set((old?.products ?? []).map((p) => p.handle));
  const oldCollections = (old?.collections ?? []).map((c) => ({
    handle: c.handle,
    title: c.title,
    count: old?.members[c.handle]?.length ?? 0,
    slug: categoryForOldCollection(c.handle),
  }));

  return {
    items,
    skipped,
    types: [...typeCount]
      .map(([shopify, count]) => ({ shopify, slug: TYPE_MAP[lc(shopify)] ?? null, count }))
      .sort((a, b) => b.count - a.count),
    unmappedTags: [...tagCount].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    unknownColors: [...unknownColors].sort(),
    imageCount,
    oldSite: old
      ? {
          visible: visible.size,
          both: items.filter((i) => i.origin === "both").length,
          siteOnly: items.filter((i) => i.origin === "site").length,
          csvOnly: items.filter((i) => i.origin === "csv").length,
          collections: oldCollections,
        }
      : null,
  };
}

/** EN: Kept for callers that only have the CSV. PT: Para quem só tem o CSV. */
export const readShopifyExport = (csvText: string) => readShopify(csvText, null);

/** EN: Category name for the report. PT: Nome da categoria para o relatório. */
export const categoryName = (slug: string | null) => (slug ? (CATS.get(slug)?.node.name.pt ?? slug) : null);
