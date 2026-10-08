"use server";

import { revalidatePath } from "next/cache";
import { savePaymentsPage, type PaymentsSave } from "@/server/admin/settings";
import { saveSystemSettings, type SystemSave } from "@/server/admin/system";
import { eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { createSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db";
import { staffUsers } from "@/server/db/schema";
import { clearDemoData, loadDemoData } from "@/server/demo";
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

export async function demoDataAction(load: boolean): Promise<SettingsResult> {
  const staff = await requireStaffAction("system");
  const r = await run(async () => {
    await (load ? loadDemoData() : clearDemoData());
    // EN: A demo account was recreated: keep the person signed in. PT: A conta de exemplo foi recriada: manter a sessão.
    if (load && staff.username.startsWith("demo.")) {
      const db = await getDb();
      const [again] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.username, staff.username));
      if (again) await createSession("staff", again.id);
    }
    await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: load ? "Dados de exemplo carregados" : "Dados de exemplo apagados" });
  });
  return r.ok ? { ok: true, message: load ? "Dados de exemplo carregados." : "Dados de exemplo apagados. Os dados reais ficaram intactos." } : r;
}

export async function saveSystemAction(input: SystemSave) {
  const staff = await requireStaffAction("system");
  return run(() => saveSystemSettings(staff, input));
}
