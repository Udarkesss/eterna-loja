import { and, count, eq, inArray, isNull, like, notInArray } from "drizzle-orm";
import { GUIDE_TOPICS, TOPICS_BEFORE_GUIDE, type Topic } from "@/data/assistant";
import { CATEGORY_IMAGES, COLLECTION_DETAILS, categoryTree, type CategorySeed } from "@/data/catalog";
import { HOME_KEYS, heroSlides, homeSections, occasionTiles as tileSeeds } from "@/data/content";
import { infoSeeds } from "@/data/pages";
import { deliveryZoneSeeds, paymentMethodSeeds, permissionMatrix, roleSeeds, settingSeeds, storeSeeds } from "@/data/site";
import type { Database } from "./client";
import {
  categories,
  contentSections,
  deliveryZones,
  occasionTiles,
  paymentMethodSettings,
  productVariants,
  products,
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
      const extra = { imageUrl: CATEGORY_IMAGES[n.slug] ?? null, details: COLLECTION_DETAILS[n.slug] ?? null };
      // EN: Images and details only on creation (the team edits them). PT: Imagens e detalhes só ao criar.
      const [row] = await db
        .insert(categories)
        .values({ ...values, ...extra })
        .onConflictDoUpdate({ target: categories.slug, set: values })
        .returning({ id: categories.id });
      ids.set(n.slug, row.id);
      if (n.children) await upsert(n.children, row.id);
    }
  }
  await upsert(categoryTree, null);
  return ids;
}

/** EN: "Informações" pages (texts of the old site); only when missing. PT: Páginas "Informações"; só se faltarem. */
async function seedPages(db: Database) {
  const pages = [{ page: "info", list: infoSeeds }];
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
  {
    // EN: Design V3 images (type circles, collection covers) and the active collection's details, where still empty.
    // PT: Imagens do V3 (círculos dos tipos, capas) e detalhes da colecção activa, onde ainda estão vazios.
    name: "imagens-categorias",
    run: async (db) => {
      for (const [slug, imageUrl] of Object.entries(CATEGORY_IMAGES)) {
        await db.update(categories).set({ imageUrl }).where(and(eq(categories.slug, slug), isNull(categories.imageUrl)));
      }
      for (const [slug, details] of Object.entries(COLLECTION_DETAILS)) {
        await db.update(categories).set({ details }).where(and(eq(categories.slug, slug), isNull(categories.details)));
      }
    },
  },
  {
    // EN: Home page of design V3: new sections in the V3 order, old V1/V2 sections removed. The hero keeps what the
    //     team set (only the deleted old video and the missing V3 fields change); occasion tiles get the V3 images if
    //     they still have the old ones.
    // PT: Início do design V3: secções novas pela ordem da V3 e as antigas retiradas. O topo mantém o que a equipa
    //     definiu (só muda o vídeo antigo apagado e os campos V3 em falta); as ocasiões recebem as imagens da V3 se
    //     ainda tiverem as antigas.
    name: "inicio-v3",
    run: async (db) => {
      await db.delete(contentSections).where(and(eq(contentSections.page, "home"), notInArray(contentSections.key, [...HOME_KEYS])));
      const existing = await db.select().from(contentSections).where(eq(contentSections.page, "home"));
      for (const [position, seed] of homeSections.entries()) {
        const row = existing.find((r) => r.key === seed.key);
        if (!row) {
          await db.insert(contentSections).values({ page: "home", key: seed.key, position, data: seed.data, publishedAt: new Date() });
          continue;
        }
        let data = row.data;
        if (seed.key === "hero") {
          const old = data.videoDesktop === "/videos/hero-desktop.mp4";
          data = { ...seed.data, ...data, ...(old ? { videoDesktop: seed.data.videoDesktop, videoMobile: seed.data.videoMobile, poster: seed.data.poster, posterMobile: seed.data.posterMobile, videoBadge: seed.data.videoBadge } : {}) };
        }
        if (seed.key === "announcement") {
          const first = (data.messages as { pt?: string }[] | undefined)?.[1]?.pt ?? "";
          if (first.startsWith("Visite-nos no Glória Mall")) data = seed.data;
        }
        await db.update(contentSections).set({ data, position }).where(eq(contentSections.id, row.id));
      }
      const tiles = await db.select({ imageUrl: occasionTiles.imageUrl }).from(occasionTiles);
      if (!tiles.length || tiles.every((t) => t.imageUrl.startsWith("/images/occasions/") || t.imageUrl.startsWith("/images/content/"))) {
        const ids = new Map((await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [c.slug, c.id]));
        await db.delete(occasionTiles);
        await db.insert(occasionTiles).values(
          tileSeeds.map((t, position) => ({ name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, categoryId: ids.get(t.category) ?? null, size: t.size, position })),
        );
      }
    },
  },
  {
    // EN: Hero "Slides" mode of design V3: adds the three slides, keeps everything the team set; the old single-image
    //     mode becomes slides. PT: Modo "Slides" do topo (V3): junta os três slides e mantém o resto; o antigo modo
    //     de imagem única passa a slides.
    name: "hero-slides",
    run: async (db) => {
      const [row] = await db.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "hero")));
      if (!row) return;
      const data = { ...row.data };
      if (!Array.isArray(data.slides)) {
        data.slides = heroSlides;
        data.slidesAuto = false;
      }
      if (data.media === "image") data.media = "slides";
      await db.update(contentSections).set({ data }).where(eq(contentSections.id, row.id));
    },
  },
  {
    // EN: New areas of the access matrix (design V3: "Descontos e vouchers"); existing cells are kept.
    // PT: Áreas novas da matriz de acesso (V3: "Descontos e vouchers"); as células existentes mantêm-se.
    name: "areas-descontos",
    run: seedRoles,
  },
  {
    // EN: Access matrix area "Reservas" (design V3). PT: Área "Reservas" da matriz de acesso (V3).
    name: "areas-reservas",
    run: seedRoles,
  },
  {
    // EN: Gestão · Colecções (design V3): number, year and planned dates of Essenza, only where still empty.
    // PT: Gestão · Colecções (V3): número, ano e datas planeadas da Essenza, só onde ainda está vazio.
    name: "colecoes-v3",
    run: async (db) => {
      const [row] = await db.select().from(categories).where(eq(categories.slug, "essenza"));
      if (!row) return;
      const d = row.details ?? {};
      await db
        .update(categories)
        .set({
          details: {
            ...d,
            collectionType: d.collectionType ?? "seasonal",
            number: d.number ?? "II",
            year: d.year ?? 2026,
            startsOn: d.startsOn ?? "2026-08-03",
            endsOn: d.endsOn ?? "2026-12-31",
            status: d.active ? "active" : (d.status ?? "draft"),
          },
        })
        .where(eq(categories.id, row.id));
    },
  },
  {
    // EN: Assistant answers of the owner's chatbot guide (2026-11-22). A question the team never edited takes the new
    //     text; edited ones and the team's own questions stay as they are; new questions are added at the end.
    // PT: Respostas do assistente do guia da dona (22-11-2026). Uma pergunta que a equipa nunca editou recebe o texto
    //     novo; as editadas e as criadas pela equipa ficam como estão; as perguntas novas juntam-se no fim.
    name: "assistente-guia",
    run: async (db) => {
      const [row] = await db.select().from(settings).where(eq(settings.key, "assistant"));
      const saved = row?.value as { topics?: Topic[] } | undefined;
      if (!saved?.topics) return; // EN: never saved: the new defaults apply. PT: nunca guardado: valem os novos.
      const same = (a: Topic, b: Topic) => a.name === b.name && a.kind === b.kind && a.text === b.text && a.keywords.join("·") === b.keywords.join("·");
      const topics = saved.topics.map((t) => {
        const before = TOPICS_BEFORE_GUIDE.find((x) => x.id === t.id);
        const guide = GUIDE_TOPICS.find((x) => x.id === t.id);
        return before && guide && same(t, before) ? { ...guide, on: t.on, site: t.site, whatsapp: t.whatsapp } : t;
      });
      for (const g of GUIDE_TOPICS) if (!topics.some((t) => t.id === g.id)) topics.push(g);
      await db.update(settings).set({ value: { ...saved, topics }, updatedAt: new Date() }).where(eq(settings.key, "assistant"));
    },
  },
  {
    // EN: Shoes imported with the clothing scale ("6" became "6US/38EUR/S"): back to the US shoe number (owner 2026-11-23).
    // PT: Sapatos importados com a escala da roupa ("6" ficou "6US/38EUR/S"): voltam ao número US (dona 23-11-2026).
    name: "sapatos-tamanhos",
    run: async (db) => {
      const shoeTypes = await db.select({ id: categories.id }).from(categories).where(like(categories.slug, "sapatos%"));
      if (!shoeTypes.length) return;
      const rows = await db
        .select({ id: productVariants.id, size: productVariants.size })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(products.typeId, shoeTypes.map((t) => t.id)));
      for (const r of rows) {
        const m = r.size.match(/^(\d+(?:\.5)?)US\/\d+EUR\/[A-Z]+$/);
        if (m) await db.update(productVariants).set({ size: m[1] }).where(eq(productVariants.id, r.id));
      }
    },
  },
  {
    // EN: Shapewear is fixed in the shop too (owner 2026-11-25). PT: Os modeladores também ficam fixos na loja.
    name: "fixos-modeladores",
    run: async (db) => {
      const [row] = await db.select().from(settings).where(eq(settings.key, "store.fixed"));
      const saved = row?.value as { categories?: string[]; products?: string[] } | undefined;
      if (!saved?.categories || saved.categories.includes("modeladores")) return;
      await db
        .update(settings)
        .set({ value: { ...saved, categories: [...saved.categories, "modeladores"] }, updatedAt: new Date() })
        .where(eq(settings.key, "store.fixed"));
    },
  },
];

/** EN: How many data versions exist (development re-checks it on each request). PT: Quantas versões de dados existem. */
export const dataMigrationCount = () => DATA_MIGRATIONS.length;

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
