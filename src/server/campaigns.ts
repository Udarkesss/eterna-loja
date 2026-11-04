import "server-only";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { cache } from "react";
import type { Locale } from "@/types";
import { getDb } from "./db";
import { campaignItems, campaigns, type CampaignColors } from "./db/schema";
import { discountSettings } from "./discounts";

/**
 * EN: Price campaigns on the site (design V3): a campaign runs between its dates once scheduled; its pieces show the −%
 *     badge and the struck-through price everywhere (lists, product page, search, favourites, checkout). With a sale
 *     price on the piece, the larger discount applies. "Campanhas" switched off in Gestão · Descontos stops them all.
 * PT: Campanhas de preços no site (V3): uma campanha decorre entre as datas depois de agendada; as peças mostram o selo
 *     −% e o preço riscado em todo o lado. Com preço de saldo na peça, aplica-se o maior desconto. "Campanhas" desligado
 *     em Gestão · Descontos pára todas.
 */

export const CAMPAIGN_COLORS: CampaignColors = { band: "#E9D8CF", desc: "#E9D8CF", title: "#2B2320", accent: "#A63A2B", text: "#655047", button: "#1C1917", buttonText: "#FAF7F2" };

/** EN: Campaign price, rounded to 50 MT like the design. PT: Preço de campanha, arredondado a 50 MT como no design. */
export const campaignPrice = (price: number, percent: number) => Math.round((price * (100 - percent)) / 100 / 50) * 50;

export type LiveCampaign = typeof campaigns.$inferSelect & { items: { productId: string; percent: number }[] };

/** EN: Campaigns running now (read once per request). PT: Campanhas a decorrer agora (lidas uma vez por pedido). */
export const liveCampaigns = cache(async (): Promise<LiveCampaign[]> => {
  if (!(await discountSettings()).campaigns) return [];
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.startsAt, now), gt(campaigns.endsAt, now)))
    .orderBy(asc(campaigns.startsAt));
  if (!rows.length) return [];
  const items = await db
    .select()
    .from(campaignItems)
    .where(inArray(campaignItems.campaignId, rows.map((r) => r.id)))
    .orderBy(asc(campaignItems.position));
  return rows.map((r) => ({
    ...r,
    items: items.filter((i) => i.campaignId === r.id).map((i) => ({ productId: i.productId, percent: r.discountMode === "per_piece" && i.percent ? i.percent : r.percent })),
  }));
});

/** EN: productId → best campaign percent right now. PT: productId → maior percentagem de campanha agora. */
export async function campaignPercents(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const c of await liveCampaigns()) for (const i of c.items) out.set(i.productId, Math.max(out.get(i.productId) ?? 0, i.percent));
  return out;
}

export interface CampaignView {
  slug: string;
  name: string;
  phrase: string | null;
  kind: "normal" | "flash";
  startsAt: string;
  endsAt: string;
  topBar: boolean;
  homePlacement: "before" | "after" | "none";
  ownPage: boolean;
  countdown: boolean;
  colors: CampaignColors;
  imageUrl: string | null;
  productIds: string[];
  maxPercent: number;
}

const toView = (c: LiveCampaign, locale: Locale): CampaignView => ({
  slug: c.slug,
  name: c.name[locale] || c.name.pt,
  phrase: c.phrase?.[locale] || c.phrase?.pt || null,
  kind: c.kind,
  startsAt: c.startsAt.toISOString(),
  endsAt: c.endsAt.toISOString(),
  topBar: c.topBar,
  homePlacement: c.homePlacement,
  ownPage: c.ownPage,
  countdown: c.countdown,
  colors: { ...CAMPAIGN_COLORS, ...(c.colors ?? {}) },
  imageUrl: c.imageUrl,
  productIds: c.items.map((i) => i.productId),
  maxPercent: Math.max(0, ...c.items.map((i) => i.percent)),
});

/** EN: The campaign shown on the site (the first running one). PT: A campanha mostrada no site (a primeira a decorrer). */
export async function siteCampaign(locale: Locale): Promise<CampaignView | null> {
  const [first] = await liveCampaigns();
  return first ? toView(first, locale) : null;
}

export async function campaignBySlug(slug: string, locale: Locale): Promise<CampaignView | null> {
  const found = (await liveCampaigns()).find((c) => c.slug === slug && c.ownPage);
  return found ? toView(found, locale) : null;
}
