import "server-only";
import { asc, eq, and } from "drizzle-orm";
import { infoPages, legalPages } from "@/data/site";
import type { Localized } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, contentSections, occasionTiles } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · 8 Conteúdo do site" and "9 Vídeo, parallax e ocasiões". Section fields are stored as JSON
 *     with { pt, en } texts; publishing saves order, visibility and fields at once.
 * PT: Conteúdo do site. Os campos das secções ficam em JSON com textos { pt, en }; publicar guarda ordem,
 *     visibilidade e campos de uma vez.
 */

export const SECTION_LABELS: Record<string, string> = {
  announcement: "Faixa de anúncio",
  hero: "Imagem principal",
  manifesto: "Manifesto",
  occasions: "Ocasiões",
  new_arrivals: "Novidades",
  privee_divider: "Separador Eterna Privée",
  bridal: "Eterna Bridal",
  experience: "A experiência Eterna",
  privee_band: "Faixa Privée",
  secure: "Compra segura",
  stores: "As nossas lojas",
  social: "Redes sociais",
};

export const INFO_LABELS: Record<string, string> = {
  tamanhos: "Guia de tamanhos",
  "trocas-devolucoes": "Trocas & Devoluções",
  reservas: "Reservas",
  pagamentos: "Pagamentos",
  envios: "Envios",
  "perguntas-frequentes": "Perguntas frequentes",
  termos: "Termos e condições",
  privacidade: "Política de privacidade",
};

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function listSections(page: "home" | "info") {
  const db = await getDb();
  const rows = await db.select().from(contentSections).where(eq(contentSections.page, page)).orderBy(asc(contentSections.position));
  if (page === "home") return rows;
  // EN: Info pages that were never edited appear empty. PT: Páginas nunca editadas aparecem vazias.
  return [...infoPages, ...legalPages].map(
    (slug, position) =>
      rows.find((r) => r.key === slug) ?? {
        id: `new-${slug}`,
        page: "info",
        key: slug,
        position,
        visible: true,
        data: { body: { pt: "", en: "" } },
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
  );
}

export interface SectionSave {
  key: string;
  visible: boolean;
  data: Record<string, unknown>;
}

/** EN: Saves the whole page (order = array order). PT: Guarda a página inteira (ordem = ordem da lista). */
export async function publishPage(staff: StaffContext, page: "home" | "info", sections: SectionSave[]) {
  const db = await getDb();
  const allowed = page === "home" ? Object.keys(SECTION_LABELS) : Object.keys(INFO_LABELS);
  await db.transaction(async (tx) => {
    for (const [position, sec] of sections.entries()) {
      if (!allowed.includes(sec.key)) throw new AppError("VALIDATION_ERROR", `Unknown section ${sec.key}`, 400);
      const values = { page, key: sec.key, position, visible: sec.visible, data: sec.data, publishedAt: new Date() };
      await tx
        .insert(contentSections)
        .values(values)
        .onConflictDoUpdate({ target: [contentSections.page, contentSections.key], set: values });
    }
  });
  await audit({ actor: actor(staff), action: "Conteúdo do site publicado", detail: page === "home" ? "Início" : "Informações" });
}

// ── Occasion tiles / Ocasiões especiais ───────────────────────────────

export async function listTiles() {
  const db = await getDb();
  return db.select().from(occasionTiles).orderBy(asc(occasionTiles.position));
}

export async function listOccasionTargets() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  return rows.filter((r) => r.kind === "occasion" || r.kind === "department" || r.kind === "collection").map((r) => ({ id: r.id, name: r.name.pt, kind: r.kind }));
}

export interface TileSave {
  id?: string;
  name: Localized;
  phrase: Localized;
  imageUrl: string;
  categoryId: string | null;
  size: "large" | "tall" | "normal";
}

/** EN: "Ocasiões especiais": replaces the list in the given order. PT: Substitui a lista pela ordem dada. */
export async function saveTiles(staff: StaffContext, tiles: TileSave[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: occasionTiles.id }).from(occasionTiles);
    const keep = new Set<string>();
    for (const [position, t] of tiles.entries()) {
      const values = { name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, categoryId: t.categoryId, size: t.size, position };
      if (t.id && current.some((c) => c.id === t.id)) {
        await tx.update(occasionTiles).set(values).where(eq(occasionTiles.id, t.id));
        keep.add(t.id);
      } else {
        const [row] = await tx.insert(occasionTiles).values(values).returning({ id: occasionTiles.id });
        keep.add(row.id);
      }
    }
    for (const c of current) if (!keep.has(c.id)) await tx.delete(occasionTiles).where(eq(occasionTiles.id, c.id));
  });
  await audit({ actor: actor(staff), action: "Ocasiões do Início publicadas", detail: `${tiles.length} ocasiões` });
}

/** EN: Hero media + parallax live in the "hero" section data. PT: Media e parallax ficam nos dados da secção "hero". */
export async function saveHero(staff: StaffContext, patch: Record<string, unknown>) {
  const db = await getDb();
  const [row] = await db.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "hero")));
  if (!row) throw new AppError("NOT_FOUND", "Hero section missing", 404);
  await db
    .update(contentSections)
    .set({ data: { ...row.data, ...patch }, publishedAt: new Date() })
    .where(eq(contentSections.id, row.id));
  await audit({ actor: actor(staff), action: "Imagem principal publicada", detail: String(patch.media ?? "") });
}
