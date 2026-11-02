"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/server/errors";
import { auditImport, importShopifyBatch, readOldSite, type ImportBatch, type ImportOutcome, type OldSiteRequest } from "@/server/import/shopify";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Shopify import actions. Only people who can edit products import; publishing still needs "products.publish".
 * PT: Acções da importação do Shopify. Só quem edita produtos importa; publicar continua a precisar de permissão.
 */

const message = (e: unknown, fallback: string) =>
  e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite importar produtos." : e.message) : fallback;

export async function importShopifyBatchAction(batch: ImportBatch): Promise<{ ok: boolean; message?: string; results?: ImportOutcome[] }> {
  try {
    const staff = await requireStaffAction("products.edit");
    return { ok: true, results: await importShopifyBatch(staff, batch) };
  } catch (e) {
    return { ok: false, message: message(e, "Os dados deste lote não são válidos.") };
  }
}

/** EN: One page of the old site's public data. PT: Uma página dos dados públicos do site antigo. */
export async function readOldSiteAction(request: OldSiteRequest): Promise<{ ok: true; data: Awaited<ReturnType<typeof readOldSite>> } | { ok: false; message: string }> {
  try {
    await requireStaffAction("products.edit");
    return { ok: true, data: await readOldSite(request) };
  } catch (e) {
    return { ok: false, message: message(e, "Não foi possível ler o site antigo.") };
  }
}

export async function finishImportAction(summary: string): Promise<void> {
  const staff = await requireStaffAction("products.edit");
  await auditImport(staff, summary);
  revalidatePath("/gestao/produtos");
  revalidatePath("/", "layout");
}
