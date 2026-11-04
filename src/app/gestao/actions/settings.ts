"use server";

import { revalidatePath } from "next/cache";
import { savePaymentsPage, type PaymentsSave } from "@/server/admin/settings";
import { saveSystemSettings, type SystemSettings } from "@/server/admin/system";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/** EN: Settings actions. PT: Acções das definições. */
export interface SettingsResult {
  ok: boolean;
  message?: string;
}

async function run(fn: () => Promise<unknown>): Promise<SettingsResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: "Guardado." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export async function savePaymentsAction(input: PaymentsSave) {
  const staff = await requireStaffAction("payments.toggle");
  return run(() => savePaymentsPage(staff, input));
}

export async function saveSystemAction(input: SystemSettings) {
  const staff = await requireStaffAction("system");
  return run(() => saveSystemSettings(staff, input));
}
