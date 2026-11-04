"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { piecesByCodes, piecesFromExcel, piecesOfGroup, saveCampaign, setCampaignState, type CampaignPiece } from "@/server/admin/campaigns";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: Actions of "Gestão · Nova campanha" (design V3). Every change goes to the audit log.
 * PT: Acções de Nova campanha (V3). Cada alteração fica no registo de auditoria.
 */

export type CampaignActionResult = { ok: true; message: string; id?: string; url?: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): CampaignActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar campanhas." : e.message) : fallback,
});
const refresh = () => {
  revalidatePath("/gestao/coleccoes");
  revalidatePath("/gestao/campanhas", "layout");
  revalidatePath("/", "layout");
};

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const input = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  phrase: z.string().trim().max(160),
  kind: z.enum(["normal", "flash"]),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  discountMode: z.enum(["uniform", "per_piece"]),
  percent: z.number().int().min(1).max(90),
  topBar: z.boolean(),
  homePlacement: z.enum(["before", "after", "none"]),
  ownPage: z.boolean(),
  countdown: z.boolean(),
  colors: z.object({ band: color, desc: color, title: color, accent: color, text: color, button: color, buttonText: color }),
  imageUrl: z.string().max(500).nullable(),
  items: z.array(z.object({ productId: z.string().uuid(), percent: z.number().int().min(1).max(90).nullable() })).max(2000),
});

export async function saveCampaignAction(data: z.input<typeof input>): Promise<CampaignActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const v = input.safeParse(data);
    if (!v.success) {
      const f = String(v.error.issues[0]?.path[0]);
      const msg: Record<string, string> = { name: "Escreva o nome da campanha.", startsAt: "Escolha quando começa.", endsAt: "Escolha quando termina.", percent: "O desconto tem de estar entre 1% e 90%." };
      return { ok: false, message: msg[f] ?? "Verifique os dados da campanha." };
    }
    const id = await saveCampaign(staff, v.data);
    refresh();
    return { ok: true, id, message: "Campanha guardada." };
  } catch (e) {
    return fail(e, "Não foi possível guardar a campanha.");
  }
}

export async function setCampaignStateAction(id: string, action: "schedule" | "start" | "end" | "draft"): Promise<CampaignActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await setCampaignState(staff, z.string().uuid().parse(id), action);
    refresh();
    return { ok: true, message: { schedule: "Campanha agendada.", start: "A campanha começou.", end: "Campanha terminada: as peças voltaram ao preço normal.", draft: "Campanha passada a rascunho." }[action] };
  } catch (e) {
    return fail(e, "Não foi possível mudar o estado.");
  }
}

export async function piecesOfGroupAction(categoryId: string): Promise<CampaignPiece[]> {
  await requireStaffAction("products.publish");
  return piecesOfGroup(z.string().uuid().parse(categoryId));
}

export async function piecesByCodesAction(codes: string): Promise<{ pieces: CampaignPiece[]; missing: string[] }> {
  await requireStaffAction("products.publish");
  return piecesByCodes(codes.split(/[\s,;]+/).slice(0, 500));
}

export async function piecesFromExcelAction(form: FormData): Promise<{ pieces: CampaignPiece[]; missing: string[] } | { error: string }> {
  try {
    await requireStaffAction("products.publish");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Escolha o Excel." };
    return await piecesFromExcel(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "O ficheiro não é um Excel (.xlsx) válido." };
  }
}

export async function uploadCampaignImageAction(form: FormData): Promise<CampaignActionResult> {
  try {
    await requireStaffAction("products.publish");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Escolha uma imagem." };
    return { ok: true, message: "Imagem carregada.", url: await savePublicUpload(file, "content") };
  } catch (e) {
    return fail(e, "Não foi possível carregar a imagem.");
  }
}
