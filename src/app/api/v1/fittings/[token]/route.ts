import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { findFittingByToken, toFittingPublicDTO } from "@/server/fittings";
import { localeFromRequest } from "@/server/request";

/**
 * GET /api/v1/fittings/:token?locale=pt
 * EN: Public request page data: pieces, day, store and status — no phone or other personal data.
 * PT: Dados da página pública do pedido: peças, dia, loja e estado — sem telefone nem outros dados pessoais.
 */
export const GET = withErrorHandling(async (request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const row = await findFittingByToken(token);
  if (!row) throw new AppError("NOT_FOUND", "Fitting not found", 404);
  return jsonData(await toFittingPublicDTO(row, localeFromRequest(request)));
});
