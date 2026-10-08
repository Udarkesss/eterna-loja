import { z } from "zod";
import { LOCALES } from "@/types";
import { MAX_QUANTITY } from "./cart";
import { validateMsisdn } from "./payments/msisdn";

/**
 * EN: Input schemas shared by the browser (instant feedback) and the API (the real check).
 *     The server ALWAYS validates again: never trust the client.
 * PT: Esquemas de entrada partilhados pelo browser (resposta imediata) e pela API (a verificação real).
 *     O servidor valida SEMPRE de novo: nunca confiar no cliente.
 */

export const MSISDN_METHOD_MISMATCH = "MSISDN_METHOD_MISMATCH";
export const COD_NEEDS_DELIVERY = "COD_NEEDS_DELIVERY";

export const cartLineSchema = z.object({
  slug: z.string().min(1).max(100),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});

/** EN: "1. Contacto" in the design: name and optional e-mail. PT: Nome e e-mail opcional. */
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.union([z.string().trim().email().max(150), z.literal("")]).optional(),
});

/** EN: "2. Entrega": pick up at Glória Mall or home delivery. PT: Levantar no Glória Mall ou entrega ao domicílio. */
export const fulfillmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pickup"), storeCode: z.string().min(1).max(10) }),
  z.object({
    type: z.literal("delivery"),
    city: z.string().trim().min(2).max(80),
    neighbourhood: z.string().trim().min(2).max(80),
    address: z.string().trim().min(5).max(200),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
]);

const mobile = (method: "mpesa" | "emola" | "mkesh") =>
  z.object({ method: z.literal(method), msisdn: z.string().trim().min(9).max(20) });

/**
 * EN: "3. Pagamento". Card details are NEVER sent here: the card gateway collects them (3-D Secure).
 * PT: "3. Pagamento". Os dados do cartão NUNCA vêm aqui: o gateway do cartão recolhe-os (3-D Secure).
 */
export const paymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("card") }),
  mobile("mpesa"),
  mobile("emola"),
  mobile("mkesh"),
  z.object({ method: z.literal("transfer") }),
  z.object({ method: z.literal("cod"), changeFor: z.string().trim().max(30).optional() }),
]);

export const createOrderSchema = z
  .object({
    locale: z.enum(LOCALES),
    lines: z.array(cartLineSchema).min(1).max(50),
    contact: contactSchema,
    fulfillment: fulfillmentSchema,
    payment: paymentSchema,
    discountCode: z.string().trim().max(40).optional(),
  })
  .superRefine((data, ctx) => {
    const p = data.payment;
    if ((p.method === "mpesa" || p.method === "emola" || p.method === "mkesh") && !validateMsisdn(p.msisdn, p.method)) {
      ctx.addIssue({ code: "custom", path: ["payment", "msisdn"], message: MSISDN_METHOD_MISMATCH });
    }
    if (p.method === "cod" && data.fulfillment.type !== "delivery") {
      ctx.addIssue({ code: "custom", path: ["payment", "method"], message: COD_NEEDS_DELIVERY });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(150),
  locale: z.enum(LOCALES),
});
