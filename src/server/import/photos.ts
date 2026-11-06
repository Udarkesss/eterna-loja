import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { COLOR_FAMILIES } from "@/types";
import sharp from "sharp";
import { z } from "zod";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, orderLines, productCategories, productImages, productVariants, products, reservations, stores } from "../db/schema";
import { AppError } from "../errors";
import { accessOf, can, type StaffContext } from "../staff/access";
import { deletePublicFile, savePublicBuffer } from "../uploads";
import { readZip } from "../xlsx";

/**
 * EN: "Produtos → Importar → Fotos de uma pasta". The browser reads Eterna's photo folder (Imagens/Editadas and
 *     Imagens/Não Editadas, file names = product code), shrinks each photo and sends it one by one; nothing of the
 *     original folder is changed. Rules agreed with the owner (2026-11-06):
 *     - Shopify (the store's reality) decides which products exist: photos go to the product with the same code
 *       (exact code first, then the code without the last letters: "11291B" → "11291", other angles of the piece).
 *     - Edited photos replace the product's photos; when a product has no edited photo, the unedited ones are used.
 *     - Edited photos of a code that is not in the store create that product as a draft ("no armazém": price, texts
 *       and stock to fill in the back-office). Unedited photos never create products.
 *     - The Word tables in "Tabelas" (REF · MARCA/DESCRIÇÃO · TAM · COR · PREÇO) give new products their name, colour,
 *       sizes (one row = one piece) and price; without a table row the product has no price and stays a draft.
 *     - Imported photos are marked (sourceUrl "pasta:…") so a later Shopify import keeps them.
 * PT: "Produtos → Importar → Fotos de uma pasta". O browser lê a pasta de fotos da Eterna (nome do ficheiro = código),
 *     reduz cada foto e envia uma a uma; a pasta original não muda. Regras combinadas com a dona (06-11-2026):
 *     - O Shopify (a realidade da loja) decide que produtos existem: as fotos vão para o produto com o mesmo código
 *       (primeiro o código exacto, depois sem as últimas letras: "11291B" → "11291", outros ângulos da peça).
 *     - As fotos editadas substituem as do produto; sem editada, usam-se as não editadas.
 *     - As editadas de um código que não está na loja criam o produto em rascunho ("no armazém": preço, textos e
 *       stock a preencher na gestão). As não editadas nunca criam produtos.
 *     - As tabelas Word em "Tabelas" dão aos produtos novos o nome, a cor, os tamanhos (uma linha = uma peça) e o preço;
 *       sem linha na tabela o produto fica sem preço e em rascunho.
 *     - As fotos importadas ficam marcadas ("pasta:…"), para uma importação do Shopify posterior as manter.
 */

const CODE = /^[A-Z0-9][A-Z0-9-]{0,39}$/;
const MAX_PHOTOS = 12;
const SIZE_TOKEN = /^(\d{1,2}W?|XXS|XS|S|M|L|XL|XXL|XXXL)$/;

const groupSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CODE),
  folder: z.string().trim().min(1).max(80),
  edited: z.boolean(),
  sizes: z.array(z.string().trim().toUpperCase().regex(SIZE_TOKEN)).max(20),
});
export const planInputSchema = z.object({
  groups: z.array(groupSchema).max(12_000),
  // EN: Codes of the Word tables ("lista de produtos"). PT: Códigos das tabelas Word.
  tableCodes: z.array(z.string().trim().toUpperCase().regex(CODE)).max(20_000),
});
export type PhotoGroup = z.infer<typeof groupSchema>;

export interface PhotoPlan {
  /** EN: raw code of the files → product code in the store (or null). PT: código dos ficheiros → código do produto. */
  resolved: Record<string, string | null>;
  /** EN: Store products found, with their current photo sources. PT: Produtos encontrados e as fontes das fotos actuais. */
  products: Record<string, { name: string; sources: (string | null)[] }>;
  /** EN: Per folder, the piece type and store used for new products. PT: Por pasta, o tipo e a loja dos produtos novos. */
  folders: Record<string, { typeId: string | null; typeSlug: string | null; typeName: string | null; store: string }>;
  /** EN: Store products that keep their photos (no file in the folder). PT: Produtos da loja sem nenhum ficheiro na pasta. */
  untouched: string[];
  /**
   * EN: Products that are not in Shopify, nor in the edited photos, nor in the tables (to remove, owner 2026-11-06).
   * PT: Produtos que não estão no Shopify, nem nas fotos editadas, nem nas tabelas (a retirar, dona 06-11-2026).
   */
  orphans: { id: string; code: string; name: string; history: boolean }[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const singularish = (s: string) => norm(s).replace(/\b(\w+?)(oes|aes)\b/g, "$1ao").replace(/\b(\w{3,}?)s\b/g, "$1");

/** EN: Code without the last 1-2 letters (other angles of the same piece). PT: Código sem as últimas letras. */
export function baseCode(code: string): string {
  const b = code.replace(/[A-H]{1,2}$/, "");
  return b.length >= 3 && b !== code && /\d$/.test(b) ? b : code;
}

export async function planPhotoImport({ groups, tableCodes }: z.infer<typeof planInputSchema>): Promise<PhotoPlan> {
  const db = await getDb();
  const rows = await db.select({ id: products.id, code: products.code, name: products.name, typeId: products.typeId, sourceId: products.sourceId, status: products.status }).from(products);
  const byCode = new Map(rows.map((r) => [r.code.toUpperCase(), r]));
  const resolve = (code: string) => (byCode.has(code) ? code : byCode.has(baseCode(code)) ? baseCode(code) : null);

  const resolved: PhotoPlan["resolved"] = {};
  for (const g of groups) resolved[g.code] = resolve(g.code);
  const found = [...new Set(Object.values(resolved).filter((c): c is string => !!c))];
  const ids = found.map((c) => byCode.get(c)!.id);

  const images = ids.length
    ? await db.select({ productId: productImages.productId, sourceUrl: productImages.sourceUrl }).from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position))
    : [];
  const variants = ids.length ? await db.select({ productId: productVariants.productId, storeId: productVariants.storeId }).from(productVariants).where(inArray(productVariants.productId, ids)) : [];
  const out: PhotoPlan["products"] = {};
  for (const c of found) {
    const p = byCode.get(c)!;
    out[c] = { name: p.name.pt, sources: images.filter((i) => i.productId === p.id).map((i) => i.sourceUrl) };
  }

  // EN: Type and store of each folder = what most of its products already have. PT: Tipo e loja = o da maioria.
  const types = await db.select({ id: categories.id, slug: categories.slug, name: categories.name, singular: categories.singular }).from(categories).where(eq(categories.kind, "type"));
  const storeRows = await db.select({ id: stores.id, code: stores.code }).from(stores).orderBy(asc(stores.position));
  const folders: PhotoPlan["folders"] = {};
  for (const folder of [...new Set(groups.filter((g) => g.edited).map((g) => g.folder))]) {
    const inFolder = [...new Set(groups.filter((g) => g.folder === folder && resolved[g.code]).map((g) => byCode.get(resolved[g.code]!)!))];
    const count = <T,>(list: T[]) => [...list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>())].sort((a, b) => b[1] - a[1]);
    const [topType] = count(inFolder.map((p) => p.typeId).filter((t): t is string => !!t));
    let typeId = topType && topType[1] >= inFolder.length * 0.6 ? topType[0] : null;
    if (!typeId) typeId = types.find((t) => [t.name.pt, t.singular?.pt].some((n) => n && singularish(n) === singularish(folder)))?.id ?? null;
    const productIds = new Set(inFolder.map((p) => p.id));
    const [topStore] = count(variants.filter((v) => productIds.has(v.productId) && v.storeId).map((v) => v.storeId!));
    const type = types.find((t) => t.id === typeId);
    folders[folder] = {
      typeId,
      typeSlug: type?.slug ?? null,
      typeName: type ? (type.singular?.pt ?? type.name.pt) : null,
      store: storeRows.find((s) => s.id === topStore?.[0])?.code ?? (/noiva/i.test(folder) ? (storeRows.find((s) => s.code === "22")?.code ?? storeRows[0]?.code) : storeRows[0]?.code) ?? "02",
    };
  }

  const touched = new Set(found);
  const untouched = rows.filter((r) => !touched.has(r.code.toUpperCase())).map((r) => r.code);

  // EN: Keep = from Shopify, or with an edited photo, or in a table (exact code or without the last letters).
  // PT: Fica = vem do Shopify, ou tem foto editada, ou está numa tabela.
  const edited = new Set(groups.filter((g) => g.edited).map((g) => resolved[g.code]).filter((c): c is string => !!c));
  const listed = new Set(tableCodes.flatMap((c) => [c, baseCode(c)]));
  const candidates = rows.filter((r) => {
    const code = r.code.toUpperCase();
    return r.status !== "archived" && !r.sourceId?.startsWith("shopify:") && !edited.has(code) && !listed.has(code) && !listed.has(baseCode(code));
  });
  const candidateIds = candidates.map((r) => r.id);
  const sold = candidateIds.length ? await db.selectDistinct({ id: orderLines.productId }).from(orderLines).where(and(isNotNull(orderLines.productId), inArray(orderLines.productId, candidateIds))) : [];
  const reserved = candidateIds.length ? await db.selectDistinct({ id: reservations.productId }).from(reservations).where(and(isNotNull(reservations.productId), inArray(reservations.productId, candidateIds))) : [];
  const history = new Set([...sold, ...reserved].map((r) => r.id));
  const orphans = candidates.map((r) => ({ id: r.id, code: r.code, name: r.name.pt, history: history.has(r.id) })).sort((a, b) => a.code.localeCompare(b.code));
  return { resolved, products: out, folders, untouched, orphans };
}

// ── Tables / Tabelas ──────────────────────────────────────────────────

export interface TableRow {
  code: string;
  desc: string;
  size: string;
  color: string;
  price: number | null;
}

const xmlText = (xml: string) =>
  (xml.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * EN: Reads the piece rows of a Word table (.docx): header row with "REF", then REF · MARCA/DESCRIÇÃO · TAM · COR · PREÇO.
 * PT: Lê as linhas das peças de uma tabela Word: cabeçalho com "REF", depois REF · MARCA/DESCRIÇÃO · TAM · COR · PREÇO.
 */
export function readTables(docx: Buffer): TableRow[] {
  const entry = readZip(docx).find((e) => e.name === "word/document.xml");
  if (!entry) throw new AppError("VALIDATION_ERROR", "Este ficheiro não é um documento Word.", 400);
  const xml = entry.data().toString("utf8");
  const out: TableRow[] = [];
  for (const table of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []) {
    let header: string[] | null = null;
    for (const row of table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
      const cells = (row.match(/<w:tc(?: [^>]*)?>[\s\S]*?<\/w:tc>/g) ?? []).map(xmlText);
      if (cells.slice(0, 3).some((c) => /^REF\.?$/i.test(c))) {
        header = cells.map((c) => c.toUpperCase().replace(/\.$/, ""));
        continue;
      }
      if (!header) continue;
      const cols = header;
      const get = (...names: string[]) => cells[cols.findIndex((h) => names.includes(h))] ?? "";
      const code = get("REF").replace(/\s+/g, "").toUpperCase();
      if (!CODE.test(code)) continue;
      const price = get("PREÇO").replace(/\D/g, "");
      out.push({ code, desc: get("MARCA", "DESCRIÇÃO").slice(0, 120), size: get("TAM").slice(0, 20), color: get("COR", "CÔR").slice(0, 60), price: price ? Number(price) : null });
      if (out.length > 20_000) return out;
    }
  }
  return out;
}

// ── Photos / Fotos ────────────────────────────────────────────────────

function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
const slugOf = (code: string) => code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * EN: Saves one photo (already shrunk by the browser) as WebP under a fixed name, so repeating replaces the same file.
 * PT: Guarda uma foto (já reduzida pelo browser) em WebP com nome fixo, para uma repetição substituir o mesmo ficheiro.
 */
export async function savePhoto(code: string, source: string, file: File): Promise<string> {
  if (!CODE.test(code) || !source || source.length > 300) throw new AppError("VALIDATION_ERROR", "Dados da foto inválidos.", 400);
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 1_500_000) throw new AppError("VALIDATION_ERROR", "Foto inválida ou grande demais.", 400);
  const data = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1400, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return savePublicBuffer(data, "products", `pasta-${slugOf(code)}-${shortHash(source)}.webp`, "image/webp");
}

const OUR_URL = /^(\/uploads\/products\/pasta-[a-z0-9-]+\.webp|https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/products\/pasta-[a-z0-9-]+\.webp)$/;

export const commitSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CODE),
  photos: z.array(z.object({ url: z.string().regex(OUR_URL), source: z.string().min(1).max(300) })).min(1).max(MAX_PHOTOS),
  // EN: Only for codes not in the store (edited photos). PT: Só para códigos fora da loja (fotos editadas).
  create: z
    .object({
      typeId: z.string().uuid().nullable(),
      store: z.string().max(10),
      name: z.object({ pt: z.string().trim().min(1).max(120), en: z.string().trim().min(1).max(120) }),
      colors: z
        .array(
          z.object({
            key: z.string().regex(/^[a-z0-9_]{1,60}$/),
            name: z.object({ pt: z.string().max(60), en: z.string().max(60) }),
            hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
            family: z.enum(COLOR_FAMILIES).nullable(),
          }),
        )
        .max(4),
      price: z.number().int().min(0).max(10_000_000),
      variants: z
        .array(z.object({ size: z.string().trim().min(1).max(40), stock: z.number().int().min(0).max(999), color: z.string().regex(/^[a-z0-9_]{1,60}$/).nullable() }))
        .max(40),
      // EN: Only complete products, and only for people who may publish. PT: Só completos e só quem pode publicar.
      publish: z.boolean(),
    })
    .optional(),
});
export type CommitInput = z.infer<typeof commitSchema>;

/**
 * EN: Replaces a product's photos with the imported ones (or creates the draft product). Old stored files are deleted.
 * PT: Substitui as fotos do produto pelas importadas (ou cria o produto em rascunho). Os ficheiros antigos são apagados.
 */
export async function commitPhotos(staff: StaffContext, input: CommitInput): Promise<"replaced" | "created"> {
  const { code, photos, create } = commitSchema.parse(input);
  const db = await getDb();
  let [product] = await db.select({ id: products.id, code: products.code, name: products.name }).from(products).where(eq(products.code, code)).limit(1);
  let result: "replaced" | "created" = "replaced";

  if (!product) {
    if (!create) throw new AppError("VALIDATION_ERROR", `O produto ${code} não existe.`, 400);
    const type = create.typeId ? (await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, create.typeId), eq(categories.kind, "type"))))[0] : undefined;
    const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.code, create.store));
    const variants = [...new Map(create.variants.map((v) => [`${v.color ?? ""}|${v.size}`, v])).values()];
    const complete = create.price > 0 && !!type && variants.some((v) => v.stock > 0);
    const single = create.colors.length === 1 ? create.colors[0].key : null;
    product = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({
          code,
          slug: slugOf(code),
          name: create.name,
          description: { pt: "", en: "" },
          price: create.price,
          colors: create.colors,
          typeId: type?.id ?? null,
          status: create.publish && complete && can(staff, "products.publish") ? "published" : "draft",
        })
        .returning({ id: products.id, code: products.code, name: products.name });
      if (type) await tx.insert(productCategories).values({ productId: p.id, categoryId: type.id }).onConflictDoNothing();
      if (variants.length) {
        await tx
          .insert(productVariants)
          .values(
            variants.map((v, position) => ({
              productId: p.id,
              sku: [slugOf(code), v.color && create.colors.length > 1 ? slugOf(v.color) : "", slugOf(v.size)].filter(Boolean).join("-").toUpperCase(),
              color: v.color ?? single,
              size: v.size,
              storeId: store?.id ?? null,
              stock: v.stock,
              position,
            })),
          )
          .onConflictDoNothing();
      }
      return p;
    });
    result = "created";
  }

  const current = await db.select({ id: productImages.id, url: productImages.url }).from(productImages).where(eq(productImages.productId, product.id));
  const alt = { pt: `${product.name.pt} · ${product.code}`, en: `${product.name.en} · ${product.code}` };
  await db.transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.productId, product.id));
    await tx.insert(productImages).values(photos.map((p, position) => ({ productId: product.id, url: p.url, sourceUrl: `pasta:${p.source}`, alt, position })));
  });
  const kept = new Set(photos.map((p) => p.url));
  for (const old of current) if (!kept.has(old.url)) await deletePublicFile(old.url).catch(() => undefined);
  return result;
}

/**
 * EN: Removes the products listed as "orphans" (checked again here). Products with orders or reservations are archived
 *     (they leave the store, their history stays); the others are deleted with their stored photos.
 * PT: Retira os produtos da lista "a retirar" (verificados outra vez aqui). Os que têm encomendas ou reservas são
 *     arquivados (saem da loja, o histórico fica); os outros são apagados com as fotos guardadas.
 */
export async function removeOrphans(staff: StaffContext, ids: string[]): Promise<{ deleted: number; archived: number }> {
  if (accessOf(staff, "products.publish") !== "T") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const list = z.array(z.string().uuid()).max(5000).parse(ids);
  if (!list.length) return { deleted: 0, archived: 0 };
  const db = await getDb();
  const rows = (await db.select({ id: products.id, code: products.code, sourceId: products.sourceId }).from(products).where(inArray(products.id, list))).filter((r) => !r.sourceId?.startsWith("shopify:"));
  const rowIds = rows.map((r) => r.id);
  if (!rowIds.length) return { deleted: 0, archived: 0 };
  const sold = await db.selectDistinct({ id: orderLines.productId }).from(orderLines).where(inArray(orderLines.productId, rowIds));
  const reserved = await db.selectDistinct({ id: reservations.productId }).from(reservations).where(inArray(reservations.productId, rowIds));
  const keep = new Set([...sold, ...reserved].map((r) => r.id));
  const archive = rowIds.filter((id) => keep.has(id));
  const remove = rowIds.filter((id) => !keep.has(id));
  const photos = remove.length ? await db.select({ url: productImages.url }).from(productImages).where(inArray(productImages.productId, remove)) : [];
  await db.transaction(async (tx) => {
    if (archive.length) await tx.update(products).set({ status: "archived" }).where(inArray(products.id, archive));
    if (remove.length) await tx.delete(products).where(inArray(products.id, remove));
  });
  for (const ph of photos) await deletePublicFile(ph.url).catch(() => undefined);
  await audit({
    actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName },
    action: "Produtos fora do Shopify retirados",
    detail: `${remove.length} apagados, ${archive.length} arquivados: ${rows.map((r) => r.code).join(", ")}`.slice(0, 300),
  });
  return { deleted: remove.length, archived: archive.length };
}

export async function auditPhotoImport(staff: StaffContext, summary: string) {
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Importação de fotos", detail: summary.slice(0, 300) });
}
