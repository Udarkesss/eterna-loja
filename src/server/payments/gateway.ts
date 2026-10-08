import "server-only";
import type { PaymentMethod, PaymentStatus } from "@/types";

/**
 * EN: What every payment provider must implement (card gateway, M-Pesa, e-Mola, mKesh).
 *     Transfer and cash on delivery have no gateway: the team confirms them in the back-office.
 * PT: O que cada fornecedor de pagamento implementa (cartão, M-Pesa, e-Mola, mKesh).
 *     Transferência e pagamento na entrega não têm gateway: a equipa confirma-os na gestão.
 */

export type GatewayMethod = Exclude<PaymentMethod, "transfer" | "cod">;

export interface ChargeRequest {
  orderNumber: string;
  amount: number; // MT — EN: always computed on the server. PT: sempre calculado no servidor.
  msisdn?: string; // EN: mobile money only. PT: só dinheiro móvel.
  idempotencyKey: string; // EN: one per order, avoids double charges. PT: uma por encomenda, evita cobranças duplas.
  returnUrl?: string; // EN: card 3-D Secure return. PT: regresso do 3-D Secure.
}

export interface ChargeResult {
  reference: string;
  status: PaymentStatus;
  responseCode?: string; // e.g. "INS-0"
  redirectUrl?: string; // EN: card: bank page for 3-D Secure. PT: cartão: página do banco para 3-D Secure.
}

export interface StatusResult {
  status: PaymentStatus;
  responseCode?: string;
}

export interface PaymentGateway {
  readonly method: GatewayMethod;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  /** EN: "Query Transaction Status". PT: Consulta do estado da transacção. */
  checkStatus(reference: string): Promise<StatusResult>;
}
