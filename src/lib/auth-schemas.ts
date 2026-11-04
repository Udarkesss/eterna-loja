import { z } from "zod";
import { LOCALES } from "@/types";
import { normalizeMsisdn } from "./payments/msisdn";

/**
 * EN: Input schemas for accounts and fittings, shared by the browser and the API (the server always re-checks).
 * PT: Esquemas de entrada de contas e provas, partilhados pelo browser e pela API (o servidor valida sempre).
 */

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeMsisdn(v);
    if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "INVALID_PHONE" });
    return n ?? "";
  });

export const passwordSchema = z.string().min(10, "PASSWORD_TOO_SHORT").max(200);

export const registerEmailSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(150),
  password: passwordSchema,
  locale: z.enum(LOCALES).default("pt"),
});

export const whatsappCodeSchema = z.object({ phone: phoneSchema });

export const whatsappVerifySchema = z.object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/) });

export const whatsappCompleteSchema = whatsappVerifySchema.extend({
  name: z.string().trim().min(2).max(100),
  password: passwordSchema,
  locale: z.enum(LOCALES).default("pt"),
});

/** EN: E-mail or WhatsApp number. PT: E-mail ou número de WhatsApp. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(150),
  password: z.string().min(1).max(200),
});

export const forgotSchema = z.object({ identifier: z.string().trim().min(3).max(150) });

export const resetSchema = z.object({
  identifier: z.string().trim().min(3).max(150),
  code: z.string().trim().regex(/^\d{6}$/),
  password: passwordSchema,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

/**
 * EN: "Agendar prova de noiva" (design V3): dresses, package, extra dresses, day and time, details and payment. The
 *     price is always computed on the server from Gestão → Provas.
 * PT: "Agendar prova de noiva" (V3): vestidos, pacote, vestidos extra, dia e hora, dados e pagamento. O valor é sempre
 *     calculado no servidor a partir de Gestão → Provas.
 */
export const bridalBookingSchema = z.object({
  locale: z.enum(LOCALES).default("pt"),
  productSlugs: z.array(z.string().min(1).max(100)).min(1).max(12),
  packageKey: z.string().min(1).max(20),
  extras: z.number().int().min(0).max(10).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(100),
  email: z.union([z.string().trim().email().max(150), z.literal("")]).optional(),
  phone: phoneSchema,
  weddingDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  notes: z.string().trim().max(500).optional(),
  method: z.enum(["card", "mpesa", "emola", "mkesh", "test"]),
  msisdn: z.string().max(20).optional(),
  acceptTerms: z.boolean(),
});
export type BridalBookingInput = z.input<typeof bridalBookingSchema>;

/** EN: Identifier is an e-mail when it has "@". PT: O identificador é e-mail quando tem "@". */
export function parseIdentifier(identifier: string): { kind: "email"; value: string } | { kind: "phone"; value: string } | null {
  const v = identifier.trim();
  if (v.includes("@")) return z.string().email().safeParse(v.toLowerCase()).success ? { kind: "email", value: v.toLowerCase() } : null;
  const phone = normalizeMsisdn(v);
  return phone ? { kind: "phone", value: phone } : null;
}
