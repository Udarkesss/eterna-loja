import "server-only";
import type { GatewayMethod, PaymentGateway } from "./gateway";
import { createLiveGateway } from "./live";
import { createMockGateway } from "./mock";

export type { GatewayMethod, PaymentGateway } from "./gateway";

/**
 * EN: Which methods use the real provider:
 *     PAYMENTS_MODE=live → all of them · PAYMENTS_LIVE_METHODS=mpesa,emola → only those · otherwise the simulator.
 * PT: Que métodos usam o fornecedor real:
 *     PAYMENTS_MODE=live → todos · PAYMENTS_LIVE_METHODS=mpesa,emola → só esses · caso contrário o simulador.
 */
function isLive(method: GatewayMethod): boolean {
  if (process.env.PAYMENTS_MODE === "live") return true;
  const list = (process.env.PAYMENTS_LIVE_METHODS ?? "").split(",").map((m) => m.trim());
  return list.includes(method);
}

export function getPaymentGateway(method: GatewayMethod): PaymentGateway {
  return isLive(method) ? createLiveGateway(method) : createMockGateway(method);
}
