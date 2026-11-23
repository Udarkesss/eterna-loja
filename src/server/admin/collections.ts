import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { toMaputo } from "@/lib/time";
import type { CategoryDetails, Localized } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productCategories, productImages, products, productVariants } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";
import { readXlsx, readZip } from "../xlsx";
import { savePublicUpload } from "../uploads";
import { collectionPieceIds, fixedProductIds, putInStore, sendToWarehouse } from "./warehouse";

/**
 * EN: "Gestão · Colecções" of design V3: seasonal collections (one active at a time), special editions (inside a
 *     collection) and the archive of old collections (covers only, never on the site). Activating a collection replaces
 *     the previous one in the menu, the hero button, the home "Colecção" section and the "entrada" message; the previous
 *     one goes to the archive with its pieces kept. Price campaigns live in src/server/admin/campaigns.ts.
 * PT: Colecções do V3: colecções sazonais (uma activa de cada vez), edições especiais (dentro de uma colecção) e o
 *     arquivo das colecções antigas (só capas, nunca no site). Activar uma colecção substitui a anterior no menu, no
 *     botão do hero, na secção "Colecção" e na mensagem da entrada; a anterior passa ao arquivo com as peças guardadas.
 */

type Row = typeof categories.$inferSelect;
const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** EN: Seasonal and special-edition collections (not the bridal ones). PT: Sazonais e edições especiais (não as de noivas). */
export const isSeasonalTree = (r: Row, rows: Row[]) => r.kind === "collection" && (!r.parentId || rows.find((x) => x.id === r.parentId)?.kind === "collection");
export const statusOf = (r: Row): "draft" | "active" | "archived" =>
  r.details?.active ? "active" : r.details?.history || r.details?.status === "archived" ? "archived" : "draft";

export function plannedDates(d: CategoryDetails | null) {
  if (!d?.startsOn || !d?.endsOn) return "[datas]";
  const [, m1, d1] = d.startsOn.split("-").map(Number);
  const [, m2, d2] = d.endsOn.split("-").map(Number);
  return m1 === m2 ? `${d1} – ${d2} ${SHORT[m2 - 1]}` : `${d1} ${SHORT[m1 - 1]} – ${d2} ${SHORT[m2 - 1]}`;
}

export async function listCollectionsAdmin() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const lines = rows.filter((r) => r.slug === "roupa-de-festa" || r.slug === "roupa-executiva");
  const typeLine = new Map<string, string>();
  for (const t of rows.filter((r) => r.kind === "type")) {
    const line = lines.find((l) => l.id === t.parentId);
    if (line) typeLine.set(t.id, line.slug);
  }
  const seasonal = rows.filter((r) => isSeasonalTree(r, rows));
  const ids = seasonal.map((r) => r.id);
  const linked = ids.length
    ? await db
        .select({ categoryId: productCategories.categoryId, typeId: products.typeId, status: products.status, productId: products.id })
        .from(productCategories)
        .innerJoin(products, eq(products.id, productCategories.productId))
        .where(inArray(productCategories.categoryId, ids))
    : [];
  const main = ids.length ? await db.select({ id: products.id, collectionId: products.collectionId, typeId: products.typeId }).from(products).where(inArray(products.collectionId, ids)) : [];
  const piecesOf = (id: string) => {
    const set = new Map<string, string | null>();
    for (const l of linked) if (l.categoryId === id) set.set(l.productId, l.typeId);
    for (const m of main) if (m.collectionId === id) set.set(m.id, m.typeId);
    const festa = [...set.values()].filter((t) => t && typeLine.get(t) === "roupa-de-festa").length;
    const exec = [...set.values()].filter((t) => t && typeLine.get(t) === "roupa-executiva").length;
    return { total: set.size, festa, exec };
  };
  const list = seasonal.map((r) => {
    const d = r.details ?? {};
    const parent = r.parentId ? rows.find((x) => x.id === r.parentId) : null;
    const n = piecesOf(r.id);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name.pt,
      label: d.number ? `Colecção ${d.number} · ${r.name.pt}` : r.name.pt,
      kind: d.history ? "Colecção sazonal" : d.collectionType === "special" || parent ? "Edição especial" : "Colecção sazonal",
      inside: parent ? parent.name.pt : null,
      year: d.year ?? (d.startsOn ? Number(d.startsOn.slice(0, 4)) : null),
      dates: plannedDates(d),
      startsOn: d.startsOn ?? null,
      endsOn: d.endsOn ?? null,
      pieces: d.history ? "só capas" : r.parentId ? `${n.total} / —` : `${n.festa} / ${n.exec}`,
      piecesTotal: n.total,
      status: statusOf(r),
      history: !!d.history,
      imageUrl: r.imageUrl,
    };
  });
  return { list: list.filter((x) => !x.history), history: list.filter((x) => x.history) };
}

export async function getCollectionForEdit(id: string) {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const row = rows.find((r) => r.id === id);
  if (!row || !isSeasonalTree(row, rows)) throw new AppError("NOT_FOUND", "Colecção não encontrada.", 404);
  const ids = [row.id];
  const linked = await db.select({ productId: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, ids));
  const mains = await db.select({ id: products.id }).from(products).where(eq(products.collectionId, row.id));
  const pieceIds = [...new Set([...linked.map((l) => l.productId), ...mains.map((m) => m.id)])];
  const active = rows.find((r) => isSeasonalTree(r, rows) && r.details?.active && !r.parentId && r.id !== row.id);
  const special = rows.filter((r) => r.parentId === row.id && r.kind === "collection");
  return { row, pieceIds, activeName: active?.name.pt ?? null, special: special.map((s) => ({ id: s.id, name: s.name.pt, dates: plannedDates(s.details), imageUrl: s.imageUrl })), parents: rows.filter((r) => r.kind === "collection" && !r.parentId && isSeasonalTree(r, rows) && r.id !== row.id && !r.details?.history).map((r) => ({ id: r.id, name: r.name.pt })) };
}

/** EN: Pieces for the collection editor (by line and type). PT: Peças para o editor da colecção (por linha e tipo). */
export async function collectionPieces(pieceIds: string[]) {
  const db = await getDb();
  const rows = await db.select().from(categories);
  const all = await db.select({ id: products.id, code: products.code, typeId: products.typeId, status: products.status }).from(products).where(inArray(products.status, ["published", "draft", "scheduled"]));
  const variants = await db.select({ productId: productVariants.productId, stock: productVariants.stock }).from(productVariants);
  const images = await db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).orderBy(asc(productImages.position));
  const imageOf = new Map<string, string>();
  for (const i of images) if (!imageOf.has(i.productId)) imageOf.set(i.productId, i.url);
  const stock = new Map<string, number>();
  for (const v of variants) stock.set(v.productId, (stock.get(v.productId) ?? 0) + v.stock);
  const lineOf = (typeId: string | null) => {
    const t = rows.find((r) => r.id === typeId);
    const p = t?.parentId ? rows.find((r) => r.id === t.parentId) : null;
    return p?.slug ?? null;
  };
  return all.map((p) => ({
    id: p.id,
    code: p.code,
    typeId: p.typeId,
    type: rows.find((r) => r.id === p.typeId)?.name.pt ?? "—",
    line: lineOf(p.typeId),
    status: p.status === "draft" ? "Armazém" : (stock.get(p.id) ?? 0) === 0 ? "Sem stock" : "Publicada",
    inCollection: pieceIds.includes(p.id),
    image: imageOf.get(p.id) ?? null,
  }));
}

export interface CollectionInput {
  id?: string;
  collectionType: "seasonal" | "special";
  parentId: string | null;
  name: string;
  number: string;
  year: number;
  startsOn: string | null;
  endsOn: string | null;
  description: string;
  message: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string | null;
  history: boolean;
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function seasonText(startsOn: string | null, endsOn: string | null): Localized | undefined {
  if (!startsOn || !endsOn) return undefined;
  const m1 = Number(startsOn.slice(5, 7)) - 1;
  const m2 = Number(endsOn.slice(5, 7)) - 1;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  return { pt: `${cap(MONTHS_PT[m1])} a ${MONTHS_PT[m2]} · na Loja 2 e no site`, en: `${MONTHS_EN[m1]} to ${MONTHS_EN[m2]} · at Store 2 and online` };
}

export async function saveCollection(staff: StaffContext, input: CollectionInput): Promise<string> {
  const db = await getDb();
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("VALIDATION_ERROR", "Escreva o nome da colecção.", 400);
  const existing = input.id ? (await db.select().from(categories).where(eq(categories.id, input.id)))[0] : null;
  if (input.id && !existing) throw new AppError("NOT_FOUND", "Colecção não encontrada.", 404);
  const keep = existing?.details ?? {};
  const details: CategoryDetails = {
    ...keep,
    collectionType: input.collectionType,
    number: input.number || undefined,
    year: input.year || undefined,
    startsOn: input.startsOn || undefined,
    endsOn: input.endsOn || undefined,
    history: input.history || undefined,
    edition: input.number ? { pt: `Colecção ${input.number} · ${input.year}`, en: `Collection ${input.number} · ${input.year}` } : keep.edition,
    season: seasonText(input.startsOn, input.endsOn) ?? keep.season,
    lines: keep.lines ?? (input.collectionType === "seasonal" ? ["roupa-de-festa", "roupa-executiva"] : undefined),
    message: input.message ? { pt: input.message, en: keep.message?.en ?? input.message } : undefined,
    buttonText: input.buttonText ? { pt: input.buttonText, en: keep.buttonText?.en ?? input.buttonText } : undefined,
    buttonLink: input.buttonLink || "auto",
    status: keep.active ? "active" : (keep.status ?? (input.history ? "archived" : "draft")),
  };
  const values = {
    name: { pt: name, en: existing?.name.en && existing.name.pt === name ? existing.name.en : name },
    description: input.description ? { pt: input.description, en: existing?.description?.en ?? input.description } : null,
    imageUrl: input.imageUrl,
    parentId: input.collectionType === "special" ? input.parentId : null,
    details,
    updatedAt: new Date(),
  };
  let id = input.id;
  if (existing) {
    await db.update(categories).set(values).where(eq(categories.id, existing.id));
  } else {
    let slug = slugify(`${name}${input.history && input.year ? `-${input.year}` : ""}`);
    const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
    if (taken) slug = `${slug}-${input.year || Date.now().toString(36)}`;
    const [row] = await db.insert(categories).values({ slug, kind: "collection", ...values }).returning({ id: categories.id });
    id = row.id;
  }
  await audit({ actor: actor(staff), action: existing ? "Colecção alterada" : "Colecção criada", detail: name });
  return id!;
}

/** EN: Pieces in and out of a collection. PT: Peças a entrar e a sair de uma colecção. */
export async function setCollectionPieces(staff: StaffContext, id: string, add: string[], remove: string[]) {
  const db = await getDb();
  const [col] = await db.select().from(categories).where(eq(categories.id, id));
  if (!col || col.kind !== "collection") throw new AppError("NOT_FOUND", "Colecção não encontrada.", 404);
  for (const productId of add) {
    await db.insert(productCategories).values({ productId, categoryId: id }).onConflictDoNothing();
    await db.update(products).set({ collectionId: id }).where(and(eq(products.id, productId), isNull(products.collectionId)));
  }
  if (remove.length) {
    await db.delete(productCategories).where(and(eq(productCategories.categoryId, id), inArray(productCategories.productId, remove)));
    for (const productId of remove) {
      const [p] = await db.select({ collectionId: products.collectionId }).from(products).where(eq(products.id, productId));
      if (p?.collectionId === id) await db.update(products).set({ collectionId: null }).where(eq(products.id, productId));
    }
  }
  await audit({ actor: actor(staff), action: "Peças da colecção alteradas", detail: `${col.name.pt} · +${add.length} −${remove.length}` });
}

/** EN: How many pieces are available if activated. PT: Quantas peças ficam disponíveis ao activar. */
export async function activationCheck(id: string) {
  const db = await getDb();
  const linked = await db.select({ productId: productCategories.productId }).from(productCategories).where(eq(productCategories.categoryId, id));
  const mains = await db.select({ id: products.id }).from(products).where(eq(products.collectionId, id));
  const pieceIds = [...new Set([...linked.map((l) => l.productId), ...mains.map((m) => m.id)])];
  if (!pieceIds.length) return { total: 0, available: 0 };
  const rows = await db.select({ id: products.id, status: products.status }).from(products).where(inArray(products.id, pieceIds));
  const variants = await db.select({ productId: productVariants.productId, stock: productVariants.stock }).from(productVariants).where(inArray(productVariants.productId, pieceIds));
  const available = rows.filter((r) => r.status === "published" && variants.some((v) => v.productId === r.id && v.stock > 0)).length;
  return { total: rows.length, available };
}

/**
 * EN: "Activar colecção": the previous seasonal collection goes to the archive (its pieces stay linked); special editions
 *     are activated on their own and do not replace the seasonal one.
 * PT: "Activar colecção": a sazonal anterior passa ao arquivo (as peças ficam ligadas); as edições especiais activam-se
 *     sozinhas e não substituem a sazonal.
 */
/**
 * EN: What happens to the shop on a collection change (owner 2026-11-23): "all" = every piece leaves the shop for the
 *     warehouse, "previous" = only the old collection's pieces, "this" = only this collection's (when deactivating),
 *     "keep" = nothing moves. Fixed pieces never leave; `publishNew` puts the new collection's warehouse pieces in the shop.
 * PT: O que acontece à loja ao mudar de colecção (dona 23-11-2026): "all" = todas as peças saem para o armazém,
 *     "previous" = só as da colecção anterior, "this" = só as desta (ao desactivar), "keep" = nada se mexe. As fixas
 *     nunca saem; `publishNew` põe na loja as peças da colecção nova que estão no armazém.
 */
export interface ShopChange {
  send: "all" | "previous" | "this" | "keep";
  publishNew?: boolean;
}

export async function setCollectionStatus(staff: StaffContext, id: string, status: "active" | "archived" | "draft", shop: ShopChange = { send: "keep" }) {
  const db = await getDb();
  const rows = await db.select().from(categories);
  const row = rows.find((r) => r.id === id);
  if (!row || !isSeasonalTree(row, rows)) throw new AppError("NOT_FOUND", "Colecção não encontrada.", 404);
  const special = !!row.parentId || row.details?.collectionType === "special";
  let replaced: string | null = null;
  const replacedIds: string[] = [];
  if (status === "active" && !special) {
    for (const other of rows.filter((r) => r.id !== id && isSeasonalTree(r, rows) && !r.parentId && r.details?.active)) {
      await db
        .update(categories)
        .set({ details: { ...(other.details ?? {}), active: false, status: "archived" }, updatedAt: new Date() })
        .where(eq(categories.id, other.id));
      replaced = other.name.pt;
      replacedIds.push(other.id);
    }
  }
  await db
    .update(categories)
    .set({ details: { ...(row.details ?? {}), active: status === "active", status }, updatedAt: new Date() })
    .where(eq(categories.id, id));

  // EN: The shop follows the collection change. PT: A loja acompanha a mudança de colecção.
  let sent = 0;
  let published = 0;
  if (shop.send !== "keep" || shop.publishNew) {
    const own = await collectionPieceIds(db, id);
    const keep = await fixedProductIds(db);
    if (status === "active") for (const p of own) keep.add(p);
    if (shop.send === "all" && status === "active") sent = await sendToWarehouse(db, "all", keep);
    else if (shop.send === "previous" && status === "active") {
      const old = (await Promise.all(replacedIds.map((r) => collectionPieceIds(db, r)))).flat();
      sent = await sendToWarehouse(db, old, keep);
    } else if (shop.send === "this" && status !== "active") sent = await sendToWarehouse(db, own, await fixedProductIds(db));
    if (shop.publishNew && status === "active") published = await putInStore(db, own);
  }
  await audit({
    actor: actor(staff),
    action: status === "active" ? "Colecção activada" : status === "archived" ? "Colecção arquivada" : "Colecção passada a rascunho",
    detail: `${row.name.pt}${replaced ? ` · substitui ${replaced}` : ""}${sent ? ` · ${sent} peças para o armazém` : ""}${published ? ` · ${published} peças na loja` : ""}`,
  });
  return { sent, published };
}

/** EN: "Importar Excel + capas" of old collections. PT: Importar colecções antigas (Excel + ZIP de capas). */
export async function importHistory(staff: StaffContext, excel: Buffer, zip: Buffer | null) {
  const rows = readXlsx(excel);
  const head = (rows[0] ?? []).map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""),
  );
  const col = (n: string) => head.findIndex((h) => h.startsWith(n));
  const [cName, cNum, cYear, cStart, cEnd] = [col("nome"), col("numero"), col("ano"), col("inicio"), col("fim")];
  if (cName < 0) throw new AppError("VALIDATION_ERROR", "O Excel precisa da coluna Nome (e Número, Ano, Início, Fim).", 400);
  const covers = new Map<string, Buffer>();
  if (zip) for (const e of readZip(zip)) if (/\.(jpe?g|png|webp)$/i.test(e.name)) covers.set(e.name.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase(), e.data());
  const toDate = (v: string) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(v)) return toMaputo(new Date(Math.round((Number(v) - 25569) * 86_400_000))).date; // Excel serial
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
  };
  let created = 0;
  for (const r of rows.slice(1)) {
    const name = (r[cName] ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cover = covers.get(key) ?? covers.get(slugify(name));
    let imageUrl: string | null = null;
    if (cover) imageUrl = await savePublicUpload(new File([new Uint8Array(cover)], `${slugify(name)}.jpg`, { type: "image/jpeg" }), "content");
    await saveCollection(staff, {
      collectionType: "seasonal",
      parentId: null,
      name,
      number: cNum >= 0 ? (r[cNum] ?? "").trim() : "",
      year: cYear >= 0 ? Number(r[cYear]) || 0 : 0,
      startsOn: cStart >= 0 ? toDate((r[cStart] ?? "").trim()) : null,
      endsOn: cEnd >= 0 ? toDate((r[cEnd] ?? "").trim()) : null,
      description: "",
      message: "",
      buttonText: "",
      buttonLink: "auto",
      imageUrl,
      history: true,
    });
    created++;
  }
  return created;
}
