import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "../db";
import { customers } from "../db/schema";
import type { StaffContext } from "../staff/access";
import { customerKeyOf, listOrdersFor, type LineRow, type OrderRow } from "./orders";

/**
 * EN: "Gestão · 2 Encomendas por cliente": one line per person (account or guest checkout, joined by phone/e-mail),
 *     with order count and total spent (paid orders only).
 * PT: Uma linha por pessoa (com conta ou sem conta, juntada pelo telefone/e-mail), com nº de encomendas e total gasto.
 */
export interface CustomerSummary {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  since: Date;
  hasAccount: boolean;
  isDemo: boolean;
  orders: { order: OrderRow; lines: LineRow[] }[];
  totalPaid: number;
}

export async function listCustomersFor(staff: StaffContext, filter: { q?: string; from?: string; to?: string } = {}) {
  const rows = await listOrdersFor(staff, { from: filter.from, to: filter.to });
  const map = new Map<string, CustomerSummary>();
  for (const r of rows) {
    const key = customerKeyOf(r.order);
    const c = map.get(key) ?? {
      key,
      name: r.order.contact.name,
      phone: r.order.contact.phone ?? r.order.msisdn ?? null,
      email: r.order.contact.email ?? null,
      since: r.order.createdAt,
      hasAccount: !!r.order.customerId,
      isDemo: r.order.isDemo,
      orders: [],
      totalPaid: 0,
    };
    c.orders.push(r);
    if (r.order.createdAt < c.since) c.since = r.order.createdAt;
    if (r.order.paymentStatus === "paid") c.totalPaid += r.order.total;
    c.phone ??= r.order.contact.phone ?? r.order.msisdn ?? null;
    c.email ??= r.order.contact.email ?? null;
    map.set(key, c);
  }

  // EN: Account customers: use the account's name and creation date. PT: Com conta: nome e data da conta.
  const ids = [...map.keys()].filter((k) => k.startsWith("c:")).map((k) => k.slice(2));
  if (ids.length) {
    const db = await getDb();
    for (const acc of await db.select().from(customers).where(inArray(customers.id, ids))) {
      const c = map.get(`c:${acc.id}`)!;
      c.name = acc.name;
      c.since = acc.createdAt;
      c.phone = acc.phone ?? c.phone;
      c.email = acc.email ?? c.email;
    }
  }

  const q = (filter.q ?? "").toLowerCase().replace(/\s/g, "");
  return [...map.values()]
    .filter((c) => !q || [c.name, c.phone ?? "", c.email ?? "", ...c.orders.map((o) => o.order.number)].join("").toLowerCase().replace(/\s/g, "").includes(q))
    .sort((a, b) => b.orders[0].order.createdAt.getTime() - a.orders[0].order.createdAt.getTime());
}
