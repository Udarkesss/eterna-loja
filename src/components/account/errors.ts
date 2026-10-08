import type { Dictionary } from "@/i18n";
import { ApiClientError } from "@/lib/api-client";

/**
 * EN: Turns an API error into a sentence for the customer: specific account messages first
 *     (INVALID_CODE, PASSWORD_TOO_SHORT…), then the generic error code.
 * PT: Converte um erro da API numa frase para a cliente: primeiro as mensagens de conta, depois o código geral.
 */
export function accountError(error: unknown, dict: Dictionary): string {
  const messages = dict.account.errors as Record<string, string>;
  if (error instanceof ApiClientError) {
    if (messages[error.message]) return messages[error.message];
    const fields = (error.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
    const known = Object.values(fields ?? {})
      .flat()
      .find((m) => messages[m]);
    if (known) return messages[known];
    return dict.errors[error.code] ?? dict.errors.INTERNAL_ERROR;
  }
  return dict.errors.INTERNAL_ERROR;
}
