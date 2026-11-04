"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findPiecesByCode, saveCategorySettings } from "@/server/admin/categories";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Gestão · Categorias e filtros" (design V3). PT: Acções de Categorias e filtros (V3).
 */

const listing = z.object({
  sort: z.enum(["featured", "newest", "bestsellers", "price_asc", "price_desc", "name", "size", "type"]),
  featured: z.array(z.string().uuid()).max(48),
  filters: z.object({ size: z.boolean(), color: z.boolean(), price: z.boolean(), types: z.boolean(), reserved: z.boolean() }),
});

export async function saveCategorySettingsAction(slug: string, data: z.input<typeof listing>): Promise<{ ok: boolean; message: string }> {
  try {
    const staff = await requireStaffAction("products.publish");
    await saveCategorySettings(staff, z.string().min(1).max(80).parse(slug), listing.parse(data));
    revalidatePath("/gestao/categorias");
    revalidatePath("/", "layout");
    return { ok: true, message: "Guardado." };
  } catch (e) {
    return { ok: false, message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar categorias." : e.message) : "Não foi possível guardar." };
  }
}

export async function findPiecesAction(query: string) {
  await requireStaffAction("products.publish");
  return findPiecesByCode(z.string().max(40).parse(query));
}
