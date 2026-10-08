"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { DeliveryPricing } from "@/lib/delivery";
import { audit } from "@/server/audit";
import { getDb } from "@/server/db";
import { deliveryZones, staffUsers } from "@/server/db/schema";
import { markPayoutPaid, type Period } from "@/server/delivery";
import { AppError } from "@/server/errors";
import { setSetting } from "@/server/settings";
import { accessOf, requireStaffAction, type StaffContext } from "@/server/staff/access";

/**
 * EN: "Gestão · 4 Entregas" settings: delivery price (fixed / by zone / by distance), driver commission and payouts.
 *     Matrix: deliveries.pricing and commissions.pay are T for Superadministrador and Administrador only.
 * PT: Definições das entregas: preço, comissão do entregador e pagamentos. Só Superadministrador e Administrador.
 */

export interface DeliveryResult {
  ok: boolean;
  message?: string;
}

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });
const money = (v: number | null) => (v == null || !Number.isFinite(v) || v < 0 ? null : Math.round(v));

async function run(fn: () => Promise<unknown>, message: string): Promise<DeliveryResult> {
  try {
    await fn();
    revalidatePath("/gestao/entregas");
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export async function savePricingAction(pricing: DeliveryPricing, zones: { id: string; fee: number | null }[]) {
  const staff = await requireStaffAction("deliveries.pricing", "view");
  if (accessOf(staff, "deliveries.pricing") !== "T") return { ok: false, message: "O seu papel só pode ver os preços." };
  return run(async () => {
    const clean: DeliveryPricing = {
      mode: ["fixed", "zone", "distance"].includes(pricing.mode) ? pricing.mode : "zone",
      fixedFee: money(pricing.fixedFee),
      baseFee: money(pricing.baseFee),
      perKm: money(pricing.perKm),
      maxFee: money(pricing.maxFee),
    };
    await setSetting("delivery.pricing", clean, staff.id);
    const db = await getDb();
    for (const z of zones) await db.update(deliveryZones).set({ fee: money(z.fee) }).where(eq(deliveryZones.id, z.id));
    const MODE = { fixed: "valor fixo", zone: "por zona", distance: "por distância" };
    await audit({ actor: actor(staff), action: "Preço da entrega alterado", detail: MODE[clean.mode] });
  }, "Preços guardados. O checkout já usa os novos valores.");
}

export async function saveCommissionsAction(generalPct: number, drivers: { id: string; pct: number | null }[]) {
  const staff = await requireStaffAction("commissions.pay");
  return run(async () => {
    const pct = Math.min(100, Math.max(0, Math.round(generalPct)));
    await setSetting("delivery.commissionPct", pct, staff.id);
    const db = await getDb();
    for (const d of drivers) {
      await db
        .update(staffUsers)
        .set({ commissionPct: d.pct == null ? null : Math.min(100, Math.max(0, Math.round(d.pct))) })
        .where(eq(staffUsers.id, d.id));
    }
    await audit({ actor: actor(staff), action: "Comissões dos entregadores alteradas", detail: `Geral ${pct}%` });
  }, "Comissões guardadas.");
}

export async function markPaidAction(driverId: string, period: Period) {
  const staff = await requireStaffAction("commissions.pay");
  return run(() => markPayoutPaid(staff, driverId, period), "Marcado como pago.");
}
