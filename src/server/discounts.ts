import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { LOYALTY_LEVELS, type LoyaltyLevel } from "@/data/help";
import { getDb } from "./db";
import { discountCodes, orders } from "./db/schema";
import { AppError } from "./errors";
import { getSetting } from "./settings";
import type { CustomerVoucherDTO } from "@/types";

export { combineDiscounts } from "@/lib/discounts";

/**
 * EN: Discounts of design V3 (Gestão · Descontos e vouchers). Four kinds, each switched on and off: loyalty level,
 *     campaigns, sale price on a piece, vouchers. With two discounts on the same piece the larger applies, unless the
 *     voucher says it joins the level's. How the level discount is shown: without the level's name (default, the
 *     customer's request) or with it (previous version).
 * PT: Descontos do V3. Quatro tipos, cada um liga e desliga: nível de fidelidade, campanhas, saldo numa peça, vouchers.
 *     Com dois descontos na mesma peça aplica-se o maior, a não ser que o voucher se junte ao do nível. Como o desconto
 *     do nível aparece: sem o nome do nível (por defeito, pedido da cliente) ou com o nome (versão anterior).
 */

export interface DiscountSettings {
  level: boolean;
  campaigns: boolean;
  sale: boolean;
  vouchers: boolean;
  display: "plain" | "named";
}

export const DISCOUNTS_DEFAULT: DiscountSettings = { level: true, campaigns: true, sale: true, vouchers: true, display: "plain" };

export async function discountSettings(): Promise<DiscountSettings> {
  return { ...DISCOUNTS_DEFAULT, ...(await getSetting<Partial<DiscountSettings>>("discounts", {})) };
}

export type VoucherRow = typeof discountCodes.$inferSelect;
export type VoucherState = "unused" | "used" | "expired" | "off";

/** EN: Uses = orders that took the code and were not failed or cancelled. PT: Utilizações = encomendas com o código, não falhadas nem canceladas. */
export async function voucherUses(codes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!codes.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ code: orders.discountCode, n: sql<number>`count(*)` })
    .from(orders)
    .where(and(inArray(orders.discountCode, codes), ne(orders.paymentStatus, "failed"), ne(orders.fulfillmentStatus, "cancelled")))
    .groupBy(orders.discountCode);
  for (const r of rows) if (r.code) out.set(r.code, Number(r.n));
  return out;
}

export function voucherState(v: VoucherRow, uses: number, now = new Date()): VoucherState {
  if (!v.active) return "off";
  if (v.endsAt && v.endsAt < now) return "expired";
  if (v.maxUses !== null && uses >= v.maxUses) return "used";
  return "unused";
}

export function voucherAmount(v: Pick<VoucherRow, "kind" | "value">, subtotal: number): number {
  return Math.min(subtotal, v.kind === "percent" ? Math.round((subtotal * v.value) / 100) : v.value);
}

export type VoucherError = "NOT_FOUND" | "OFF" | "EXPIRED" | "NOT_YET" | "USED" | "NOT_YOURS" | "MIN_PURCHASE" | "SIGN_IN";

/**
 * EN: Checks a code for this cart. `customer` is the signed-in customer (id and this year's level).
 * PT: Verifica um código para este carrinho. `customer` é a cliente com sessão (id e nível deste ano).
 */
export async function checkVoucher(
  code: string,
  subtotal: number,
  customer: { id: string; level: LoyaltyLevel } | null,
): Promise<{ ok: true; voucher: VoucherRow; amount: number } | { ok: false; error: VoucherError; min?: number }> {
  const settings = await discountSettings();
  if (!settings.vouchers) return { ok: false, error: "OFF" };
  const db = await getDb();
  const [v] = await db.select().from(discountCodes).where(eq(discountCodes.code, code.trim().toUpperCase()));
  if (!v) return { ok: false, error: "NOT_FOUND" };
  const now = new Date();
  const uses = (await voucherUses([v.code])).get(v.code) ?? 0;
  const state = voucherState(v, uses, now);
  if (state === "off") return { ok: false, error: "NOT_FOUND" };
  if (state === "expired") return { ok: false, error: "EXPIRED" };
  if (state === "used") return { ok: false, error: "USED" };
  if (v.startsAt && v.startsAt > now) return { ok: false, error: "NOT_YET" };
  if (v.target !== "all" && !customer) return { ok: false, error: "SIGN_IN" };
  if (v.target === "customer" && v.customerId !== customer?.id) return { ok: false, error: "NOT_YOURS" };
  if (v.target === "level" && v.levelKey !== customer?.level.key) return { ok: false, error: "NOT_YOURS" };
  if (v.minPurchase && subtotal < v.minPurchase) return { ok: false, error: "MIN_PURCHASE", min: v.minPurchase };
  return { ok: true, voucher: v, amount: voucherAmount(v, subtotal) };
}

/** EN: A level by its key. PT: Um nível pela chave. */
export const levelByKey = (key: string | null) => LOYALTY_LEVELS.find((l) => l.key === key) ?? null;

export function assertVoucherOk<T extends { ok: boolean }>(r: T): asserts r is Extract<T, { ok: true }> {
  if (!r.ok) throw new AppError("VALIDATION_ERROR", "Invalid discount code", 400, { field: "discountCode", reason: (r as unknown as { error: string }).error });
}

/**
 * EN: "Os meus vouchers" of the account (and the checkout's "Na sua conta"): vouchers for this customer, for her level
 *     or for everyone — the ones she can still use and the ones she already used.
 * PT: "Os meus vouchers" da conta (e o "Na sua conta" do checkout): vouchers desta cliente, do seu nível ou de todas —
 *     os que ainda pode usar e os que já usou.
 */
export async function customerVouchers(customerId: string, levelKey: string | null): Promise<CustomerVoucherDTO[]> {
  const settings = await discountSettings();
  const db = await getDb();
  const rows = await db.select().from(discountCodes).where(eq(discountCodes.active, true));
  const mine = rows.filter((v) => v.target === "all" || (v.target === "customer" && v.customerId === customerId) || (v.target === "level" && v.levelKey === levelKey));
  if (!mine.length) return [];
  const [uses, used] = await Promise.all([
    voucherUses(mine.map((v) => v.code)),
    db
      .select({ code: orders.discountCode, number: orders.number, at: orders.createdAt })
      .from(orders)
      .where(and(eq(orders.customerId, customerId), inArray(orders.discountCode, mine.map((v) => v.code)), ne(orders.paymentStatus, "failed"), ne(orders.fulfillmentStatus, "cancelled"))),
  ]);
  const now = new Date();
  const out: CustomerVoucherDTO[] = [];
  for (const v of mine) {
    const usedBy = used.find((u) => u.code === v.code);
    const state = voucherState(v, uses.get(v.code) ?? 0, now);
    if (usedBy) {
      out.push({ code: v.code, kind: v.kind, value: v.value, minPurchase: v.minPurchase, endsAt: v.endsAt?.toISOString() ?? null, state: "used", usedAt: usedBy.at.toISOString(), usedOrder: usedBy.number });
    } else if (state === "unused" && settings.vouchers && (!v.startsAt || v.startsAt <= now)) {
      out.push({ code: v.code, kind: v.kind, value: v.value, minPurchase: v.minPurchase, endsAt: v.endsAt?.toISOString() ?? null, state: "unused", usedAt: null, usedOrder: null });
    }
  }
  return out.sort((a, b) => (a.state === b.state ? 0 : a.state === "unused" ? -1 : 1));
}
