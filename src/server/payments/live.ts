import "server-only";
import { AppError } from "../errors";
import type { GatewayMethod, PaymentGateway } from "./gateway";
import { createMpesaGateway } from "./mpesa";

/**
 * EN: Real providers (docs/PLANO.md, phase 6):
 *     - mpesa: ✅ Vodacom M-Pesa C2B (./mpesa.ts).
 *     - card:  [bank / gateway to choose], 3-D Secure, hosted card fields (card data never touches our server).
 *     - emola: Movitel merchant contract or aggregator.
 *     - mkesh: Tmcel merchant contract.
 * PT: Fornecedores reais (fase 6): M-Pesa pronto; cartão, e-Mola e mKesh por escrever.
 */
export function createLiveGateway(method: GatewayMethod): PaymentGateway {
  if (method === "mpesa") return createMpesaGateway();

  const notReady = () => {
    throw new AppError("PAYMENT_ERROR", `${method} integration not implemented yet`, 501);
  };
  return { method, charge: async () => notReady(), checkStatus: async () => notReady() };
}
