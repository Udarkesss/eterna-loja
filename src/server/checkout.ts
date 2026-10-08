import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import type { CreateOrderInput } from "@/lib/validation";
import type { OrderStatusDTO, PaymentStatus, ProductDTO } from "@/types";
import { currentCustomer } from "./accounts";
import { effectivePrice, listProducts } from "./catalog";
import { enabledPaymentMethods, listDeliveryZones } from "./content";
import { getDb } from "./db";
import { discountCodes, stores } from "./db/schema";
import { AppError } from "./errors";
import {
  createOrderWithReservation,
  findOrder,
  newDeliveryCode,
  settlePayment,
  toOrderStatusDTO,
  updateOrder,
  type NewOrderLine,
} from "./orders";
import { getPaymentGateway, type GatewayMethod } from "./payments";
import { getSetting } from "./settings";

/**
 * EN: Checkout rules, following the design's "Checkout · 6 métodos de pagamento" and
 *     "Integração M-Pesa e e-Mola". The website and the mobile app both go through here.
 * PT: Regras do checkout, segundo o design. O site e a app móvel passam ambos por aqui.
 */

const MOBILE_TIMEOUT_DEFAULT = 90; // EN: seconds, the design's countdown. PT: segundos, a contagem do design.
const TRANSFER_HOLD_HOURS = 24; // EN: design: "[24 horas]". PT: design: "[24 horas]".

async function applyDiscount(code: string | undefined, subtotal: number): Promise<{ code: string | null; amount: number }> {
  if (!code) return { code: null, amount: 0 };
  const db = await getDb();
  const now = new Date();
  const [row] = await db.select().from(discountCodes).where(and(eq(discountCodes.code, code.toUpperCase()), eq(discountCodes.active, true)));
  const valid =
    row &&
    (!row.startsAt || row.startsAt <= now) &&
    (!row.endsAt || row.endsAt >= now) &&
    (row.maxUses === null || row.uses < row.maxUses);
  if (!valid) throw new AppError("VALIDATION_ERROR", "Invalid discount code", 400, { field: "discountCode" });
  const amount = row.kind === "percent" ? Math.round((subtotal * row.value) / 100) : row.value;
  await db.update(discountCodes).set({ uses: sql`${discountCodes.uses} + 1` }).where(eq(discountCodes.id, row.id));
  return { code: row.code, amount: Math.min(amount, subtotal) };
}

/**
 * EN: Creates the order, reserves stock and starts the payment. Prices always come from the catalog.
 * PT: Cria a encomenda, reserva o stock e inicia o pagamento. Os preços vêm sempre do catálogo.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderStatusDTO> {
  const { payment, fulfillment, locale } = input;
  if (!(await enabledPaymentMethods()).includes(payment.method)) {
    throw new AppError("METHOD_UNAVAILABLE", `Payment method ${payment.method} is switched off`, 400);
  }

  // ── Lines: prices and stock from the catalog / Linhas: preços e stock do catálogo ──
  const catalog = new Map<string, ProductDTO>(
    (await listProducts({ slugs: [...new Set(input.lines.map((l) => l.slug))] }, locale)).map((p) => [p.slug, p]),
  );
  const db = await getDb();
  const storeRows = await db.select().from(stores);
  const lines: NewOrderLine[] = input.lines.map((line) => {
    const product = catalog.get(line.slug);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) throw new AppError("NOT_FOUND", `Product not found: ${line.slug}`, 404, { slug: line.slug });
    const image = product.images.find((i) => i.color === variant.color) ?? product.images[0];
    return {
      productId: product.id,
      variantId: variant.id,
      storeId: storeRows.find((s) => s.code === variant.store?.code)?.id ?? null,
      slug: product.slug,
      code: product.code,
      name: product.name,
      color: product.colors.find((c) => c.key === variant.color)?.name ?? null,
      size: variant.size,
      imageUrl: image?.url ?? null,
      unitPrice: effectivePrice(product),
      quantity: line.quantity,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // ── Fulfilment / Entrega ──
  let shippingFee = 0;
  let fulfillmentFields = {};
  if (fulfillment.type === "pickup") {
    const store = storeRows.find((s) => s.code === fulfillment.storeCode);
    if (!store) throw new AppError("VALIDATION_ERROR", "Unknown store", 400, { field: "storeCode" });
    fulfillmentFields = { pickupStoreId: store.id };
  } else {
    const zones = await listDeliveryZones(locale);
    const hood = fulfillment.neighbourhood.toLowerCase();
    const zone = zones.find((z) => z.neighbourhoods.some((n) => n.toLowerCase() === hood));
    shippingFee = zone?.fee ?? 0; // EN: fees still "[valor]" in the design. PT: taxas ainda por definir.
    fulfillmentFields = {
      deliveryZoneId: zone?.id ?? null,
      deliveryCity: fulfillment.city,
      deliveryNeighbourhood: fulfillment.neighbourhood,
      deliveryAddress: fulfillment.address,
      deliveryLat: fulfillment.lat ?? null,
      deliveryLng: fulfillment.lng ?? null,
      deliveryCode: newDeliveryCode(),
    };
  }

  const discount = await applyDiscount(input.discountCode, subtotal);
  const total = subtotal - discount.amount + shippingFee;

  // ── Payment / Pagamento ──
  const msisdn = "msisdn" in payment ? normalizeMsisdn(payment.msisdn) : null;
  const isMobile = payment.method === "mpesa" || payment.method === "emola" || payment.method === "mkesh";
  const timeout = await getSetting("payments.mobileTimeoutSeconds", MOBILE_TIMEOUT_DEFAULT);
  const expiresAt = isMobile
    ? new Date(Date.now() + timeout * 1000)
    : payment.method === "transfer"
      ? new Date(Date.now() + TRANSFER_HOLD_HOURS * 3600 * 1000)
      : null;

  // EN: Signed-in customers see the order in "As minhas encomendas". PT: Com sessão, aparece na conta.
  const customer = await currentCustomer();
  const order = await createOrderWithReservation(
    {
      customerId: customer?.id ?? null,
      locale,
      contact: { name: input.contact.name, email: input.contact.email || undefined, phone: msisdn ?? undefined },
      subtotal,
      discountCode: discount.code,
      discount: discount.amount,
      shippingFee,
      total,
      paymentMethod: payment.method,
      msisdn,
      cashChangeFor: payment.method === "cod" ? (payment.changeFor ?? null) : null,
      idempotencyKey: randomUUID(),
      paymentExpiresAt: expiresAt,
      fulfillmentType: fulfillment.type,
      ...fulfillmentFields,
    },
    lines,
    ["created"],
  );

  // EN: Card and mobile money go to their gateway. PT: Cartão e dinheiro móvel vão ao seu gateway.
  if (payment.method !== "transfer" && payment.method !== "cod") {
    try {
      const result = await getPaymentGateway(payment.method as GatewayMethod).charge({
        orderNumber: order.number,
        amount: total,
        msisdn: msisdn ?? undefined,
        idempotencyKey: order.idempotencyKey!,
      });
      await updateOrder(order.id, { paymentReference: result.reference }, { type: "payment_requested", detail: payment.method });
      if (result.status !== "pending") await settlePayment({ id: order.id }, result.status as "paid" | "failed", result.responseCode);
    } catch (error) {
      await settlePayment({ id: order.id }, "failed");
      if (error instanceof AppError) throw error;
      throw new AppError("PAYMENT_ERROR", "Could not start the payment", 502);
    }
  }

  return toOrderStatusDTO((await findOrder(order.id))!);
}

/**
 * EN: Current status. While pending, asks the provider (safety net if a webhook is lost), and after the
 *     time limit asks once more before marking it EXPIRED (design: "Integração", Estados e conciliação).
 * PT: Estado actual. Enquanto pendente, pergunta ao fornecedor; depois do prazo, pergunta mais uma vez antes
 *     de marcar EXPIRADA.
 */
export async function getOrderStatus(id: string): Promise<OrderStatusDTO | null> {
  let order = await findOrder(id);
  if (!order) return null;

  if (order.paymentStatus === "pending" && order.paymentReference) {
    const gateway = getPaymentGateway(order.paymentMethod as GatewayMethod);
    const latest = await gateway.checkStatus(order.paymentReference);
    const expired = order.paymentExpiresAt && order.paymentExpiresAt.getTime() < Date.now();
    const next: PaymentStatus | null = latest.status !== "pending" ? latest.status : expired ? "expired" : null;
    if (next) order = (await settlePayment({ id }, next as "paid" | "failed" | "expired", latest.responseCode)) ?? order;
  }
  return toOrderStatusDTO(order);
}

/** EN: "Cancelar e mudar de método": releases the pending payment. PT: Liberta o pagamento pendente. */
export async function cancelPendingPayment(id: string): Promise<OrderStatusDTO | null> {
  const order = await findOrder(id);
  if (!order) return null;
  const settled = await settlePayment({ id }, "failed", "CANCELLED_BY_CUSTOMER");
  return toOrderStatusDTO(settled ?? order);
}

/** EN: Transfer proof uploaded (design: "Comprovativo recebido · a validar"). PT: Comprovativo carregado. */
export async function attachTransferProof(id: string, fileUrl: string): Promise<OrderStatusDTO | null> {
  const order = await findOrder(id);
  if (!order) return null;
  if (order.paymentMethod !== "transfer") throw new AppError("VALIDATION_ERROR", "Not a transfer order", 400);
  await updateOrder(id, { transferProofUrl: fileUrl }, { type: "transfer_proof" });
  return toOrderStatusDTO((await findOrder(id))!);
}

/** EN: Webhook from a provider. PT: Webhook de um fornecedor. */
export async function applyPaymentResult(reference: string, status: "paid" | "failed", responseCode?: string) {
  return (await settlePayment({ reference }, status, responseCode)) !== null;
}
