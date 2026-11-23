"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bulkProducts, deleteProduct, saveProduct, type ProductInput } from "@/server/admin/products";
import { saveFixedCategories } from "@/server/admin/warehouse";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: Product actions (list bulk actions, editor save, photo upload). Access checked on the server.
 * PT: Acções de produtos (acções em massa, guardar, carregar fotos). Acesso verificado no servidor.
 */

export interface ProductActionResult {
  ok: boolean;
  message?: string;
  id?: string;
  url?: string;
}

const fail = (e: unknown): ProductActionResult => {
  if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
  throw e;
};

export async function saveProductAction(input: ProductInput): Promise<ProductActionResult> {
  try {
    const staff = await requireStaffAction("products.edit");
    const id = await saveProduct(staff, input);
    revalidatePath("/gestao/produtos");
    revalidatePath("/", "layout");
    return { ok: true, id, message: input.status === "published" ? "Publicado na loja." : "Guardado." };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadProductImageAction(form: FormData): Promise<ProductActionResult> {
  try {
    await requireStaffAction("products.edit");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Escolha um ficheiro." };
    return { ok: true, url: await savePublicUpload(file, "products") };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkProductsAction(ids: string[], action: Parameters<typeof bulkProducts>[2]): Promise<ProductActionResult> {
  try {
    const staff = await requireStaffAction(action.kind === "join" ? "products.edit" : "products.publish");
    await bulkProducts(staff, ids, action);
    revalidatePath("/gestao/produtos");
    revalidatePath("/", "layout");
    const n = `${ids.length} ${ids.length === 1 ? "peça" : "peças"}`;
    const one = ids.length === 1;
    const done = {
      publish: `${n} na loja (${one ? "se tiver preço" : "as que têm preço"}).`,
      draft: `${n} no armazém.`,
      fix: `${n} ${one ? "fixa" : "fixas"} na loja.`,
      unfix: `${n} ${one ? "deixou de ser fixa" : "deixaram de ser fixas"}.`,
      join: "Alterações aplicadas.",
    }[action.kind];
    return { ok: true, message: done };
  } catch (e) {
    return fail(e);
  }
}

/** EN: Categories whose pieces always stay in the shop. PT: Categorias cujas peças ficam sempre na loja. */
export async function saveFixedCategoriesAction(slugs: string[]): Promise<ProductActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await saveFixedCategories(staff, z.array(z.string().max(80)).max(200).parse(slugs));
    revalidatePath("/gestao/produtos");
    return { ok: true, message: "Peças fixas guardadas." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveProductAction(id: string): Promise<ProductActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await deleteProduct(staff, id);
    revalidatePath("/gestao/produtos");
    return { ok: true, message: "Produto arquivado: deixa de aparecer na loja." };
  } catch (e) {
    return fail(e);
  }
}
