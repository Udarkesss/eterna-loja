"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { importHistory, saveCollection, setCollectionPieces, setCollectionStatus, type ShopChange } from "@/server/admin/collections";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: Actions of "Gestão · Colecções" (design V3). Every change goes to the audit log.
 * PT: Acções de Colecções (V3). Cada alteração fica no registo de auditoria.
 */

export type CollectionActionResult = { ok: true; message: string; id?: string; url?: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): CollectionActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar colecções." : e.message) : fallback,
});
const refresh = () => {
  revalidatePath("/gestao/coleccoes");
  revalidatePath("/", "layout");
};

const input = z.object({
  id: z.string().uuid().optional(),
  collectionType: z.enum(["seasonal", "special"]),
  parentId: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(60),
  number: z.string().trim().max(8),
  year: z.number().int().min(0).max(2100),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  description: z.string().max(600),
  message: z.string().max(600),
  buttonText: z.string().max(60),
  buttonLink: z.string().max(300),
  imageUrl: z.string().max(500).nullable(),
  history: z.boolean(),
});

export async function saveCollectionAction(data: z.input<typeof input>): Promise<CollectionActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const v = input.safeParse(data);
    if (!v.success) return { ok: false, message: v.error.issues[0]?.path[0] === "name" ? "Escreva o nome da colecção." : "Verifique os dados da colecção." };
    const id = await saveCollection(staff, v.data);
    refresh();
    return { ok: true, id, message: "Colecção guardada." };
  } catch (e) {
    return fail(e, "Não foi possível guardar a colecção.");
  }
}

export async function setCollectionStatusAction(id: string, status: "active" | "archived" | "draft", shop?: ShopChange): Promise<CollectionActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const change = z.object({ send: z.enum(["all", "previous", "this", "keep"]), publishNew: z.boolean().optional() }).optional().parse(shop);
    const r = await setCollectionStatus(staff, z.string().uuid().parse(id), z.enum(["active", "archived", "draft"]).parse(status), change);
    refresh();
    revalidatePath("/gestao/produtos");
    const moved = [r.sent ? `${r.sent} ${r.sent === 1 ? "peça foi" : "peças foram"} para o armazém` : "", r.published ? `${r.published} ${r.published === 1 ? "peça entrou" : "peças entraram"} na loja` : ""].filter(Boolean).join(" · ");
    const base = status === "active" ? "Colecção activada." : status === "archived" ? "Colecção arquivada." : "Colecção passada a rascunho.";
    return { ok: true, message: moved ? `${base} ${moved}.` : base };
  } catch (e) {
    return fail(e, "Não foi possível mudar o estado.");
  }
}

export async function setCollectionPiecesAction(id: string, add: string[], remove: string[]): Promise<CollectionActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const ids = z.array(z.string().uuid()).max(2000);
    await setCollectionPieces(staff, z.string().uuid().parse(id), ids.parse(add), ids.parse(remove));
    refresh();
    return { ok: true, message: "Peças guardadas." };
  } catch (e) {
    return fail(e, "Não foi possível guardar as peças.");
  }
}

export async function uploadCoverAction(form: FormData): Promise<CollectionActionResult> {
  try {
    await requireStaffAction("products.publish");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Escolha uma imagem." };
    return { ok: true, message: "Imagem carregada.", url: await savePublicUpload(file, "content") };
  } catch (e) {
    return fail(e, "Não foi possível carregar a imagem.");
  }
}

export async function importHistoryAction(form: FormData): Promise<CollectionActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const excel = form.get("excel");
    const zip = form.get("zip");
    if (!(excel instanceof File) || !excel.size) return { ok: false, message: "Escolha o Excel." };
    const n = await importHistory(staff, Buffer.from(await excel.arrayBuffer()), zip instanceof File && zip.size ? Buffer.from(await zip.arrayBuffer()) : null);
    refresh();
    return { ok: true, message: `${n} ${n === 1 ? "colecção antiga importada" : "colecções antigas importadas"}.` };
  } catch (e) {
    return fail(e, "Não foi possível importar.");
  }
}
