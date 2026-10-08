import "server-only";
import { asc, eq } from "drizzle-orm";
import { FITTING_SETTINGS_DEFAULT, type FittingSettings } from "@/data/fittings";
import type { Localized } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { stores } from "../db/schema";
import { AppError } from "../errors";
import { getSetting, setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Definições" (Superadministrador only): store details and hours, and the fitting schedule.
 * PT: "Definições" (só Superadministrador): dados e horário das lojas e horário das provas.
 */

export async function loadSystemSettings() {
  const db = await getDb();
  const [storeRows, schedule] = await Promise.all([
    db.select().from(stores).orderBy(asc(stores.position)),
    getSetting<FittingSettings>("fittings.schedule", FITTING_SETTINGS_DEFAULT),
  ]);
  return {
    stores: storeRows.map((s) => ({ id: s.id, code: s.code, name: s.name, location: s.location, phone: s.phone, hours: s.hours ?? { pt: "", en: "" } })),
    schedule,
  };
}

export interface SystemSave {
  stores: { id: string; name: string; location: string; phone: string; hours: Localized }[];
  schedule: FittingSettings;
}

export async function saveSystemSettings(staff: StaffContext, input: SystemSave) {
  const sc = input.schedule;
  const valid = /^\d{2}:\d{2}$/;
  if (!valid.test(sc.open) || !valid.test(sc.close) || sc.open >= sc.close) throw new AppError("VALIDATION_ERROR", "Horário das provas inválido.", 400);
  if (!sc.days.length) throw new AppError("VALIDATION_ERROR", "Escolha pelo menos um dia de provas.", 400);
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const s of input.stores) {
      await tx.update(stores).set({ name: s.name, location: s.location, phone: s.phone, hours: s.hours }).where(eq(stores.id, s.id));
    }
  });
  await setSetting(
    "fittings.schedule",
    {
      ...sc,
      stepMinutes: Math.max(15, Math.round(sc.stepMinutes)),
      bridalMinutes: Math.max(15, Math.round(sc.bridalMinutes)),
      defaultMinutes: Math.max(15, Math.round(sc.defaultMinutes)),
      leadHours: Math.max(0, Math.round(sc.leadHours)),
      maxDaysAhead: Math.min(365, Math.max(1, Math.round(sc.maxDaysAhead))),
    },
    staff.id,
  );
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Definições do sistema alteradas", detail: "Lojas e provas" });
}
