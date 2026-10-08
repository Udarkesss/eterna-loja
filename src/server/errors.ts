import "server-only";
import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode, ApiSuccess } from "@/types";

/**
 * EN: One error type for the whole server. Services throw AppError; route handlers turn it into JSON.
 *     The `code` is stable: the website and the mobile app translate it for the customer.
 * PT: Um único tipo de erro para todo o servidor. Os serviços lançam AppError; as rotas convertem em JSON.
 *     O `code` é estável: o site e a app móvel traduzem-no para a cliente.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function jsonError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json<ApiError>({ error: { code, message, details } }, { status });
}

/**
 * EN: Wraps a route handler so every thrown error becomes a clean JSON response.
 * PT: Envolve uma rota para que qualquer erro lançado se torne numa resposta JSON limpa.
 */
export function withErrorHandling<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) return jsonError(error.code, error.message, error.status, error.details);
      console.error("[api] Unexpected error / Erro inesperado:", error);
      return jsonError("INTERNAL_ERROR", "Unexpected error", 500);
    }
  };
}
