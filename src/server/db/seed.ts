import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { categoryTree, type CategorySeed } from "@/data/catalog";
import { homeSections, occasionTiles as tileSeeds } from "@/data/content";
import { aboutSeed, infoSeeds } from "@/data/pages";
import { deliveryZoneSeeds, paymentMethodSeeds, permissionMatrix, roleSeeds, settingSeeds, storeSeeds } from "@/data/site";
import type { Database } from "./client";
import {
  categories,
  contentSections,
  deliveryZones,
  occasionTiles,
  paymentMethodSettings,
  rolePermissions,
  roles,
  settings,
  stores,
} from "./schema";

/**
 * EN: Loads the design's data into the database. Safe to run many times:
 *     reference data (stores, categories, roles) is upserted; content and settings are only inserted when missing, so
 *     edits made in the back-office are never overwritten. Products come from the import (Gestão → Produtos → Importar).
 * PT: Carrega os dados do design na base de dados. Pode correr várias vezes:
 *     dados de referência são criados ou actualizados; conteúdo e definições só são inseridos se faltarem,
 *     para nunca apagar alterações feitas na gestão. Os produtos vêm da importação (Gestão → Produtos → Importar).
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

/** EN: Creates or updates every category of src/data/catalog.ts (slug, kind, parent, names, order). PT: Cria ou actualiza. */
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

/** EN: "Sobre nós" and "Informações" pages (texts of the old site); only when missing. PT: Só se faltarem. */
async function seedPages(db: Database) {
  const pages = [{ page: "about", list: [aboutSeed] }, { page: "info", list: infoSeeds }];
  for (const { page, list } of pages) {
    for (const [position, s] of list.entries()) {
      await db.insert(contentSections).values({ page, key: s.key, position, data: s.data, publishedAt: new Date() }).onConflictDoNothing();
    }
  }
}

async function seedContent(db: Database, categoryIds: Ids) {
  for (const [position, s] of homeSections.entries()) {
    await db
      .insert(contentSections)
      .values({ page: "home", key: s.key, position, data: s.data, publishedAt: new Date() })
      .onConflictDoNothing();
  }
  await seedPages(db);
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
  await seedStores(db);
  const categoryIds = await seedCategories(db);
  await seedContent(db, categoryIds);
  await seedSettings(db);
  await seedRoles(db);
  // EN: A new database already has the latest data. PT: Uma base nova já tem os dados mais recentes.
  await setDataVersion(db, DATA_MIGRATIONS.length);
}

// ── Data versions / Versões dos dados ─────────────────────────────────

/**
 * EN: One-off changes to the data of an existing database (local or production), applied in order once each. The
 *     number already applied is kept in settings ("data.version"). Use them for changes that must not repeat on every
 *     deploy (e.g. reshaping the category tree), so later edits in the back-office are kept.
 * PT: Mudanças únicas aos dados de uma base existente (local ou produção), aplicadas por ordem uma vez cada. O número
 *     já aplicado fica nas definições ("data.version"). Servem para mudanças que não se podem repetir em cada
 *     publicação (ex.: reorganizar as categorias), para não apagar o que depois se mudar na gestão.
 */
const DATA_MIGRATIONS: { name: string; run: (db: Database) => Promise<void> }[] = [
  {
    // EN: Design V3 category tree (Essenza, Roupa de Festa / Executiva, accessory groups, old Shopify slugs).
    // PT: Árvore de categorias do design V3 (Essenza, Roupa de Festa / Executiva, grupos de acessórios, slugs do Shopify).
    name: "catalogo-v3",
    run: async (db) => {
      const [old] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "pochettes-noiva"));
      const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "pochettes-de-noiva"));
      if (old && !taken) await db.update(categories).set({ slug: "pochettes-de-noiva" }).where(eq(categories.id, old.id));
      await seedCategories(db);
      // EN: V1/V2 categories that V3 and the old site do not have. PT: Categorias da V1/V2 que a V3 e o site antigo não têm.
      await db.delete(categories).where(inArray(categories.slug, ["beyond-time", "vestidos", "vestidos-midi", "pochettes-noiva"]));
    },
  },
  {
    // EN: Data of the old eterna.co.mz: page texts, store names, phones and hours (only where still the design's
    //     placeholders, so edits made in the back-office stay).
    // PT: Dados do eterna.co.mz antigo: textos das páginas, nomes, telefones e horários das lojas (só onde ainda
    //     estão os marcadores do design, para manter o que se mudou na gestão).
    name: "conteudo-site-antigo",
    run: async (db) => {
      await seedPages(db);
      for (const st of await db.select().from(stores)) {
        const seed = storeSeeds.find((x) => x.code === st.code);
        if (!seed) continue;
        const placeholder = !st.hours || st.hours.pt.startsWith("[") || st.name === "Eterna & Beyond Time";
        if (placeholder) await db.update(stores).set({ name: seed.name, location: seed.location, phone: seed.phone, hours: seed.hours }).where(eq(stores.id, st.id));
      }
    },
  },
  {
    // EN: Category descriptions added to src/data/catalog.ts, only where a category still has none.
    // PT: Descrições de categorias acrescentadas ao catálogo, só onde a categoria ainda não tem nenhuma.
    name: "descricoes-categorias",
    run: async (db) => {
      const walk = async (nodes: CategorySeed[]) => {
        for (const n of nodes) {
          if (n.description) {
            await db
              .update(categories)
              .set({ description: n.description })
              .where(and(eq(categories.slug, n.slug), isNull(categories.description)));
          }
          if (n.children) await walk(n.children);
        }
      };
      await walk(categoryTree);
    },
  },
];

async function dataVersion(db: Database): Promise<number> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "data.version"));
  return typeof row?.value === "number" ? row.value : 0;
}

async function setDataVersion(db: Database, version: number) {
  await db
    .insert(settings)
    .values({ key: "data.version", value: version })
    .onConflictDoUpdate({ target: settings.key, set: { value: version, updatedAt: new Date() } });
}

/**
 * EN: Brings an existing database up to date after the schema migrations, locally and on deploy: pending data versions
 *     (above) and reference rows that newer versions introduced (e.g. a new payment method).
 * PT: Actualiza uma base existente depois das migrações do esquema, em local e no deploy: versões de dados pendentes
 *     (acima) e linhas de referência que versões novas trouxeram (ex.: um método de pagamento novo).
 */
export async function ensureReferenceData(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(stores);
  if (value === 0) return; // EN: empty database: seedAll does everything. PT: base vazia: o seedAll trata de tudo.
  for (let v = await dataVersion(db); v < DATA_MIGRATIONS.length; v++) {
    await DATA_MIGRATIONS[v].run(db);
    await setDataVersion(db, v + 1);
    console.log(`✓ Data / Dados: ${DATA_MIGRATIONS[v].name}`);
  }
  for (const [position, m] of paymentMethodSeeds.entries()) {
    await db
      .insert(paymentMethodSettings)
      .values({ method: m.method, enabled: true, environment: m.environment, note: m.note, position })
      .onConflictDoNothing();
  }
}

/** EN: Used on first start in development. PT: Usado no primeiro arranque em desenvolvimento. */
export async function seedIfEmpty(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(stores);
  if (value === 0) await seedAll(db);
}
