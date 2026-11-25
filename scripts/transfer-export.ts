/**
 * EN: Packs this computer's site (catalogue, photos, content, settings and the imported customers) into one file for
 *     the online site: Gestão → Definições → "Trazer os dados do computador" (owner 2026-11-25: "passa tudo para
 *     online"). Test data stays here: orders, reservations, fittings, test campaigns, staff, demo customers, payment
 *     settings and counters. Run with the local server stopped (the local database allows one program at a time):
 *       npm run transfer:export
 *     File format: first line = header length in bytes; then the header (JSON); then the photos one after the other.
 * PT: Junta o site deste computador (catálogo, fotos, conteúdo, definições e clientes importadas) num ficheiro para o
 *     site online: Gestão → Definições → "Trazer os dados do computador". Os dados de teste ficam cá: encomendas,
 *     reservas, provas, campanhas de teste, equipa, clientes de demonstração, pagamentos e contadores. Correr com o
 *     servidor local parado.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// EN: Settings that belong to this computer or to payments (owner: payments are changed in the online back-office).
// PT: Definições deste computador ou dos pagamentos (a dona muda os pagamentos na gestão online).
const SKIP_SETTINGS = /^(data\.version|.*\.sequence(\..*)?|payments\..*)$/;

async function main() {
  if (process.env.DATABASE_URL) throw new Error("DATABASE_URL is set: this script only reads the local database.");
  const { getDb } = await import("../src/server/db");
  const s = await import("../src/server/db/schema");
  const { PUBLIC_DIR } = await import("../src/server/uploads");
  const { eq, and, ne } = await import("drizzle-orm");
  const db = await getDb();

  const cats = await db.select().from(s.categories);
  const slugOf = new Map(cats.map((c) => [c.id, c.slug]));
  const storeRows = await db.select().from(s.stores);
  const storeCode = new Map(storeRows.map((r) => [r.id, r.code]));
  const prods = (await db.select().from(s.products)).filter((p) => p.status !== "archived");
  const codeOf = new Map(prods.map((p) => [p.id, p.code]));
  const [variants, images, links] = await Promise.all([db.select().from(s.productVariants), db.select().from(s.productImages), db.select().from(s.productCategories)]);

  const files = new Map<string, { path: string; type: string; offset: number; size: number }>();
  const want = (url: string) => {
    if (url.startsWith("/uploads/products/") && !files.has(url)) files.set(url, { path: url, type: url.endsWith(".jpg") ? "image/jpeg" : url.endsWith(".png") ? "image/png" : "image/webp", offset: 0, size: 0 });
    return url;
  };

  const header = {
    version: 1,
    createdAt: new Date().toISOString(),
    categories: cats.map((c) => ({ slug: c.slug, kind: c.kind, parent: c.parentId ? slugOf.get(c.parentId) ?? null : null, name: c.name, singular: c.singular, description: c.description, imageUrl: c.imageUrl, details: c.details, position: c.position })),
    stores: storeRows.map((r) => ({ code: r.code, name: r.name, location: r.location, phone: r.phone, hours: r.hours, lat: r.lat, lng: r.lng, position: r.position })),
    products: prods.map((p) => ({
      code: p.code,
      slug: p.slug,
      name: p.name,
      description: p.description,
      composition: p.composition,
      price: p.price,
      salePrice: p.salePrice,
      colors: p.colors,
      type: p.typeId ? slugOf.get(p.typeId) ?? null : null,
      collection: p.collectionId ? slugOf.get(p.collectionId) ?? null : null,
      status: p.status,
      publishAt: p.publishAt,
      isNew: p.isNew,
      fitting: p.fitting,
      seoTitle: p.seoTitle,
      sourceId: p.sourceId,
      createdAt: p.createdAt,
      categories: links.filter((l) => l.productId === p.id).map((l) => slugOf.get(l.categoryId)).filter((x): x is string => !!x),
      variants: variants.filter((v) => v.productId === p.id).map((v) => ({ sku: v.sku, color: v.color, size: v.size, store: v.storeId ? storeCode.get(v.storeId) ?? null : null, stock: v.stock, position: v.position })),
      images: images.filter((i) => i.productId === p.id).map((i) => ({ url: want(i.url), color: i.color, alt: i.alt, position: i.position, sourceUrl: i.sourceUrl })),
    })),
    sections: (await db.select().from(s.contentSections)).map((r) => ({ page: r.page, key: r.key, position: r.position, visible: r.visible, data: r.data, publishedAt: r.publishedAt })),
    tiles: (await db.select().from(s.occasionTiles)).map((t) => ({ name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, category: t.categoryId ? slugOf.get(t.categoryId) ?? null : null, size: t.size, position: t.position })),
    settings: (await db.select().from(s.settings))
      .filter((r) => !SKIP_SETTINGS.test(r.key))
      .map((r) => {
        // EN: Fixed single pieces travel by code (ids differ online). PT: As peças fixas soltas vão pelo código.
        if (r.key !== "store.fixed") return { key: r.key, value: r.value };
        const v = r.value as { categories?: string[]; products?: string[] };
        return { key: r.key, value: { categories: v.categories ?? [], productCodes: (v.products ?? []).map((id) => codeOf.get(id)).filter(Boolean) } };
      }),
    customers: await (async () => {
      const rows = await db.select().from(s.customers).where(and(eq(s.customers.origin, "import"), eq(s.customers.isDemo, false)));
      const points = await db.select().from(s.loyaltyEntries).where(ne(s.loyaltyEntries.kind, "adjust"));
      return rows.map((c) => ({
        phone: c.phone,
        email: c.email,
        name: c.name,
        locale: c.locale,
        levelOverride: c.levelOverride,
        levelOverrideYear: c.levelOverrideYear,
        levelReason: c.levelReason,
        loyalty: points.filter((e) => e.customerId === c.id && e.kind === "import").map((e) => ({ year: e.year, kind: e.kind, points: e.points, reason: e.reason, actorName: e.actorName })),
      }));
    })(),
    files: [] as { path: string; type: string; offset: number; size: number }[],
  };

  // EN: Photo offsets inside the file. PT: Posição de cada foto dentro do ficheiro.
  let offset = 0;
  for (const f of files.values()) {
    const full = path.join(PUBLIC_DIR, f.path.replace(/^\/uploads\//, ""));
    const size = (await stat(full).catch(() => null))?.size;
    if (!size) {
      console.warn("missing / em falta:", f.path);
      continue;
    }
    header.files.push({ ...f, offset, size });
    offset += size;
  }

  const outDir = path.join(process.cwd(), ".data", "transfer");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "eterna-site.dados");
  const json = Buffer.from(JSON.stringify(header), "utf8");
  const stream = createWriteStream(out);
  const write = (b: Buffer | string) => new Promise<void>((ok, fail) => stream.write(b, (e) => (e ? fail(e) : ok())));
  await write(`${json.length}\n`);
  await write(json);
  for (const f of header.files) await write(await readFile(path.join(PUBLIC_DIR, f.path.replace(/^\/uploads\//, ""))));
  await new Promise<void>((ok) => stream.end(ok));

  console.log(`✓ ${out}`);
  console.log(
    `  ${header.categories.length} categorias · ${header.products.length} peças · ${header.files.length} fotos (${(offset / 1024 / 1024).toFixed(0)} MB) · ${header.sections.length} secções · ${header.tiles.length} ocasiões · ${header.settings.length} definições · ${header.customers.length} clientes · dados ${(json.length / 1024).toFixed(0)} KB`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
