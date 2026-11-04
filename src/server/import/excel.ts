import "server-only";
import { asc, eq } from "drizzle-orm";
import { PALETTE, SIZE_SYSTEMS } from "@/data/palette";
import type { ColorFamily, Localized } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, products, stores } from "../db/schema";
import { getProductForEdit, saveProduct, type ProductInput } from "../admin/products";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";
import { savePublicUpload } from "../uploads";
import { readXlsx, readZip, writeXlsxWithLists } from "../xlsx";

/**
 * EN: "Gestão · Importar" of design V3-G-Importar: an Excel (one row per colour and size; ▾ columns have pick lists) and
 *     a ZIP of photos (one folder per code; the file name says the colour: CODE_colour_01.jpg, no colour = all colours).
 *     Step 1 checks everything and suggests fixes; step 2 imports: new codes are created, existing codes are updated
 *     (stock and prices), pieces without photos are imported as drafts.
 * PT: Importar do V3: um Excel (uma linha por cor e tamanho; colunas ▾ com listas) e um ZIP de fotos (uma pasta por
 *     código; o nome do ficheiro diz a cor). Passo 1 verifica e sugere correcções; passo 2 importa: códigos novos são
 *     criados, os existentes actualizados (stock e preços), peças sem fotos ficam em rascunho.
 */

export const COLUMNS = ["Código", "Nome", "Tipo de peça ▾", "Colecções", "Ocasiões", "Descrição", "Composição", "Preço", "Preço de saldo", "Cor ▾", "Cor 2 ▾", "Tamanho ▾", "Quantidade", "Loja ▾", "Publicar ▾"] as const;

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const slug = (v: string) => fold(v).replace(/ /g, "-");
const ALL_SIZES = [...new Set(Object.values(SIZE_SYSTEMS).flatMap((s) => s.sizes))];

async function reference() {
  const db = await getDb();
  const [cats, storeRows] = await Promise.all([db.select().from(categories).orderBy(asc(categories.position)), db.select({ code: stores.code }).from(stores)]);
  return {
    types: cats.filter((c) => c.kind === "type"),
    collections: cats.filter((c) => c.kind === "collection" && !c.details?.history),
    occasions: cats.filter((c) => c.kind === "occasion"),
    stores: storeRows.map((s) => s.code),
  };
}

/** EN: "Descarregar modelo (.xlsx)" with the pick lists. PT: Modelo com as listas de escolha. */
export async function importTemplate(): Promise<Buffer> {
  const ref = await reference();
  const rows: (string | number | null)[][] = [
    [...COLUMNS],
    ["8G1L7", "Vestido cocktail champanhe", "Vestidos cocktail", "Essenza", "Gala; Convidada", "…", "…", 27500, null, "Champanhe", null, "6US/38EUR/S", 1, "02", "Sim"],
  ];
  return writeXlsxWithLists(
    "Produtos",
    rows,
    [
      { column: 2, title: "Tipo de peça", values: ref.types.map((t) => t.name.pt) },
      { column: 9, title: "Cor", values: PALETTE.map((p) => p[0]) },
      { column: 10, title: "Cor 2", values: PALETTE.map((p) => p[0]) },
      { column: 11, title: "Tamanho", values: ALL_SIZES },
      { column: 13, title: "Loja", values: ref.stores },
      { column: 14, title: "Publicar", values: ["Sim", "Não"] },
    ],
    [12, 30, 22, 18, 24, 30, 24, 12, 14, 14, 14, 16, 12, 8, 10],
  );
}

export interface ImportIssue {
  row: number | null;
  code: string;
  field: string;
  problem: string;
  suggestion: string | null;
  level: "error" | "warning";
}

export interface ImportCheck {
  rows: number;
  created: number;
  updated: number;
  errors: number;
  warnings: number;
  ready: number;
  issues: ImportIssue[];
  photos: number;
  folders: number;
}

type Fix = { row: number; field: string; value: string };

/** EN: Closest name in a list (suggestion "Usar …"). PT: O nome mais próximo numa lista. */
function closest(value: string, options: string[]): string | null {
  const v = fold(value);
  if (!v) return null;
  const exact = options.find((o) => fold(o) === v);
  if (exact) return exact;
  const plural = options.find((o) => fold(o) === `${v}s` || fold(o) === `${v}es` || `${fold(o)}s` === v);
  if (plural) return plural;
  const starts = options.find((o) => fold(o).startsWith(v) || v.startsWith(fold(o)));
  if (starts) return starts;
  const word = options.find((o) => fold(o).split(" ").some((w) => w.length > 3 && v.includes(w)));
  return word ?? null;
}

function sizeSuggestion(value: string): string | null {
  const v = value.toUpperCase().replace(/\s/g, "");
  const exact = ALL_SIZES.find((s) => s.toUpperCase() === v);
  if (exact) return exact;
  const eu = v.match(/(\d{2})(?!US)/)?.[1];
  const byEu = eu ? ALL_SIZES.find((s) => s.includes(`/${eu}EUR/`)) : undefined;
  if (byEu) return byEu;
  const letter = v.match(/X{0,3}[SML]|XS|XXL|XXXL/)?.[0];
  return letter ? (ALL_SIZES.find((s) => s.endsWith(`/${letter}`)) ?? ALL_SIZES.find((s) => s === letter) ?? null) : null;
}

interface Parsed {
  row: number;
  code: string;
  name: string;
  type: string;
  collections: string[];
  occasions: string[];
  description: string;
  composition: string;
  price: number | null;
  sale: number | null;
  color: string;
  color2: string;
  size: string;
  quantity: number;
  store: string;
  publish: boolean;
}

function parse(excel: Buffer, fixes: Fix[]): Parsed[] {
  let rows: string[][];
  try {
    rows = readXlsx(excel);
  } catch {
    throw new AppError("VALIDATION_ERROR", "O ficheiro não é um Excel (.xlsx) válido.", 400);
  }
  const head = (rows[0] ?? []).map((h) => fold(h.replace("▾", "")));
  const col = (name: string) => head.indexOf(fold(name.replace("▾", "")));
  if (col("Código") < 0) throw new AppError("VALIDATION_ERROR", "O Excel precisa das colunas do modelo (Código, Nome, Tipo de peça…). Use o modelo.", 400);
  const num = (v: string) => {
    const t = v.replace(/\s/g, "").replace(/MT$/i, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    return t ? Math.round(Number(t)) : null;
  };
  const list = (v: string) =>
    v
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  return rows
    .slice(1)
    .map((r, i) => {
      const rowNo = i + 2;
      const get = (name: (typeof COLUMNS)[number]) => {
        const fix = fixes.find((f) => f.row === rowNo && f.field === name);
        return (fix ? fix.value : (r[col(name)] ?? "")).trim();
      };
      return {
        row: rowNo,
        code: get("Código").toUpperCase(),
        name: get("Nome"),
        type: get("Tipo de peça ▾"),
        collections: list(get("Colecções")),
        occasions: list(get("Ocasiões")),
        description: get("Descrição").replace(/^…$/, ""),
        composition: get("Composição").replace(/^…$/, ""),
        price: num(get("Preço")),
        sale: num(get("Preço de saldo")),
        color: get("Cor ▾"),
        color2: get("Cor 2 ▾"),
        size: get("Tamanho ▾"),
        quantity: num(get("Quantidade")) ?? 0,
        store: get("Loja ▾").padStart(2, "0"),
        publish: fold(get("Publicar ▾")) !== "nao",
      };
    })
    .filter((p) => p.code);
}

/** EN: Photos in the ZIP: code → colour (or "") → files. PT: Fotos do ZIP: código → cor → ficheiros. */
function photosOf(zip: Buffer | null) {
  const out = new Map<string, { color: string; name: string; data: () => Buffer }[]>();
  if (!zip) return out;
  for (const e of readZip(zip)) {
    if (!/\.(jpe?g|png|webp)$/i.test(e.name) || e.name.startsWith("__MACOSX")) continue;
    const parts = e.name.split("/").filter(Boolean);
    const file = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    const folder = (parts.length > 1 ? parts[parts.length - 2] : file.split("_")[0]).toUpperCase();
    const bits = file.split("_");
    const color = bits.length >= 3 ? bits.slice(1, -1).join(" ") : bits.length === 2 && !/^\d+$/.test(bits[1]) ? bits[1] : "";
    const list = out.get(folder) ?? [];
    list.push({ color, name: e.name, data: e.data });
    out.set(folder, list);
  }
  for (const l of out.values()) l.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** EN: Step 1 · "Carregar e verificar". PT: Passo 1 · verificar. */
export async function checkImport(excel: Buffer, zip: Buffer | null, fixes: Fix[] = []): Promise<ImportCheck> {
  const ref = await reference();
  const rows = parse(excel, fixes);
  const photos = photosOf(zip);
  const db = await getDb();
  const existing = new Set((await db.select({ code: products.code }).from(products)).map((p) => p.code));
  const issues: ImportIssue[] = [];
  const typeNames = ref.types.flatMap((t) => [t.name.pt, t.singular?.pt ?? ""]).filter(Boolean);
  const paletteNames = PALETTE.map((p) => p[0]);
  for (const r of rows) {
    const add = (field: string, problem: string, suggestion: string | null, level: "error" | "warning" = "error") => issues.push({ row: r.row, code: r.code, field, problem, suggestion, level });
    if (!/^[A-Z0-9-]{2,20}$/.test(r.code)) add("Código", `Código “${r.code}” inválido`, null);
    if (!existing.has(r.code) && !r.name) add("Nome", "Sem nome", null);
    if (r.type && !ref.types.some((t) => fold(t.name.pt) === fold(r.type) || fold(t.singular?.pt ?? "") === fold(r.type)))
      add("Tipo de peça ▾", `Tipo “${r.type}” não existe`, closest(r.type, typeNames));
    if (!existing.has(r.code) && !r.type) add("Tipo de peça ▾", "Sem tipo de peça", null);
    for (const c of r.collections) if (!ref.collections.some((x) => fold(x.name.pt) === fold(c))) add("Colecções", `Colecção “${c}” não existe`, closest(c, ref.collections.map((x) => x.name.pt)));
    for (const o of r.occasions) if (!ref.occasions.some((x) => fold(x.name.pt) === fold(o))) add("Ocasiões", `Ocasião “${o}” não existe`, closest(o, ref.occasions.map((x) => x.name.pt)));
    if (!existing.has(r.code) && !(r.price && r.price > 0)) add("Preço", "Sem preço", null);
    if (r.sale !== null && r.price && r.sale >= r.price) add("Preço de saldo", "O preço de saldo tem de ser menor do que o preço", null);
    for (const [field, value] of [["Cor ▾", r.color], ["Cor 2 ▾", r.color2]] as const)
      if (value && !paletteNames.some((p) => fold(p) === fold(value))) add(field, `Cor “${value}” não existe`, closest(value, paletteNames));
    if (r.size && !ALL_SIZES.includes(r.size)) add("Tamanho ▾", `Tamanho “${r.size}” não existe`, sizeSuggestion(r.size));
    if (!r.size) add("Tamanho ▾", "Sem tamanho", null);
    if (!ref.stores.includes(r.store)) add("Loja ▾", `Loja “${r.store}” não existe`, ref.stores[0]);
  }
  const codes = [...new Set(rows.map((r) => r.code))];
  for (const code of codes) if (!photos.has(code) && !existing.has(code)) issues.push({ row: null, code, field: "Fotos", problem: "Sem fotos no ZIP", suggestion: "Importa como rascunho", level: "warning" });
  const bad = new Set(issues.filter((i) => i.level === "error").map((i) => i.code));
  return {
    rows: rows.length,
    created: codes.filter((c) => !existing.has(c)).length,
    updated: codes.filter((c) => existing.has(c)).length,
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length,
    ready: codes.filter((c) => !bad.has(c)).length,
    issues,
    photos: [...photos.values()].reduce((n, l) => n + l.length, 0),
    folders: photos.size,
  };
}

/**
 * EN: Step 2 · "Importar N produtos": products with errors are skipped; "publish" publishes only those with photos (and
 *     "Publicar = Sim").
 * PT: Passo 2 · importar: produtos com erros ficam de fora; "publicar" só publica os que têm fotos (e "Publicar = Sim").
 */
export async function runImport(staff: StaffContext, excel: Buffer, zip: Buffer | null, fixes: Fix[], mode: "draft" | "publish") {
  const check = await checkImport(excel, zip, fixes);
  const bad = new Set(check.issues.filter((i) => i.level === "error").map((i) => i.code));
  const ref = await reference();
  const rows = parse(excel, fixes).filter((r) => !bad.has(r.code));
  const photos = photosOf(zip);
  const db = await getDb();
  const byCode = new Map<string, Parsed[]>();
  for (const r of rows) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);
  const typeOf = (name: string) => ref.types.find((t) => fold(t.name.pt) === fold(name) || fold(t.singular?.pt ?? "") === fold(name));
  const palette = (name: string) => PALETTE.find((p) => fold(p[0]) === fold(name));
  const storeCodes = new Map((await db.select({ id: stores.id, code: stores.code }).from(stores)).map((x) => [x.id, x.code]));
  let created = 0;
  let updated = 0;
  for (const [code, lines] of byCode) {
    const first = lines[0];
    const [found] = await db.select({ id: products.id }).from(products).where(eq(products.code, code));
    const current = found ? await getProductForEdit(found.id) : null;
    // EN: Colours: palette names; "Cor 2" makes a combination ("Preto e Dourado"). PT: "Cor 2" faz uma combinação.
    const colorKey = (r: Parsed) => (r.color ? slug(r.color2 ? `${r.color} e ${r.color2}` : r.color) : null);
    const colors = new Map<string, { key: string; name: Localized; hex: string | null; family: ColorFamily | null }>(
      (current?.product.colors ?? []).map((c) => [c.key, { key: c.key, name: c.name, hex: c.hex, family: c.family }]),
    );
    for (const r of lines) {
      const key = colorKey(r);
      if (!key || colors.has(key)) continue;
      const a = palette(r.color);
      const b = r.color2 ? palette(r.color2) : undefined;
      colors.set(key, {
        key,
        name: { pt: b ? `${a?.[0]} e ${b[0]}` : (a?.[0] ?? r.color), en: b ? `${a?.[1]} and ${b[1]}` : (a?.[1] ?? r.color) },
        hex: a?.[2] ?? null,
        family: a?.[3] ?? null,
      });
    }
    // EN: Units per colour, size and store: the Excel sets them; other rows stay. PT: O Excel define as unidades; o resto fica.
    const storeCode = (id: string | null) => storeCodes.get(id ?? "") ?? "02";
    const variants: ProductInput["variants"] = (current?.variants ?? []).map((v) => ({ id: v.id, size: v.size, color: v.color, storeCode: storeCode(v.storeId), stock: v.stock }));
    for (const r of lines) {
      const key = colorKey(r);
      const hit = variants.find((v) => v.size === r.size && v.color === key && v.storeCode === r.store);
      if (hit) hit.stock = r.quantity;
      else variants.push({ size: r.size, color: key, storeCode: r.store, stock: r.quantity });
    }
    // EN: Photos: the ZIP replaces the photos of this code. PT: O ZIP substitui as fotos deste código.
    let images: ProductInput["images"] = (current?.images ?? []).map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? { pt: code, en: code }, color: i.color }));
    const files = photos.get(code);
    if (files?.length) {
      images = [];
      for (const f of files) {
        const key = f.color ? [...colors.keys()].find((k) => k === slug(f.color) || k.startsWith(`${slug(f.color)}-`)) ?? null : null;
        const ext = f.name.split(".").pop()!.toLowerCase();
        const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        const url = await savePublicUpload(new File([new Uint8Array(f.data())], `${slug(code)}.${ext}`, { type }), "products");
        const cname = key ? colors.get(key)?.name : null;
        images.push({ url, alt: { pt: [code, cname?.pt].filter(Boolean).join(" · "), en: [code, cname?.en].filter(Boolean).join(" · ") }, color: key });
      }
    }
    const type = first.type ? typeOf(first.type) : null;
    const wantsPublish = mode === "publish" && lines.every((r) => r.publish) && images.length > 0;
    const keepCollections = current ? [current.product.collectionId, ...current.categoryIds.filter((c) => ref.collections.some((x) => x.id === c))].filter((x): x is string => !!x) : [];
    const collectionIds = [...new Set([...keepCollections, ...first.collections.map((n) => ref.collections.find((x) => fold(x.name.pt) === fold(n))?.id).filter((x): x is string => !!x)])];
    const keepOccasions = current ? current.categoryIds.filter((c) => ref.occasions.some((x) => x.id === c)) : [];
    const occasionIds = [...new Set([...keepOccasions, ...first.occasions.map((n) => ref.occasions.find((x) => fold(x.name.pt) === fold(n))?.id).filter((x): x is string => !!x)])];
    const p = current?.product;
    await saveProduct(staff, {
      id: p?.id,
      code,
      name: first.name ? { pt: first.name, en: p?.name.en && p.name.pt === first.name ? p.name.en : first.name } : (p?.name ?? { pt: code, en: code }),
      description: first.description ? { pt: first.description, en: p?.description.en || first.description } : (p?.description ?? { pt: "", en: "" }),
      composition: first.composition ? { pt: first.composition, en: p?.composition?.en || first.composition } : (p?.composition ?? null),
      price: first.price ?? p?.price ?? 0,
      salePrice: first.sale ?? (first.price ? null : (p?.salePrice ?? null)),
      status: wantsPublish ? "published" : (p?.status ?? "draft"),
      publishAt: null,
      isNew: p?.isNew ?? true,
      seoTitle: p?.seoTitle ?? null,
      typeId: type?.id ?? p?.typeId ?? null,
      collectionIds,
      occasionIds,
      fitting: p?.fitting ?? type?.slug === "vestidos-de-noiva",
      colors: [...colors.values()],
      variants,
      images,
    });
    if (current) updated++;
    else created++;
  }
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Produtos importados (Excel + ZIP)", detail: `${created} novos · ${updated} actualizados · ${bad.size} com erros` });
  return { created, updated, skipped: bad.size };
}

