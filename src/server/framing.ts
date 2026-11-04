import "server-only";
import { z } from "zod";
import { frameCss, type Frame } from "@/data/framing";
import { AppError } from "./errors";
import { getSetting, setSetting } from "./settings";

/**
 * EN: Framing of photos and videos (setting "framing", one entry per file). PT: Enquadramento (definição "framing").
 */
export const getFraming = () => getSetting<Record<string, Frame>>("framing", {});

/** EN: The stylesheet the store adds to every page. PT: A folha de estilos que a loja junta a cada página. */
export async function framingCss(): Promise<string> {
  return frameCss(await getFraming());
}

const frameSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(4),
  poster: z.string().trim().max(500).optional(),
  time: z.number().min(0).max(36000).optional(),
});

export async function saveFrame(url: string, input: unknown, staffId: string) {
  const parsed = frameSchema.safeParse(input);
  if (!url.startsWith("/") || url.length > 500 || !parsed.success) throw new AppError("VALIDATION_ERROR", "Enquadramento inválido.", 400);
  const map = await getFraming();
  const f = parsed.data;
  // EN: Back to the default (and no cover): the entry goes away. PT: De volta ao normal (sem capa): a entrada sai.
  if (f.x === 50 && f.y === 50 && f.zoom === 1 && !f.poster) delete map[url];
  else map[url] = f;
  await setSetting("framing", map, staffId);
}
