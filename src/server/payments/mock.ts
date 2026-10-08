import "server-only";
import { randomUUID } from "node:crypto";
import type { GatewayMethod, PaymentGateway, StatusResult } from "./gateway";

/**
 * EN: Fake providers for development (PAYMENTS_MODE=mock). No money moves.
 *     - Mobile money: confirmed ~8 s after the request; numbers ending in 0000 are declined (INS-2006),
 *       numbers ending in 9999 never answer, so the request expires.
 *     - Card: approved after ~3 s.
 * PT: Fornecedores simulados para desenvolvimento. Nenhum dinheiro é movido.
 *     - Dinheiro móvel: confirmado ~8 s depois; números terminados em 0000 são recusados (INS-2006),
 *       terminados em 9999 nunca respondem, e o pedido expira.
 *     - Cartão: aprovado depois de ~3 s.
 */

type Outcome = "paid" | "failed" | "silent";
interface MockCharge {
  createdAt: number;
  delayMs: number;
  outcome: Outcome;
}

const charges = ((globalThis as { __eternaMockCharges?: Map<string, MockCharge> }).__eternaMockCharges ??=
  new Map<string, MockCharge>());

export function createMockGateway(method: GatewayMethod): PaymentGateway {
  return {
    method,
    async charge({ msisdn }) {
      const reference = `MOCK-${method.toUpperCase()}-${randomUUID().slice(0, 8)}`;
      const outcome: Outcome = msisdn?.endsWith("0000") ? "failed" : msisdn?.endsWith("9999") ? "silent" : "paid";
      charges.set(reference, { createdAt: Date.now(), delayMs: method === "card" ? 3_000 : 8_000, outcome });
      return { reference, status: "pending" };
    },
    async checkStatus(reference): Promise<StatusResult> {
      const charge = charges.get(reference);
      if (!charge) return { status: "failed", responseCode: "INS-2051" };
      if (Date.now() - charge.createdAt < charge.delayMs || charge.outcome === "silent") return { status: "pending" };
      return charge.outcome === "paid" ? { status: "paid", responseCode: "INS-0" } : { status: "failed", responseCode: "INS-2006" };
    },
  };
}
