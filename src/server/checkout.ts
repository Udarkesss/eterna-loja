import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import type { CreateOrderInput } from "@/lib/validation";
import type { OrderStatusDTO, PaymentMethod, PaymentStatus, ProductDTO } from "@/types";
import { currentCustomer } from "./accounts";
import { levelDiscount } from "@/lib/discounts";
import { assertVoucherOk, checkVoucher, combineDiscounts, discountSettings } from "./discounts";
import { customerLevel } from "./loyalty";
import { effectivePrice, listProducts } from "./catalog";
import { deliveryEnabled, enabledPaymentMethods, listDeliveryZones } from "./content";
import { getDb } from "./db";
import { reservations, stores } from "./db/schema";
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
import { isBridalStore, nextReservationNumber, reservationAmounts, reservationSettings } from "./reservations";
import { getSetting } from "./settings";
import { DEFAULT_PRICING, deliveryFee, type DeliveryPricing } from "@/lib/delivery";

/**
 * EN: Checkout rules, following the design's "Checkout · 6 métodos de pagamento" and
 *     "Integração M-Pesa e e-Mola". The website and the mobile app both go through here.
 * PT: Regras do checkout, segundo o design. O site e a app móvel passam ambos por aqui.
 */

const MOBILE_TIMEOUT_DEFAULT = 90; // EN: seconds, the design's countdown. PT: segundos, a contagem do design.
const TRANSFER_HOLD_HOURS = 24; // EN: design: "[24 horas]". PT: design: "[24 horas]".

/**
 * EN: Creates the order, reserves stock and starts the payment. Prices always come from the catalog.
 * PT: Cria a encomenda, reserva o stock e inicia o pagamento. Os preços vêm sempre do catálogo.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderStatusDTO> {
  const { payment, fulfillment, locale } = input;
  if (!(await enabledPaymentMethods()).includes(payment.method)) {
    throw new AppError("METHOD_UNAVAILABLE", `Payment method ${payment.method} is switched off`, 400);
  }
  if (input.reserve) return createReservationOrder(input);

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
  // EN: Level discount (design V3): pieces not on sale only; the larger of it and a discount code applies.
  // PT: Desconto do nível: só peças fora de saldo; aplica-se o maior entre ele e um código de desconto.
  const customer = await currentCustomer();
  const level = customer ? await customerLevel(customer.id) : null;
  const settings = await discountSettings();
  const levelAmount =
    level && settings.level ? levelDiscount(lines.map((l) => ({ price: catalog.get(l.slug)?.price ?? l.unitPrice, unit: l.unitPrice, quantity: l.quantity })), level.pct) : 0;

  // ── Fulfilment / Entrega ──
  let shippingFee = 0;
  let fulfillmentFields = {};
  if (fulfillment.type === "pickup") {
    const store = storeRows.find((s) => s.code === fulfillment.storeCode);
    if (!store) throw new AppError("VALIDATION_ERROR", "Unknown store", 400, { field: "storeCode" });
    // EN: Collection code (design V3 confirmation). PT: Código de levantamento (confirmação do V3).
    fulfillmentFields = { pickupStoreId: store.id, deliveryCode: newDeliveryCode() };
  } else {
    if (!(await deliveryEnabled())) throw new AppError("METHOD_UNAVAILABLE", "Home delivery is switched off", 400, { field: "fulfillment" });
    const zones = await listDeliveryZones(locale);
    const hood = fulfillment.neighbourhood.toLowerCase();
    const zone = zones.find((z) => z.neighbourhoods.some((n) => n.toLowerCase() === hood));
    const pricing = await getSetting<DeliveryPricing>("delivery.pricing", DEFAULT_PRICING);
    const point = fulfillment.lat != null && fulfillment.lng != null ? { lat: fulfillment.lat, lng: fulfillment.lng } : null;
    // EN: null = value not set yet ("[valor]"): charged as 0 until Eterna sets it. PT: null = por definir: 0 até a Eterna definir.
    shippingFee = deliveryFee(pricing, zone?.fee, point) ?? 0;
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

  // EN: Voucher checked again on the server (same rules as the summary). PT: Voucher verificado de novo no servidor.
  let voucher: { code: string; amount: number; stacks: boolean } | null = null;
  if (input.discountCode) {
    const r = await checkVoucher(input.discountCode, subtotal, customer && level ? { id: customer.id, level } : null);
    assertVoucherOk(r);
    voucher = { code: r.voucher.code, amount: r.amount, stacks: r.voucher.stacksWithLevel };
  }
  const combined = combineDiscounts(levelAmount, voucher);
  const discount = { code: combined.voucher > 0 ? voucher!.code : null, amount: Math.min(subtotal, combined.total) };
  const total = subtotal - discount.amount + shippingFee;

  // ── Payment / Pagamento ──
  const msisdn = "msisdn" in payment ? normalizeMsisdn(payment.msisdn) : null;
  const expiresAt = await paymentExpiry(payment.method);

  // EN: Signed-in customers see the order in "As minhas encomendas". PT: Com sessão, aparece na conta.
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

  await startPayment(order, payment.method, msisdn);
  return toOrderStatusDTO((await findOrder(order.id))!);
}

/**
 * EN: Starts the payment of a new order: card and mobile money go to their gateway; transfer and cash on delivery wait;
 *     the demo method is paid at once (switch it off in Gestão · Pagamentos before opening).
 * PT: Inicia o pagamento de uma encomenda nova: cartão e dinheiro móvel vão ao gateway; transferência e dinheiro na
 *     entrega esperam; o método de demonstração fica pago logo (desligue-o em Gestão · Pagamentos antes de abrir).
 */
async function startPayment(order: { id: string; number: string; total: number; idempotencyKey: string | null }, method: PaymentMethod, msisdn: string | null) {
  if (method === "test") {
    await updateOrder(order.id, { paymentReference: `TEST-${order.number}` }, { type: "payment_requested", detail: "teste" });
    await settlePayment({ id: order.id }, "paid", "TEST_PAYMENT");
  } else if (method !== "transfer" && method !== "cod") {
    try {
      const result = await getPaymentGateway(method as GatewayMethod).charge({
        orderNumber: order.number,
        amount: order.total,
        msisdn: msisdn ?? undefined,
        idempotencyKey: order.idempotencyKey!,
      });
      await updateOrder(order.id, { paymentReference: result.reference }, { type: "payment_requested", detail: method });
      if (result.status !== "pending") await settlePayment({ id: order.id }, result.status as "paid" | "failed", result.responseCode);
    } catch (error) {
      await settlePayment({ id: order.id }, "failed");
      if (error instanceof AppError) throw error;
      throw new AppError("PAYMENT_ERROR", "Could not start the payment", 502);
    }
  }
}

/** EN: How long a pending mobile payment / transfer keeps the piece. PT: Quanto tempo um pagamento pendente guarda a peça. */
async function paymentExpiry(method: PaymentMethod) {
  const isMobile = method === "mpesa" || method === "emola" || method === "mkesh";
  const timeout = await getSetting("payments.mobileTimeoutSeconds", MOBILE_TIMEOUT_DEFAULT);
  return isMobile ? new Date(Date.now() + timeout * 1000) : method === "transfer" ? new Date(Date.now() + TRANSFER_HOLD_HOURS * 3600 * 1000) : null;
}

/**
 * EN: "Reservar esta peça" (design V3): one piece, collected in its store; the order is the 50% deposit (kind
 *     "reservation") and the reservation becomes active when the deposit is paid (src/server/reservations.ts).
 * PT: "Reservar esta peça" (V3): uma peça, levantada na sua loja; a encomenda é o sinal de 50% (tipo "reservation") e a
 *     reserva fica activa quando o sinal estiver pago (src/server/reservations.ts).
 */
async function createReservationOrder(input: CreateOrderInput): Promise<OrderStatusDTO> {
  const { payment, locale } = input;
  const line = input.lines[0];
  const [product] = await listProducts({ slugs: [line.slug] }, locale);
  const variant = product?.variants.find((v) => v.id === line.variantId);
  if (!product || !variant) throw new AppError("NOT_FOUND", `Product not found: ${line.slug}`, 404, { slug: line.slug });
  const db = await getDb();
  const storeRows = await db.select().from(stores);
  const store = storeRows.find((s) => s.code === variant.store?.code) ?? storeRows.find((s) => input.fulfillment.type === "pickup" && s.code === input.fulfillment.storeCode);
  if (!store) throw new AppError("VALIDATION_ERROR", "Unknown store", 400, { field: "storeCode" });
  const customer = await currentCustomer();
  const [level, discounts, settings] = await Promise.all([customer ? customerLevel(customer.id) : null, discountSettings(), reservationSettings()]);
  const amounts = reservationAmounts(product, discounts.level ? level : null, settings);
  const msisdn = "msisdn" in payment ? normalizeMsisdn(payment.msisdn) : null;
  const image = product.images.find((i) => i.color === variant.color) ?? product.images[0];
  const color = product.colors.find((c) => c.key === variant.color)?.name ?? null;

  const order = await createOrderWithReservation(
    {
      customerId: customer?.id ?? null,
      locale,
      contact: { name: input.contact.name, email: input.contact.email || undefined, phone: msisdn ?? customer?.phone ?? undefined },
      subtotal: amounts.price,
      discount: amounts.discount,
      shippingFee: 0,
      total: amounts.deposit,
      paymentMethod: payment.method,
      msisdn,
      idempotencyKey: randomUUID(),
      paymentExpiresAt: await paymentExpiry(payment.method),
      fulfillmentType: "pickup",
      pickupStoreId: store.id,
      kind: "reservation",
    },
    [
      {
        productId: product.id,
        variantId: variant.id,
        storeId: store.id,
        slug: product.slug,
        code: product.code,
        name: product.name,
        color,
        size: variant.size,
        imageUrl: image?.url ?? null,
        unitPrice: amounts.price,
        quantity: 1,
      },
    ],
    ["created"],
  );
  await db.insert(reservations).values({
    number: await nextReservationNumber(),
    customerId: customer?.id ?? null,
    contact: { name: input.contact.name, email: input.contact.email || undefined, phone: msisdn ?? customer?.phone ?? undefined },
    origin: "online",
    orderId: order.id,
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    code: product.code,
    name: product.type?.name ?? product.name,
    color,
    size: variant.size,
    imageUrl: image?.url ?? null,
    storeId: store.id,
    price: amounts.price,
    discount: amounts.discount,
    total: amounts.total,
    deposit: amounts.deposit,
    days: isBridalStore(store.code) ? settings.bridalDays : settings.days,
  });
  await startPayment(order, payment.method, msisdn);
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
