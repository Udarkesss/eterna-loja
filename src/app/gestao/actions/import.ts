"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/server/errors";
import { auditImport, importShopifyBatch, type ImportBatch, type ImportOutcome } from "@/server/import/shopify";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Shopify import actions. Only people who can edit products import; publishing still needs "products.publish".
 * PT: Acções da importação do Shopify. Só quem edita produtos importa; publicar continua a precisar de permissão.
 */

export async function importShopifyBatchAction(batch: ImportBatch): Promise<{ ok: boolean; message?: string; results?: ImportOutcome[] }> {
  try {
    const staff = await requireStaffAction("products.edit");
    return { ok: true, results: await importShopifyBatch(staff, batch) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite importar produtos." : e.message };
    return { ok: false, message: "Os dados deste lote não são válidos." };
  }
}

export async function finishImportAction(summary: string): Promise<void> {
  const staff = await requireStaffAction("products.edit");
  await auditImport(staff, summary);
  revalidatePath("/gestao/produtos");
  revalidatePath("/", "layout");
}
