import "server-only";
import { asc, count, eq, inArray } from "drizzle-orm";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productCategories, products } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · Tipos de peça" of design V3: the groups (Roupa de Festa, Roupa Executiva, Acessórios de Festa,
 *     Acessórios Executivos, Modeladores, Noivas), each group's types in the order of the type bar (circular image,
 *     name, pieces), where bridal accessories appear (only Noivas, only Acessórios, both) and "Novo tipo de peça".
 * PT: Tipos de peça do V3: os grupos, os tipos de cada grupo pela ordem da barra de tipos (imagem circular, nome,
 *     peças), onde aparecem os acessórios de noiva e "Novo tipo de peça".
 */

export type ShowIn = "noivas" | "acessorios" | "both";
const BRIDAL_ACCESSORIES = "acessorios-noiva";
const GROUP_ORDER = ["roupa-de-festa", "roupa-executiva", "acessorios-festa", "acessorios-executivos", "modeladores", "noivas"];
const rank = (slug: string) => (GROUP_ORDER.indexOf(slug) + 1 || 99);

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function typesOverview() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const types = rows.filter((r) => r.kind === "type");
  const ids = types.map((t) => t.id);
  const [byLink, byType] = await Promise.all([
    ids.length ? db.select({ id: productCategories.categoryId, n: count() }).from(productCategories).where(inArray(productCategories.categoryId, ids)).groupBy(productCategories.categoryId) : [],
    ids.length ? db.select({ id: products.typeId, n: count() }).from(products).where(inArray(products.typeId, ids)).groupBy(products.typeId) : [],
  ]);
  const pieces = (id: string) => Math.max(Number(byLink.find((x) => x.id === id)?.n ?? 0), Number(byType.find((x) => x.id === id)?.n ?? 0));
  const bridalAcc = rows.find((r) => r.slug === BRIDAL_ACCESSORIES);
  // EN: The group is the type's parent; bridal accessories belong to "Noivas". PT: O grupo é o pai; acessórios de noiva ficam em "Noivas".
  const groupOf = (t: (typeof rows)[number]) => (bridalAcc && t.parentId === bridalAcc.id ? bridalAcc.parentId : t.parentId);
  const groupIds = [...new Set(types.map(groupOf).filter((x): x is string => !!x))];
  const groups = rows
    .filter((r) => groupIds.includes(r.id))
    .map((g) => {
      const list = types
        .filter((t) => groupOf(t) === g.id)
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name.pt,
          nameEn: t.name.en,
          imageUrl: t.imageUrl,
          pieces: pieces(t.id),
          bridalAccessory: !!bridalAcc && t.parentId === bridalAcc.id,
          showIn: (t.details?.showIn ?? "noivas") as ShowIn,
        }));
      return { id: g.id, slug: g.slug, name: g.name.pt, types: list };
    })
    // EN: The design's order. PT: A ordem do design.
    .sort((a, b) => rank(a.slug) - rank(b.slug));
  return { groups };
}

async function typeOrThrow(id: string) {
  const db = await getDb();
  const [t] = await db.select().from(categories).where(eq(categories.id, id));
  if (!t || t.kind !== "type") throw new AppError("NOT_FOUND", "Tipo não encontrado.", 404);
  return t;
}

export async function saveTypeOrder(staff: StaffContext, ids: string[]) {
  const db = await getDb();
  for (const [position, id] of ids.entries()) await db.update(categories).set({ position, updatedAt: new Date() }).where(eq(categories.id, id));
  await audit({ actor: actor(staff), action: "Ordem dos tipos de peça alterada", detail: `${ids.length} tipos` });
}

export async function renameType(staff: StaffContext, id: string, name: string, nameEn: string | null) {
  const t = await typeOrThrow(id);
  const db = await getDb();
  await db
    .update(categories)
    .set({ name: { pt: name, en: nameEn || t.name.en || name }, updatedAt: new Date() })
    .where(eq(categories.id, id));
  await audit({ actor: actor(staff), action: "Tipo de peça renomeado", detail: `${t.name.pt} → ${name}` });
}

export async function setTypeImage(staff: StaffContext, id: string, url: string) {
  const t = await typeOrThrow(id);
  const db = await getDb();
  await db.update(categories).set({ imageUrl: url, updatedAt: new Date() }).where(eq(categories.id, id));
  await audit({ actor: actor(staff), action: "Imagem do tipo de peça trocada", detail: t.name.pt });
}

export async function setShowIn(staff: StaffContext, id: string, showIn: ShowIn) {
  const t = await typeOrThrow(id);
  const db = await getDb();
  await db
    .update(categories)
    .set({ details: { ...(t.details ?? {}), showIn }, updatedAt: new Date() })
    .where(eq(categories.id, id));
  await audit({ actor: actor(staff), action: "Onde aparece o acessório de noiva", detail: `${t.name.pt} · ${showIn === "both" ? "nos dois" : showIn === "noivas" ? "só Noivas" : "só Acessórios"}` });
}

export async function deleteType(staff: StaffContext, id: string) {
  const t = await typeOrThrow(id);
  const db = await getDb();
  const [[linked], [typed]] = await Promise.all([
    db.select({ n: count() }).from(productCategories).where(eq(productCategories.categoryId, id)),
    db.select({ n: count() }).from(products).where(eq(products.typeId, id)),
  ]);
  if (Number(linked.n) > 0 || Number(typed.n) > 0) throw new AppError("VALIDATION_ERROR", "Mova as peças para outro tipo antes de remover.", 400);
  await db.delete(categories).where(eq(categories.id, id));
  await audit({ actor: actor(staff), action: "Tipo de peça removido", detail: t.name.pt });
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function createType(staff: StaffContext, input: { name: string; nameEn: string | null; groupId: string; imageUrl: string | null }) {
  const db = await getDb();
  const [group] = await db.select().from(categories).where(eq(categories.id, input.groupId));
  if (!group) throw new AppError("VALIDATION_ERROR", "Escolha o grupo.", 400);
  let slug = slugify(input.name);
  if (!slug) throw new AppError("VALIDATION_ERROR", "Escreva o nome do tipo.", 400);
  const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (taken) slug = `${slug}-${group.slug}`;
  const siblings = await db.select({ position: categories.position }).from(categories).where(eq(categories.parentId, group.id));
  const singular = input.name.replace(/s$/, "");
  await db.insert(categories).values({
    slug,
    kind: "type",
    parentId: group.id,
    name: { pt: input.name, en: input.nameEn || input.name },
    singular: { pt: singular, en: (input.nameEn || input.name).replace(/s$/, "") },
    imageUrl: input.imageUrl,
    position: Math.max(0, ...siblings.map((s) => s.position)) + 1,
  });
  await audit({ actor: actor(staff), action: "Tipo de peça criado", detail: `${input.name} · ${group.name.pt}` });
}
