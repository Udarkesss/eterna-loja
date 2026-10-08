import { count, eq } from "drizzle-orm";
import { categoryTree, type CategorySeed } from "@/data/catalog";
import { homeSections, occasionTiles as tileSeeds } from "@/data/content";
import { designProducts } from "@/data/products";
import { deliveryZoneSeeds, paymentMethodSeeds, permissionMatrix, roleSeeds, settingSeeds, storeSeeds } from "@/data/site";
import type { Database } from "./client";
import {
  categories,
  contentSections,
  deliveryZones,
  occasionTiles,
  paymentMethodSettings,
  productCategories,
  productImages,
  products,
  productVariants,
  rolePermissions,
  roles,
  settings,
  stores,
} from "./schema";

/**
 * EN: Loads the design's data into the database. Safe to run many times:
 *     reference data (stores, categories, roles, design products) is upserted; content and settings are only
 *     inserted when missing, so edits made in the back-office are never overwritten.
 * PT: Carrega os dados do design na base de dados. Pode correr várias vezes:
 *     dados de referência são criados ou actualizados; conteúdo e definições só são inseridos se faltarem,
 *     para nunca apagar alterações feitas na gestão.
 */

type Ids = Map<string, string>;

async function seedStores(db: Database): Promise<Ids> {
  const ids: Ids = new Map();
  for (const [position, s] of storeSeeds.entries()) {
    const values = { ...s, position };
    const [row] = await db
      .insert(stores)
      .values(values)
      .onConflictDoUpdate({ target: stores.code, set: values })
      .returning({ id: stores.id });
    ids.set(s.code, row.id);
  }
  return ids;
}

async function seedCategories(db: Database): Promise<Ids> {
  const ids: Ids = new Map();
  async function upsert(nodes: CategorySeed[], parentId: string | null) {
    for (const [position, n] of nodes.entries()) {
      const values = {
        slug: n.slug,
        kind: n.kind,
        parentId,
        name: n.name,
        singular: n.singular ?? null,
        description: n.description ?? null,
        position,
      };
      const [row] = await db
        .insert(categories)
        .values(values)
        .onConflictDoUpdate({ target: categories.slug, set: values })
        .returning({ id: categories.id });
      ids.set(n.slug, row.id);
      if (n.children) await upsert(n.children, row.id);
    }
  }
  await upsert(categoryTree, null);
  return ids;
}

async function seedProducts(db: Database, categoryIds: Ids, storeIds: Ids) {
  for (const p of designProducts) {
    const values = {
      slug: p.code.toLowerCase(),
      code: p.code,
      name: p.name,
      description: p.description,
      composition: p.composition ?? null,
      price: p.price,
      salePrice: p.salePrice ?? null,
      colors: p.colors,
      typeId: categoryIds.get(p.type) ?? null,
      collectionId: categoryIds.get(p.collection) ?? null,
      status: "published" as const,
      isNew: p.isNew ?? false,
    };
    const [row] = await db
      .insert(products)
      .values(values)
      .onConflictDoUpdate({ target: products.code, set: values })
      .returning({ id: products.id });

    // EN: Product appears in its type, its collection and its occasions. PT: Aparece no tipo, colecção e ocasiões.
    const links = [p.type, p.collection, ...p.occasions]
      .map((slug) => categoryIds.get(slug))
      .filter((id): id is string => !!id);
    await db.delete(productCategories).where(eq(productCategories.productId, row.id));
    await db.insert(productCategories).values([...new Set(links)].map((categoryId) => ({ productId: row.id, categoryId })));

    for (const [position, v] of p.variants.entries()) {
      const variant = {
        productId: row.id,
        sku: `${p.code}-${v.color ?? "U"}-${v.size}`.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
        color: v.color,
        size: v.size,
        storeId: storeIds.get(v.store) ?? null,
        stock: v.stock,
        position,
      };
      await db.insert(productVariants).values(variant).onConflictDoUpdate({ target: productVariants.sku, set: variant });
    }

    await db.delete(productImages).where(eq(productImages.productId, row.id));
    await db.insert(productImages).values(
      p.images.map((img, position) => ({ productId: row.id, url: img.url, alt: img.alt, color: img.color ?? null, position })),
    );
  }
}

async function seedContent(db: Database, categoryIds: Ids) {
  for (const [position, s] of homeSections.entries()) {
    await db
      .insert(contentSections)
      .values({ page: "home", key: s.key, position, data: s.data, publishedAt: new Date() })
      .onConflictDoNothing();
  }
  const [{ value }] = await db.select({ value: count() }).from(occasionTiles);
  if (value === 0) {
    await db.insert(occasionTiles).values(
      tileSeeds.map((t, position) => ({
        name: t.name,
        phrase: t.phrase,
        imageUrl: t.imageUrl,
        categoryId: categoryIds.get(t.category) ?? null,
        size: t.size,
        position,
      })),
    );
  }
}

async function seedSettings(db: Database) {
  for (const [position, m] of paymentMethodSeeds.entries()) {
    await db
      .insert(paymentMethodSettings)
      .values({ method: m.method, enabled: true, environment: m.environment, note: m.note, position })
      .onConflictDoNothing();
  }
  const [{ value: zoneCount }] = await db.select({ value: count() }).from(deliveryZones);
  if (zoneCount === 0) {
    await db.insert(deliveryZones).values(deliveryZoneSeeds.map((z, position) => ({ ...z, position })));
  }
  for (const [key, value] of Object.entries(settingSeeds)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }
}

async function seedRoles(db: Database) {
  const roleIds: string[] = [];
  for (const r of roleSeeds) {
    const [row] = await db
      .insert(roles)
      .values({ key: r.key, name: r.name, level: r.level })
      .onConflictDoUpdate({ target: roles.key, set: { name: r.name, level: r.level } })
      .returning({ id: roles.id });
    roleIds.push(row.id);
  }
  for (const [area, access] of permissionMatrix) {
    await db
      .insert(rolePermissions)
      .values(access.map((a, i) => ({ roleId: roleIds[i], area, access: a })))
      .onConflictDoNothing(); // EN: keep changes made in Gestão · A2. PT: manter alterações da gestão.
  }
}

export async function seedAll(db: Database) {
  const storeIds = await seedStores(db);
  const categoryIds = await seedCategories(db);
  await seedProducts(db, categoryIds, storeIds);
  await seedContent(db, categoryIds);
  await seedSettings(db);
  await seedRoles(db);
}

/** EN: Used on first start in development. PT: Usado no primeiro arranque em desenvolvimento. */
export async function seedIfEmpty(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(stores);
  if (value === 0) await seedAll(db);
}
