import "server-only";
import { and, eq, gt, inArray, or } from "drizzle-orm";
import { audit } from "../audit";
import { getDb } from "../db";
import type { Database } from "../db/client";
import { categories, productCategories, products } from "../db/schema";
import { getSetting, setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: Store ↔ warehouse (owner 2026-11-23). What is in the physical shop is on the site ("na loja" = published); the
 *     rest waits in the warehouse ("no armazém" = draft). When Eterna changes collection, the pieces leave the shop and
 *     the new collection comes in, except the fixed pieces (e.g. accessories), which always stay. Fixed pieces are whole
 *     categories (with everything inside them) and single products, in the setting "store.fixed".
 * PT: Loja ↔ armazém (dona 23-11-2026). O que está na loja física está no site ("na loja" = publicado); o resto espera no
 *     armazém ("no armazém" = rascunho). Quando a Eterna muda de colecção, as peças saem da loja e entra a colecção nova,
 *     menos as peças fixas (ex.: acessórios), que ficam sempre. As fixas são categorias inteiras (com tudo o que têm
 *     dentro) e produtos soltos, na definição "store.fixed".
 */

export interface FixedPieces {
  categories: string[]; // EN: category slugs. PT: slugs das categorias.
  products: string[]; // EN: product ids. PT: ids dos produtos.
}

const KEY = "store.fixed";
// EN: Accessories and shapewear (owner 2026-11-25), and the Bridal showroom (its own shop, not part of the seasonal
//     change). PT: Acessórios e modeladores (dona 25-11-2026), e a Bridal (loja própria, fora da mudança de estação).
export const DEFAULT_FIXED: FixedPieces = { categories: ["acessorios", "modeladores", "noivas"], products: [] };
const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function getFixedPieces(): Promise<FixedPieces> {
  const v = await getSetting<Partial<FixedPieces>>(KEY, DEFAULT_FIXED);
  return { categories: v.categories ?? [], products: v.products ?? [] };
}

export async function saveFixedCategories(staff: StaffContext, slugs: string[]) {
  const db = await getDb();
  const known = new Set((await db.select({ slug: categories.slug }).from(categories)).map((c) => c.slug));
  const now = await getFixedPieces();
  const next = { ...now, categories: [...new Set(slugs.filter((s) => known.has(s)))] };
  await setSetting(KEY, next, staff.id);
  const names = (await db.select({ slug: categories.slug, name: categories.name }).from(categories)).filter((c) => next.categories.includes(c.slug)).map((c) => c.name.pt);
  await audit({ actor: actor(staff), action: "Peças fixas na loja alteradas", detail: names.join(", ") || "nenhuma categoria" });
}

/** EN: Mark or unmark single products as fixed. PT: Marcar ou desmarcar produtos soltos como fixos. */
export async function setFixedProducts(staff: StaffContext, ids: string[], fixed: boolean) {
  const now = await getFixedPieces();
  const set = new Set(now.products);
  for (const id of ids) {
    if (fixed) set.add(id);
    else set.delete(id);
  }
  await setSetting(KEY, { ...now, products: [...set] }, staff.id);
  await audit({ actor: actor(staff), action: fixed ? "Produtos fixados na loja" : "Produtos deixaram de ser fixos", detail: `${ids.length}` });
}

/** EN: Ids of every fixed product. PT: Ids de todos os produtos fixos. */
export async function fixedProductIds(db?: Database): Promise<Set<string>> {
  db ??= await getDb();
  const fixed = await getFixedPieces();
  const cats = await db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId }).from(categories);
  const inside = new Set(cats.filter((c) => fixed.categories.includes(c.slug)).map((c) => c.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of cats)
      if (c.parentId && inside.has(c.parentId) && !inside.has(c.id)) {
        inside.add(c.id);
        grew = true;
      }
  }
  const ids = [...inside];
  const [own, linked] = ids.length
    ? await Promise.all([
        db.select({ id: products.id }).from(products).where(or(inArray(products.typeId, ids), inArray(products.collectionId, ids))),
        db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, ids)),
      ])
    : [[], []];
  return new Set([...fixed.products, ...own.map((r) => r.id), ...linked.map((r) => r.id)]);
}

/** EN: Pieces of a collection (main collection or linked). PT: Peças de uma colecção (principal ou ligadas). */
export async function collectionPieceIds(db: Database, id: string): Promise<string[]> {
  const [linked, mains] = await Promise.all([
    db.select({ id: productCategories.productId }).from(productCategories).where(eq(productCategories.categoryId, id)),
    db.select({ id: products.id }).from(products).where(eq(products.collectionId, id)),
  ]);
  return [...new Set([...linked.map((l) => l.id), ...mains.map((m) => m.id)])];
}

/** EN: Published pieces → warehouse, except the fixed ones. PT: Peças publicadas → armazém, menos as fixas. */
export async function sendToWarehouse(db: Database, ids: string[] | "all", keep: Set<string>): Promise<number> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(ids === "all" ? inArray(products.status, ["published", "scheduled"]) : and(inArray(products.status, ["published", "scheduled"]), inArray(products.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])));
  const move = rows.map((r) => r.id).filter((id) => !keep.has(id));
  if (move.length) await db.update(products).set({ status: "draft", updatedAt: new Date() }).where(inArray(products.id, move));
  return move.length;
}

/** EN: Warehouse pieces with a price → shop. PT: Peças do armazém com preço → loja. */
export async function putInStore(db: Database, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.status, "draft"), gt(products.price, 0)));
  if (rows.length) await db.update(products).set({ status: "published", updatedAt: new Date() }).where(inArray(products.id, rows.map((r) => r.id)));
  return rows.length;
}

/**
 * EN: What a collection change would move, for the "Activar" dialog. PT: O que a mudança de colecção moveria.
 */
export async function changePreview(id: string, previousId: string | null) {
  const db = await getDb();
  const [keep, pieces, previous, published] = await Promise.all([
    fixedProductIds(db),
    collectionPieceIds(db, id),
    previousId ? collectionPieceIds(db, previousId) : Promise.resolve([] as string[]),
    db.select({ id: products.id }).from(products).where(inArray(products.status, ["published", "scheduled"])),
  ]);
  const own = new Set(pieces);
  const draftNew = pieces.length
    ? (await db.select({ id: products.id }).from(products).where(and(inArray(products.id, pieces), eq(products.status, "draft"), gt(products.price, 0)))).length
    : 0;
  const pub = new Set(published.map((p) => p.id));
  const fixedCats = (await getFixedPieces()).categories;
  const names = (await db.select({ slug: categories.slug, name: categories.name }).from(categories)).filter((c) => fixedCats.includes(c.slug)).map((c) => c.name.pt);
  return {
    // EN: This collection's pieces in the shop (for "Desactivar"). PT: Peças desta colecção na loja (para "Desactivar").
    own: pieces.filter((p) => pub.has(p) && !keep.has(p)).length,
    fixedNames: names,
    // EN: Every piece in the shop that would leave (not fixed, not of the new collection). PT: Todas as que sairiam.
    all: [...pub].filter((p) => !keep.has(p) && !own.has(p)).length,
    previous: previous.filter((p) => pub.has(p) && !keep.has(p) && !own.has(p)).length,
    fixed: [...pub].filter((p) => keep.has(p)).length,
    toShop: draftNew,
  };
}
