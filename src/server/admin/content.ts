import "server-only";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { HOME_KEYS } from "@/data/content";
import { infoPages, legalPages } from "@/data/site";
import type { Season } from "@/data/seasons";
import type { Localized } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, contentSections, occasionTiles } from "../db/schema";
import { AppError } from "../errors";
import { setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · 8 Conteúdo do site" and "9 Vídeo, parallax e ocasiões". Section fields are stored as JSON
 *     with { pt, en } texts; publishing saves order, visibility and fields at once.
 * PT: Conteúdo do site. Os campos das secções ficam em JSON com textos { pt, en }; publicar guarda ordem,
 *     visibilidade e campos de uma vez.
 */

/** EN: Home sections of design V3 (src/data/content.ts, HOME_KEYS), named as in "Gestão · Conteúdo". PT: Secções do V3. */
export const SECTION_LABELS: Record<string, string> = {
  announcement: "Barra de anúncio",
  hero: "Topo · vídeo ou slides",
  entrada: "Entrada · frase",
  colecao: "Colecção activa",
  ocasioes: "Ocasiões",
  novidades: "Acabadas de chegar",
  noivas: "Noivas · Eterna Bridal",
  acessorios: "Acessórios",
  modeladores: "Modeladores",
  sobre: "Sobre nós",
  contactos: "Contacte-nos",
} satisfies Record<(typeof HOME_KEYS)[number], string>;

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
  return rows
    .filter((r) => r.kind === "occasion" || r.kind === "department" || r.kind === "collection")
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name.pt, kind: r.kind }));
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

const text = (max: number) => z.object({ pt: z.string().trim().max(max), en: z.string().trim().max(max) });
const path = z.string().trim().max(500);

/** EN: What the hero editor may change. PT: O que o editor do topo pode mudar. */
const heroPatchSchema = z
  .object({
    media: z.enum(["video", "slides"]),
    videoDesktop: path,
    videoMobile: path,
    poster: path,
    posterMobile: path,
    image: path,
    autoplay: z.boolean(),
    loop: z.boolean(),
    parallax: z.boolean(),
    parallaxIntensity: z.number().min(0).max(0.5),
    progress: z.boolean(),
    reveal: z.boolean(),
    scrollbar: z.boolean(),
    slidesAuto: z.boolean(),
    slides: z
      .array(
        z.object({
          image: path.min(1, "Cada slide precisa de uma imagem."),
          position: z.string().trim().max(40),
          eyebrow: text(60),
          title: text(60),
          text: text(140),
          cta: text(32),
          href: z.string().trim().max(300),
          on: z.boolean(),
        }),
      )
      .max(8, "No máximo 8 slides."),
  })
  .partial();

/** EN: Hero media + parallax live in the "hero" section data. PT: Media e parallax ficam nos dados da secção "hero". */
export async function saveHero(staff: StaffContext, input: Record<string, unknown>) {
  const parsed = heroPatchSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  const patch = parsed.data;
  if (patch.media === "slides" && !patch.slides?.some((s) => s.on)) throw new AppError("VALIDATION_ERROR", "Ligue pelo menos um slide.", 400);
  const db = await getDb();
  const [row] = await db.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "hero")));
  if (!row) throw new AppError("NOT_FOUND", "Hero section missing", 404);
  await db
    .update(contentSections)
    .set({ data: { ...row.data, ...patch }, publishedAt: new Date() })
    .where(eq(contentSections.id, row.id));
  await audit({ actor: actor(staff), action: "Imagem principal publicada", detail: String(patch.media ?? "") });
}


// ── Times of the year / Épocas do ano ─────────────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const md = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const seasonSchema = z.object({
  id: z.string().trim().min(1).max(40),
  on: z.boolean(),
  name: text(80),
  from: md,
  to: md,
  effect: z.enum(["sparkles", "snow", "hearts", "none"]),
  placement: z.enum(["before", "after", "none"]),
  textSide: z.enum(["right", "left", "top", "bottom"]),
  media: z.enum(["photo", "slides", "video"]),
  images: z.array(path).max(8),
  video: path,
  badge: text(80),
  title: text(120),
  text: text(600),
  button: text(60),
  href: path,
  bar: text(160),
  codes: z.array(z.string().trim().max(40)).max(8),
  colors: z.object({ band: hex, desc: hex, title: hex, accent: hex, text: hex, button: hex, buttonText: hex }),
});

/** EN: Saves the times of the year (setting "seasons"). PT: Guarda as épocas do ano (definição "seasons"). */
export async function saveSeasons(staff: StaffContext, input: unknown) {
  const parsed = z.array(seasonSchema).max(20).safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Verifique as épocas: datas (MM-DD), cores e textos.", 400);
  const ids = parsed.data.map((x) => x.id);
  if (new Set(ids).size !== ids.length) throw new AppError("VALIDATION_ERROR", "Há duas épocas com o mesmo identificador.", 400);
  await setSetting("seasons", parsed.data satisfies Season[], staff.id);
  await audit({ actor: actor(staff), action: "Épocas do ano publicadas", detail: parsed.data.map((x) => `${x.name.pt}${x.on ? "" : " (desligada)"}`).join(", ") });
}
