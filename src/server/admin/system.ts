import "server-only";
import { z } from "zod";
import { BRIDAL_DEFAULT, type BridalSettings } from "@/data/bridal";
import { LOYALTY_SETTINGS_DEFAULT, type LoyaltySettings } from "@/data/loyalty";
import { ASSISTANT_DEFAULT, type AssistantSettings } from "@/data/assistant";
import { audit } from "../audit";
import { AppError } from "../errors";
import { RESERVATIONS_DEFAULT, type ReservationSettings } from "../reservations";
import { getSetting, setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Definições" of design V3-G-Definicoes (only the Superadministrador changes them): reservations, Bridal fittings
 *     on/off, price on the cards, the loyalty programme, the delivery module with the map provider and the assistant.
 *     Stores and contacts are edited in Site → Contactos e redes sociais; fitting packages in Provas · Bridal.
 * PT: "Definições" do V3 (só o Superadministrador altera): reservas, provas da Bridal, preço nos cartões, programa de
 *     fidelidade, módulo de entregas com o fornecedor de mapas e o assistente. Lojas e contactos editam-se em Contactos;
 *     os pacotes de provas em Provas · Bridal.
 */

export type MapsProvider = "osm" | "google";

export interface SystemSettings {
  reservations: ReservationSettings;
  fittings: boolean;
  cardPrice: boolean;
  cardPriceCampaigns: boolean;
  loyalty: LoyaltySettings;
  delivery: boolean;
  maps: MapsProvider;
  assistant: { site: boolean; whatsapp: boolean };
}

export async function loadSystemSettings(): Promise<SystemSettings> {
  const [reservations, bridal, cardPrice, cardPriceCampaigns, loyalty, delivery, maps, assistant] = await Promise.all([
    getSetting<ReservationSettings>("reservations", RESERVATIONS_DEFAULT),
    getSetting<BridalSettings>("fittings.bridal", BRIDAL_DEFAULT),
    getSetting<boolean>("catalog.cardPrice", false),
    getSetting<boolean>("catalog.cardPriceCampaigns", true),
    getSetting<LoyaltySettings>("loyalty", LOYALTY_SETTINGS_DEFAULT),
    getSetting<boolean>("delivery.enabled", false),
    getSetting<MapsProvider>("maps.provider", "osm"),
    getSetting<AssistantSettings>("assistant", ASSISTANT_DEFAULT),
  ]);
  return { reservations, fittings: bridal.enabled, cardPrice, cardPriceCampaigns, loyalty, delivery, maps, assistant: { site: assistant.site, whatsapp: assistant.whatsapp } };
}

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const schema = z.object({
  reservations: z.object({
    depositPct: int(1, 100),
    days: int(1, 365),
    bridalDays: int(1, 365),
    remindDays: int(0, 60),
    extendDays: int(0, 180),
    bridalExtendDays: int(0, 180),
    maxExtensions: int(0, 10),
    allowExtend: z.boolean(),
    askMoreTime: z.boolean(),
    showReserved: z.boolean(),
    notifyStaff: z.boolean(),
    message: z.string().trim().min(1).max(600),
  }),
  fittings: z.boolean(),
  cardPrice: z.boolean(),
  cardPriceCampaigns: z.boolean(),
  loyalty: z.object({
    on: z.boolean(),
    mtPerPoint: int(1, 1_000_000),
    levels: z.array(z.object({ key: z.enum(["rubi", "safira", "perola", "diamante"]), min: int(0, 1_000_000), max: int(0, 1_000_000).nullable(), pct: int(0, 90) })).length(4),
    storePoints: z.boolean(),
    onReservations: z.boolean(),
    withSales: z.enum(["max", "stack"]),
  }),
  delivery: z.boolean(),
  maps: z.enum(["osm", "google"]),
  assistant: z.object({ site: z.boolean(), whatsapp: z.boolean() }),
});

export async function saveSystemSettings(staff: StaffContext, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Verifique os valores: números inteiros e a mensagem preenchida.", 400);
  const d = parsed.data;
  // EN: Levels in order, without gaps or overlaps. PT: Níveis por ordem, sem buracos nem sobreposições.
  const lv = d.loyalty.levels;
  if (lv[0].min !== 0) throw new AppError("VALIDATION_ERROR", "O primeiro nível começa em 0 pontos.", 400);
  for (let i = 0; i < lv.length; i++) {
    const next = lv[i + 1];
    if (next && (lv[i].max == null || lv[i].max! + 1 !== next.min)) throw new AppError("VALIDATION_ERROR", "Cada nível começa logo a seguir ao anterior (ex.: 0–29, 30–69…).", 400);
    if (lv[i].max != null && lv[i].max! < lv[i].min) throw new AppError("VALIDATION_ERROR", "Num nível, “Até” não pode ser menor do que “De”.", 400);
  }
  if (lv[lv.length - 1].max !== null) lv[lv.length - 1].max = null;

  const before = await loadSystemSettings();
  const actor = { type: "staff" as const, id: staff.id, name: staff.name, role: staff.roleName };
  const changes: string[] = [];
  await setSetting("reservations", d.reservations, staff.id);
  if (JSON.stringify(before.reservations) !== JSON.stringify(d.reservations)) changes.push("Reservas");
  if (before.fittings !== d.fittings) {
    const bridal = await getSetting<BridalSettings>("fittings.bridal", BRIDAL_DEFAULT);
    await setSetting("fittings.bridal", { ...bridal, enabled: d.fittings }, staff.id);
    changes.push(d.fittings ? "Provas ligadas" : "Provas desligadas");
  }
  if (before.cardPrice !== d.cardPrice) {
    await setSetting("catalog.cardPrice", d.cardPrice, staff.id);
    changes.push(d.cardPrice ? "Preço nos cartões ligado" : "Preço nos cartões desligado");
  }
  if (before.cardPriceCampaigns !== d.cardPriceCampaigns) {
    await setSetting("catalog.cardPriceCampaigns", d.cardPriceCampaigns, staff.id);
    changes.push(d.cardPriceCampaigns ? "Campanhas mostram sempre o preço" : "Campanhas seguem o preço nos cartões");
  }
  if (JSON.stringify(before.loyalty) !== JSON.stringify(d.loyalty)) {
    await setSetting("loyalty", d.loyalty, staff.id);
    changes.push(before.loyalty.on !== d.loyalty.on ? (d.loyalty.on ? "Programa de fidelidade ligado" : "Programa de fidelidade desligado") : "Programa de fidelidade");
  }
  if (before.delivery !== d.delivery) {
    await setSetting("delivery.enabled", d.delivery, staff.id);
    changes.push(d.delivery ? "Módulo de entregas ligado" : "Módulo de entregas desligado");
  }
  if (before.maps !== d.maps) {
    await setSetting("maps.provider", d.maps, staff.id);
    changes.push(`Mapas: ${d.maps === "google" ? "Google Maps" : "OpenStreetMap"}`);
  }
  if (before.assistant.site !== d.assistant.site || before.assistant.whatsapp !== d.assistant.whatsapp) {
    const a = await getSetting<AssistantSettings>("assistant", ASSISTANT_DEFAULT);
    await setSetting("assistant", { ...a, site: d.assistant.site, whatsapp: d.assistant.whatsapp }, staff.id);
    if (before.assistant.site !== d.assistant.site) changes.push(`Chat no site ${d.assistant.site ? "ligado" : "desligado"}`);
    if (before.assistant.whatsapp !== d.assistant.whatsapp) changes.push(`Assistente no WhatsApp ${d.assistant.whatsapp ? "ligado" : "desligado"}`);
  }
  await audit({ actor, action: "Definições alteradas", detail: changes.join(" · ") || "Sem mudanças" });
}
