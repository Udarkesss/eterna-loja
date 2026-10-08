import { z } from "zod";
import { FITTING_KINDS } from "@/types";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { listSlots } from "@/server/fittings";

const querySchema = z.object({
  store: z.string().min(1).max(10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(FITTING_KINDS),
});

/**
 * GET /api/v1/fittings/slots?store=22&date=2026-10-02&kind=bride_white
 * EN: Free start times (Maputo time). PT: Horas livres (hora de Maputo).
 */
export const GET = withErrorHandling(async (request: Request) => {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  return jsonData(await listSlots(parsed.data.store, parsed.data.date, parsed.data.kind));
});
