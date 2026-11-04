import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { formatMZN } from "@/lib/format";
import { fromMaputo, toMaputo } from "@/lib/time";
import { audit } from "../audit";
import { CAMPAIGN_COLORS, campaignPrice } from "../campaigns";
import { getDb } from "../db";
import { campaignItems, campaigns, categories, productCategories, productImages, products, productVariants, type CampaignColors } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";
import { readXlsx } from "../xlsx";

/**
 * EN: "Gestão · Nova campanha" of design V3-G-Campanha-Editar: name, dates and times (normal or flash), phrase, discount
 *     for all pieces or per piece, the pieces (by collection, occasion, Noivas, Acessórios, Modeladores, type, piece by
 *     piece or Excel), where it appears and the state (Rascunho · Agendada · A decorrer · Terminada).
 * PT: Nova campanha do V3: nome, datas e horas (normal ou relâmpago), frase, desconto igual ou por peça, as peças, onde
 *     aparece e o estado (Rascunho · Agendada · A decorrer · Terminada).
 */

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });
export type CampaignState = "draft" | "scheduled" | "running" | "ended";

export function stateOf(c: { status: string; startsAt: Date; endsAt: Date }, now = new Date()): CampaignState {
  if (c.status === "draft") return "draft";
  if (c.endsAt <= now) return "ended";
  return c.startsAt <= now ? "running" : "scheduled";
}

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const day = (d: Date) => {
  const [, m, dd] = toMaputo(d).date.split("-").map(Number);
  return { d: dd, m: SHORT[m - 1] };
};
export function campaignDatesLabel(a: Date, b: Date) {
  const x = day(a);
  const y = day(b);
  return x.m === y.m ? (x.d === y.d ? `${x.d} ${x.m}` : `${x.d} – ${y.d} ${y.m}`) : `${x.d} ${x.m} – ${y.d} ${y.m}`;
}

export async function listCampaignsAdmin() {
  const db = await getDb();
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.startsAt));
  const counts = rows.length ? await db.select({ id: campaignItems.campaignId }).from(campaignItems).where(inArray(campaignItems.campaignId, rows.map((r) => r.id))) : [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name.pt,
    note: r.kind === "flash" ? "relâmpago" : r.discountMode === "uniform" ? `−${r.percent}% em peças seleccionadas` : "desconto por peça",
    year: Number(toMaputo(r.startsAt).date.slice(0, 4)),
    dates: campaignDatesLabel(r.startsAt, r.endsAt),
    startsOn: toMaputo(r.startsAt).date,
    endsOn: toMaputo(r.endsAt).date,
    pieces: counts.filter((c) => c.id === r.id).length,
    state: stateOf(r),
    imageUrl: r.imageUrl,
  }));
}

export interface CampaignPiece {
  id: string;
  code: string;
  price: number;
  image: string | null;
  percent: number | null;
}

export async function getCampaignForEdit(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw new AppError("NOT_FOUND", "Campanha não encontrada.", 404);
  const items = await db.select().from(campaignItems).where(eq(campaignItems.campaignId, id)).orderBy(asc(campaignItems.position));
  return { row, pieces: await piecesByIds(items.map((i) => i.productId), new Map(items.map((i) => [i.productId, i.percent]))) };
}

async function piecesByIds(ids: string[], percents = new Map<string, number | null>()): Promise<CampaignPiece[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select({ id: products.id, code: products.code, price: products.price }).from(products).where(inArray(products.id, ids));
  const imgs = await db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position));
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ ...r, image: imgs.find((i) => i.productId === r.id)?.url ?? null, percent: percents.get(r.id) ?? null }));
}

/** EN: Groups to pick pieces from (only published pieces with stock enter). PT: Grupos para escolher peças. */
export async function pickerGroups() {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const pick = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).map((r) => ({ id: r.id, name: r.name.pt }));
  return {
    collections: pick((r) => r.kind === "collection" && !r.details?.history),
    occasions: pick((r) => r.kind === "occasion"),
    departments: pick((r) => ["noivas", "acessorios", "modeladores"].includes(r.slug)),
    types: pick((r) => r.kind === "type"),
  };
}

/** EN: Pieces of a group (with descendants), published and with stock. PT: Peças de um grupo, publicadas e com stock. */
export async function piecesOfGroup(categoryId: string): Promise<CampaignPiece[]> {
  const db = await getDb();
  const rows = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
  const ids = [categoryId];
  for (let i = 0; i < ids.length; i++) for (const r of rows) if (r.parentId === ids[i]) ids.push(r.id);
  const linked = await db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, ids));
  const typed = await db.select({ id: products.id }).from(products).where(inArray(products.typeId, ids));
  return availablePieces([...new Set([...linked.map((l) => l.id), ...typed.map((t) => t.id)])]);
}

async function availablePieces(ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  const pub = await db.select({ id: products.id }).from(products).where(and(inArray(products.id, ids), eq(products.status, "published")));
  const withStock = await db
    .selectDistinct({ id: productVariants.productId })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, pub.map((p) => p.id).length ? pub.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"]), gt(productVariants.stock, 0)));
  return piecesByIds(withStock.map((w) => w.id));
}

/** EN: "Peça a peça": by codes. PT: Por códigos. */
export async function piecesByCodes(codes: string[]) {
  const clean = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!clean.length) return { pieces: [], missing: [] };
  const db = await getDb();
  const rows = await db.select({ id: products.id, code: products.code }).from(products).where(inArray(products.code, clean));
  const pieces = await availablePieces(rows.map((r) => r.id));
  return { pieces, missing: clean.filter((c) => !pieces.some((p) => p.code === c)) };
}

/** EN: "Importar Excel": first column = code, optional second = percent. PT: 1.ª coluna = código, 2.ª opcional = %. */
export async function piecesFromExcel(file: Buffer) {
  const rows = readXlsx(file).slice(1);
  const codes = rows.map((r) => (r[0] ?? "").trim()).filter(Boolean);
  const pct = new Map(rows.filter((r) => r[0] && r[1]).map((r) => [r[0].trim().toUpperCase(), Math.round(Number(String(r[1]).replace(/[^\d.]/g, "")))]));
  const found = await piecesByCodes(codes);
  return { ...found, pieces: found.pieces.map((p) => ({ ...p, percent: pct.get(p.code) || null })) };
}

export interface CampaignInput {
  id?: string;
  name: string;
  phrase: string;
  kind: "normal" | "flash";
  startsAt: string; // EN: yyyy-mm-ddThh:mm (Maputo). PT: hora de Maputo.
  endsAt: string;
  discountMode: "uniform" | "per_piece";
  percent: number;
  topBar: boolean;
  homePlacement: "before" | "after" | "none";
  ownPage: boolean;
  countdown: boolean;
  colors: CampaignColors;
  imageUrl: string | null;
  items: { productId: string; percent: number | null }[];
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toDate = (local: string) => fromMaputo(local.slice(0, 10), local.slice(11, 16) || "00:00");

export async function saveCampaign(staff: StaffContext, input: CampaignInput): Promise<string> {
  const db = await getDb();
  const startsAt = toDate(input.startsAt);
  const endsAt = toDate(input.endsAt);
  if (!(endsAt > startsAt)) throw new AppError("VALIDATION_ERROR", "O fim tem de ser depois do início.", 400);
  if (input.percent < 1 || input.percent > 90) throw new AppError("VALIDATION_ERROR", "O desconto tem de estar entre 1% e 90%.", 400);
  const [existing] = input.id ? await db.select().from(campaigns).where(eq(campaigns.id, input.id)) : [];
  if (input.id && !existing) throw new AppError("NOT_FOUND", "Campanha não encontrada.", 404);
  const values = {
    name: { pt: input.name.trim(), en: existing?.name.en && existing.name.pt === input.name.trim() ? existing.name.en : input.name.trim() },
    phrase: input.phrase ? { pt: input.phrase, en: existing?.phrase?.en && existing.phrase.pt === input.phrase ? existing.phrase.en : input.phrase } : null,
    kind: input.kind,
    startsAt,
    endsAt,
    discountMode: input.discountMode,
    percent: input.percent,
    topBar: input.topBar,
    homePlacement: input.homePlacement,
    ownPage: input.ownPage,
    countdown: input.countdown,
    colors: { ...CAMPAIGN_COLORS, ...input.colors },
    imageUrl: input.imageUrl,
    updatedAt: new Date(),
  };
  let id = existing?.id;
  if (existing) await db.update(campaigns).set(values).where(eq(campaigns.id, existing.id));
  else {
    let slug = slugify(`${input.name}-${toMaputo(startsAt).date.slice(0, 4)}`);
    const [taken] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.slug, slug));
    if (taken) slug = `${slug}-${Date.now().toString(36)}`;
    const [row] = await db.insert(campaigns).values({ slug, ...values }).returning({ id: campaigns.id });
    id = row.id;
  }
  await db.delete(campaignItems).where(eq(campaignItems.campaignId, id!));
  if (input.items.length)
    await db.insert(campaignItems).values(
      input.items.map((i, position) => ({ campaignId: id!, productId: i.productId, percent: input.discountMode === "per_piece" ? i.percent : null, position })),
    );
  await audit({ actor: actor(staff), action: existing ? "Campanha alterada" : "Campanha criada", detail: `${input.name} · ${input.items.length} peças` });
  return id!;
}

/**
 * EN: "Agendar campanha" / "Começar agora" / "Terminar agora" / back to draft. PT: Agendar, começar, terminar ou rascunho.
 */
export async function setCampaignState(staff: StaffContext, id: string, action: "schedule" | "start" | "end" | "draft") {
  const db = await getDb();
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw new AppError("NOT_FOUND", "Campanha não encontrada.", 404);
  const items = await db.select({ id: campaignItems.productId }).from(campaignItems).where(eq(campaignItems.campaignId, id));
  if ((action === "schedule" || action === "start") && !items.length) throw new AppError("VALIDATION_ERROR", "Escolha as peças antes de agendar.", 400);
  const now = new Date();
  const patch =
    action === "schedule"
      ? { status: "scheduled" as const }
      : action === "start"
        ? { status: "scheduled" as const, startsAt: now, endsAt: row.endsAt > now ? row.endsAt : new Date(now.getTime() + (row.endsAt.getTime() - row.startsAt.getTime())) }
        : action === "end"
          ? { endsAt: now }
          : { status: "draft" as const };
  await db.update(campaigns).set({ ...patch, updatedAt: now }).where(eq(campaigns.id, id));
  const label = { schedule: "Campanha agendada", start: "Campanha começada agora", end: "Campanha terminada", draft: "Campanha passada a rascunho" }[action];
  await audit({ actor: actor(staff), action: label, detail: row.name.pt });
}

/** EN: Old and campaign price for the grid. PT: Preço antigo e de campanha para a grelha. */
export const priceLine = (price: number, pct: number) => ({ old: formatMZN(price, "pt"), now: formatMZN(campaignPrice(price, pct), "pt") });
