import "server-only";
import type { output, ZodTypeAny } from "zod";
import { AppError } from "./errors";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import type { Locale } from "@/types";

/** EN: Reads ?locale= from a request, falling back to Portuguese. PT: Lê ?locale= do pedido; por omissão, português. */
export function localeFromRequest(request: Request): Locale {
  const value = new URL(request.url).searchParams.get("locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * EN: Reads and validates a JSON body; invalid input becomes a VALIDATION_ERROR with the field details.
 * PT: Lê e valida um corpo JSON; dados inválidos dão VALIDATION_ERROR com o detalhe dos campos.
 */
export async function parseJson<S extends ZodTypeAny>(request: Request, schema: S): Promise<output<S>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  return parsed.data;
}
