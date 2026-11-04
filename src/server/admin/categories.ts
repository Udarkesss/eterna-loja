import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { CategoryListing } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productImages, products } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · Categorias e filtros" of design V3-G-Categorias: the store pages (Ocasiões, Linhas: Noivas, Acessórios,
 *     Modeladores; Colecções), each one's default order, featured pieces and filters.
 * PT: Categorias e filtros do V3: as páginas da loja (Ocasiões; Linhas: Noivas, Acessórios, Modeladores; Colecções),
 *     a ordem por defeito de cada uma, as peças em destaque e os filtros.
 */

const LINES = ["noivas", "acessorios", "modeladores"];

export async function categoryNav() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const active = rows.find((r) => r.kind === "collection" && !r.parentId && r.details?.active);
  return [
    { group: "Ocasiões", items: rows.filter((r) => r.kind === "occasion").map((r) => ({ slug: r.slug, name: r.name.pt })) },
    { group: "Linhas", items: LINES.map((s) => rows.find((r) => r.slug === s)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ slug: r.slug, name: r.name.pt })) },
    { group: "Colecções", items: active ? [{ slug: active.slug, name: `${active.name.pt} (activa)` }] : [] },
  ];
}

export async function categorySettings(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug));
  if (!row) throw new AppError("NOT_FOUND", "Categoria não encontrada.", 404);
  const listing: CategoryListing = row.details?.listing ?? {};
  const ids = listing.featured ?? [];
  const found = ids.length ? await db.select({ id: products.id, code: products.code }).from(products).where(inArray(products.id, ids)) : [];
  const imgs = ids.length ? await db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position)) : [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name.pt,
    sort: listing.sort ?? "featured",
    featured: ids
      .map((id) => found.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({ id: f.id, code: f.code, image: imgs.find((i) => i.productId === f.id)?.url ?? null })),
    filters: { size: true, color: true, price: true, types: true, reserved: true, ...(listing.filters ?? {}) },
  };
}

export async function saveCategorySettings(staff: StaffContext, slug: string, listing: CategoryListing) {
  const db = await getDb();
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug));
  if (!row) throw new AppError("NOT_FOUND", "Categoria não encontrada.", 404);
  await db
    .update(categories)
    .set({ details: { ...(row.details ?? {}), listing }, updatedAt: new Date() })
    .where(eq(categories.id, row.id));
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Ordem e filtros da categoria alterados", detail: row.name.pt });
}

/** EN: Find pieces by code for "Em destaque". PT: Procurar peças pelo código para "Em destaque". */
export async function findPiecesByCode(query: string) {
  const db = await getDb();
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];
  const rows = await db.select({ id: products.id, code: products.code, status: products.status }).from(products);
  const hits = rows.filter((r) => r.status === "published" && r.code.includes(q)).slice(0, 12);
  const imgs = hits.length ? await db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(inArray(productImages.productId, hits.map((h) => h.id))).orderBy(asc(productImages.position)) : [];
  return hits.map((h) => ({ id: h.id, code: h.code, image: imgs.find((i) => i.productId === h.id)?.url ?? null }));
}
