import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { sizeParts } from "@/lib/sizes";
import type { ColorFamily, Localized, ProductColor, ProductStatus } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productCategories, productImages, products, productVariants, reservations, stores } from "../db/schema";
import { AppError } from "../errors";
import { accessOf, storeScope, type StaffContext } from "../staff/access";

/**
 * EN: Products in the back-office (design "Gestão · 6 Produtos" and "7 Editar produto").
 *     Store managers (L) edit stock, prices and texts; only T can publish or delete (matrix: products.publish).
 * PT: Produtos na gestão. Gestoras (L) editam stock, preços e textos; só T publica ou apaga.
 */

export type AdminProductState = "published" | "bridal" | "reserved" | "soldout" | "draft" | "scheduled" | "archived";
const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function listCategoriesByKind() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const pick = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => ({ id: r.id, slug: r.slug, name: r.name.pt }));
  return { collections: pick("collection"), occasions: pick("occasion"), types: pick("type") };
}

/** EN: Tabs of design V3-G-Produtos. PT: Separadores do V3. */
export const PRODUCT_VIEWS = { todos: "Todos", publicados: "Publicados", rascunhos: "Rascunhos (armazém)", reservados: "Reservados", "sem-stock": "Sem stock", "sem-foto": "Sem fotografia" } as const;
export type ProductView = keyof typeof PRODUCT_VIEWS;

/**
 * EN: "Gestão · Produtos" of design V3: piece (photo, code, type), group, collections, colours, sizes, stock and state
 *     (Publicado · Publicado · prova (Bridal) · Reservada · Sem stock · Rascunho · armazém). Store managers see the
 *     stock of their stores.
 * PT: Produtos do V3: peça, grupo, colecções, cores, tamanhos, stock e estado. As gestoras vêem o stock das suas lojas.
 */
export async function listProductsAdmin(staff: StaffContext, filter: { view?: ProductView; q?: string; type?: string; collection?: string }) {
  const db = await getDb();
  const rows = await db.select().from(products).orderBy(desc(products.updatedAt));
  const ids = rows.map((r) => r.id);
  const [variants, images, links, cats, storeRows, held] = await Promise.all([
    ids.length ? db.select().from(productVariants).where(inArray(productVariants.productId, ids)) : [],
    ids.length ? db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position)) : [],
    ids.length ? db.select().from(productCategories).where(inArray(productCategories.productId, ids)) : [],
    db.select().from(categories),
    db.select({ id: stores.id, code: stores.code }).from(stores),
    db.select({ productId: reservations.productId }).from(reservations).where(eq(reservations.status, "active")),
  ]);
  const scope = storeScope(staff, "products.view");
  const reservedIds = new Set(held.map((h) => h.productId));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const items = rows
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const vs = variants.filter((v) => v.productId === p.id && (!scope || (v.storeId && scope.includes(v.storeId))));
      const stock = vs.reduce((n, v) => n + v.stock, 0);
      const type = p.typeId ? catById.get(p.typeId) : undefined;
      const group = type?.parentId ? catById.get(type.parentId)?.name.pt : undefined;
      const collectionIds = [...new Set([p.collectionId, ...links.filter((l) => l.productId === p.id).map((l) => l.categoryId).filter((cid) => catById.get(cid)?.kind === "collection")].filter((x): x is string => !!x))];
      const bridal = vs.some((v) => storeRows.find((s) => s.id === v.storeId)?.code === "22");
      const image = images.find((i) => i.productId === p.id)?.url ?? null;
      const colorKeys = [...new Set(vs.map((v) => v.color).filter((x): x is string => !!x))];
      const state: AdminProductState =
        p.status === "draft"
          ? "draft"
          : p.status === "scheduled"
            ? "scheduled"
            : reservedIds.has(p.id) && stock === 0
              ? "reserved"
              : stock === 0
                ? "soldout"
                : bridal
                  ? "bridal"
                  : "published";
      return {
        id: p.id,
        code: p.code,
        name: p.name.pt,
        type: type?.singular?.pt ?? type?.name.pt ?? "—",
        typeId: p.typeId,
        group: group ?? "—",
        collections: collectionIds.map((cid) => catById.get(cid)?.name.pt ?? "").filter(Boolean),
        collectionIds,
        colors: (colorKeys.length ? colorKeys : p.colors.map((c) => c.key)).map((k) => {
          const c = p.colors.find((x) => x.key === k);
          return { key: k, name: c?.name.pt ?? k, hex: c?.hex ?? null };
        }),
        sizes: [...new Set(vs.filter((v) => v.stock > 0).map((v) => sizeParts(v.size).letter))].join(" · ") || "—",
        stock,
        state,
        reserved: reservedIds.has(p.id),
        image,
        hasVariantsHere: vs.length > 0,
        search: `${p.code} ${p.name.pt} ${p.colors.map((c) => c.name.pt).join(" ")}`.toLowerCase(),
      };
    });

  const visible = scope ? items.filter((i) => i.hasVariantsHere) : items;
  const inView = (i: (typeof visible)[number], v: ProductView) =>
    v === "todos"
      ? true
      : v === "publicados"
        ? i.state === "published" || i.state === "bridal"
        : v === "rascunhos"
          ? i.state === "draft" || i.state === "scheduled"
          : v === "reservados"
            ? i.reserved
            : v === "sem-stock"
              ? i.stock === 0 && !i.reserved
              : !i.image;
  const counts = Object.fromEntries((Object.keys(PRODUCT_VIEWS) as ProductView[]).map((v) => [v, visible.filter((i) => inView(i, v)).length])) as Record<ProductView, number>;
  const q = (filter.q ?? "").toLowerCase().trim();
  const list = visible
    .filter((i) => inView(i, filter.view ?? "todos"))
    .filter((i) => !q || i.search.includes(q))
    .filter((i) => !filter.type || i.typeId === filter.type)
    .filter((i) => !filter.collection || i.collectionIds.includes(filter.collection));
  return { list, counts };
}

export async function getProductForEdit(id: string) {
  const db = await getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);
  const [variants, images, links] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.position)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
    db.select().from(productCategories).where(eq(productCategories.productId, id)),
  ]);
  return { product, variants, images, categoryIds: links.map((l) => l.categoryId) };
}

export interface ProductInput {
  id?: string;
  code: string;
  name: Localized;
  description: Localized;
  composition: Localized | null;
  price: number;
  salePrice: number | null;
  status: ProductStatus;
  publishAt: string | null;
  isNew: boolean;
  seoTitle: string | null;
  typeId: string | null;
  collectionId: string | null;
  occasionIds: string[];
  colors: { key: string; name: Localized; hex: string | null; family: ColorFamily | null }[];
  variants: { id?: string; size: string; color: string | null; storeCode: string; stock: number }[];
  images: { id?: string; url: string; alt: Localized; color: string | null }[];
}

/** EN: Creates or updates a product with its variants, photos and categories. PT: Cria ou actualiza um produto. */
export async function saveProduct(staff: StaffContext, input: ProductInput): Promise<string> {
  const canPublish = accessOf(staff, "products.publish") === "T";
  const db = await getDb();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) throw new AppError("VALIDATION_ERROR", "Código inválido (letras e números).", 400);
  if (!(input.price > 0)) throw new AppError("VALIDATION_ERROR", "Preço inválido.", 400);
  if (input.salePrice !== null && !(input.salePrice > 0 && input.salePrice < input.price)) {
    throw new AppError("VALIDATION_ERROR", "O preço em saldo tem de ser menor do que o preço.", 400);
  }
  const existing = input.id ? (await db.select().from(products).where(eq(products.id, input.id)))[0] : null;
  if (input.id && !existing) throw new AppError("NOT_FOUND", "Product not found", 404);
  // EN: Without publish rights the status cannot change (new products stay drafts). PT: Sem direito de publicar, o estado não muda.
  const status = canPublish ? input.status : (existing?.status ?? "draft");
  const [dupe] = await db.select({ id: products.id }).from(products).where(eq(products.code, code));
  if (dupe && dupe.id !== input.id) throw new AppError("CONFLICT", "Já existe um produto com este código.", 409);

  const values = {
    code,
    slug: code.toLowerCase(),
    name: input.name,
    description: input.description,
    composition: input.composition,
    price: Math.round(input.price),
    salePrice: input.salePrice ? Math.round(input.salePrice) : null,
    status,
    publishAt: status === "scheduled" && input.publishAt ? new Date(`${input.publishAt}:00+02:00`) : null,
    isNew: input.isNew,
    seoTitle: input.seoTitle || null,
    typeId: input.typeId,
    collectionId: input.collectionId,
    colors: input.colors.map((c) => ({ key: c.key, name: c.name, hex: c.hex, family: c.family })) as ProductColor[],
  };

  const storeRows = await db.select().from(stores);
  const scope = storeScope(staff, "products.edit");

  const id = await db.transaction(async (tx) => {
    const [row] = input.id
      ? await tx.update(products).set(values).where(eq(products.id, input.id)).returning({ id: products.id })
      : await tx.insert(products).values(values).returning({ id: products.id });

    // EN: Categories: type + collection + occasions. PT: Categorias: tipo + colecção + ocasiões.
    const catIds = [...new Set([input.typeId, input.collectionId, ...input.occasionIds].filter((x): x is string => !!x))];
    await tx.delete(productCategories).where(eq(productCategories.productId, row.id));
    if (catIds.length) await tx.insert(productCategories).values(catIds.map((categoryId) => ({ productId: row.id, categoryId })));

    // EN: Variants: store managers only touch their own stores' rows. PT: Gestoras só mexem nas linhas das suas lojas.
    const current = await tx.select().from(productVariants).where(eq(productVariants.productId, row.id));
    const keep = new Set<string>();
    for (const [position, v] of input.variants.entries()) {
      const store = storeRows.find((s) => s.code === v.storeCode);
      if (!store || !v.size.trim()) continue;
      if (scope && !scope.includes(store.id)) {
        if (v.id) keep.add(v.id);
        continue;
      }
      const sku = `${code}-${v.color ?? "U"}-${v.size}-${store.code}`.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const data = { productId: row.id, sku, size: v.size.trim(), color: v.color, storeId: store.id, stock: Math.max(0, Math.round(v.stock)), position };
      if (v.id && current.some((c) => c.id === v.id)) {
        await tx.update(productVariants).set(data).where(eq(productVariants.id, v.id));
        keep.add(v.id);
      } else {
        const [created] = await tx.insert(productVariants).values(data).returning({ id: productVariants.id });
        keep.add(created.id);
      }
    }
    for (const c of current) {
      if (!keep.has(c.id) && (!scope || (c.storeId && scope.includes(c.storeId)))) {
        await tx.delete(productVariants).where(eq(productVariants.id, c.id));
      }
    }

    // EN: Photos in the given order; the first is the main one. PT: Fotos pela ordem dada; a primeira é a principal.
    await tx.delete(productImages).where(eq(productImages.productId, row.id));
    if (input.images.length) {
      await tx.insert(productImages).values(input.images.map((img, position) => ({ productId: row.id, url: img.url, alt: img.alt, color: img.color, position })));
    }
    return row.id;
  });

  await audit({ actor: actor(staff), action: input.id ? "Produto actualizado" : "Produto criado", detail: `${code} · ${status}` });
  return id;
}

/** EN: Bulk actions of the product list. PT: Acções em massa da lista de produtos. */
/**
 * EN: Bulk bar of design V3: "Juntar a uma colecção" (adds it, keeps the others), "Publicar", "Passar a rascunho".
 * PT: Barra de acções em massa do V3: "Juntar a uma colecção" (junta, mantém as outras), "Publicar", "Passar a rascunho".
 */
export async function bulkProducts(staff: StaffContext, ids: string[], action: { kind: "publish" | "draft" } | { kind: "join"; collectionId: string }) {
  if (!ids.length) return;
  const db = await getDb();
  if (action.kind !== "join") {
    if (accessOf(staff, "products.publish") !== "T") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
    await db.update(products).set({ status: action.kind === "publish" ? "published" : "draft" }).where(inArray(products.id, ids));
  } else {
    const [collection] = await db.select().from(categories).where(eq(categories.id, action.collectionId));
    if (!collection || collection.kind !== "collection") throw new AppError("VALIDATION_ERROR", "Escolha a colecção.", 400);
    const rows = await db.select().from(products).where(inArray(products.id, ids));
    for (const p of rows) {
      await db.insert(productCategories).values({ productId: p.id, categoryId: collection.id }).onConflictDoNothing();
      if (!p.collectionId) await db.update(products).set({ collectionId: collection.id }).where(eq(products.id, p.id));
    }
  }
  const label = action.kind === "join" ? "juntados a uma colecção" : action.kind === "publish" ? "publicados" : "passados a rascunho";
  await audit({ actor: actor(staff), action: "Produtos alterados em massa", detail: `${ids.length} ${label}` });
}

export async function deleteProduct(staff: StaffContext, id: string) {
  if (accessOf(staff, "products.publish") !== "T") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const db = await getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) return;
  // EN: Archive instead of deleting: old orders keep their lines. PT: Arquivar em vez de apagar.
  await db.update(products).set({ status: "archived" }).where(eq(products.id, id));
  await audit({ actor: actor(staff), action: "Produto arquivado", detail: p.code });
}
