import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { addDays, fromMaputo, mondayOf, todayMaputo } from "@/lib/time";
import { getDb } from "../db";
import { productImages, products, productVariants, refunds, stores } from "../db/schema";
import { listFittingsBetween } from "../fittings";
import { storeScope, type StaffContext } from "../staff/access";
import { listOrdersFor, METHOD_LABEL } from "./orders";

/**
 * EN: "Gestão · 1 Painel": today's numbers, recent orders, what needs attention and today's fittings.
 * PT: Números de hoje, encomendas recentes, o que precisa de atenção e as provas de hoje.
 */
export async function dashboardFor(staff: StaffContext) {
  const db = await getDb();
  const today = todayMaputo();
  const start = fromMaputo(today);
  const all = await listOrdersFor(staff, { from: addDays(mondayOf(today), -7) });

  const todays = all.filter((r) => r.order.createdAt >= start);
  const paidToday = todays.filter((r) => r.order.paymentStatus === "paid");
  const pending = all.filter((r) => r.order.paymentStatus === "pending");
  const week = all.filter((r) => r.order.createdAt >= fromMaputo(mondayOf(today)) && r.order.paymentStatus === "paid");
  const byMethod = new Map<string, number>();
  for (const r of week) byMethod.set(r.order.paymentMethod, (byMethod.get(r.order.paymentMethod) ?? 0) + 1);
  const methods = [...byMethod.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => ({ label: METHOD_LABEL[m as keyof typeof METHOD_LABEL], pct: Math.round((n / week.length) * 100) }));

  // EN: Needs attention. PT: Precisa da sua atenção.
  const attention: { tone: "warn" | "bad"; title: string; body: string; href?: string }[] = [];
  const stale = pending.filter((r) => ["mpesa", "emola", "mkesh", "card"].includes(r.order.paymentMethod) && Date.now() - r.order.createdAt.getTime() > 10 * 60_000);
  if (stale.length) {
    attention.push({ tone: "warn", title: `${stale.length} ${stale.length === 1 ? "pagamento pendente" : "pagamentos pendentes"} há mais de 10 minutos`, body: "Verificar o estado na operadora antes de libertar as peças.", href: `/gestao/encomendas/${stale[0].order.id}` });
  }
  const proofs = pending.filter((r) => r.order.paymentMethod === "transfer" && r.order.transferProofUrl);
  if (proofs.length) {
    attention.push({ tone: "warn", title: `${proofs.length} ${proofs.length === 1 ? "comprovativo" : "comprovativos"} de transferência por validar`, body: "Confirme a entrada do valor na conta antes de validar.", href: `/gestao/encomendas/${proofs[0].order.id}` });
  }
  const scope = storeScope(staff, "products.view");
  const lastUnits = await db
    .select({ code: products.code, size: productVariants.size, stock: productVariants.stock, id: products.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(inArray(productVariants.stock, [0, 1]), eq(products.status, "published"), scope ? inArray(productVariants.storeId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : undefined));
  for (const v of lastUnits.slice(0, 3)) {
    attention.push({
      tone: v.stock === 0 ? "bad" : "warn",
      title: `${v.code} — ${v.stock === 0 ? "esgotado" : "última unidade"}`,
      body: `Tamanho ${v.size}. Reponha ou marque como esgotado.`,
      href: `/gestao/produtos/${v.id}`,
    });
  }
  const withImages = db.select({ id: productImages.productId }).from(productImages);
  const noPhoto = await db.select({ id: products.id }).from(products).where(notInArray(products.id, withImages));
  if (noPhoto.length) {
    attention.push({ tone: "warn", title: `${noPhoto.length} ${noPhoto.length === 1 ? "produto sem fotografia" : "produtos sem fotografia"}`, body: "Não aparecem na loja até terem pelo menos uma imagem.", href: "/gestao/produtos" });
  }
  const openRefunds = await db.select().from(refunds).where(eq(refunds.status, "requested"));
  if (openRefunds.length && staff.perms.refunds === "T") {
    attention.push({ tone: "warn", title: `${openRefunds.length} ${openRefunds.length === 1 ? "devolução" : "devoluções"} à espera de aprovação`, body: "Pedidas pela gestora da loja.", href: `/gestao/encomendas/${openRefunds[0].orderId}` });
  }

  const fittingsToday = await listFittingsBetween(today, addDays(today, 1), storeScope(staff, "fittings"));
  const storeRows = await db.select().from(stores);
  const storeCode = (id: string) => storeRows.find((s) => s.id === id)?.code ?? "";
  const active = fittingsToday.filter((f) => f.status !== "cancelled");
  const perStore = storeRows
    .map((s) => ({ code: s.code, n: active.filter((f) => f.storeId === s.id).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} na Loja ${x.code}`)
    .join(" · ");

  return {
    today,
    salesToday: paidToday.reduce((sum, r) => sum + r.order.total, 0),
    paidTodayCount: paidToday.length,
    pendingCount: pending.length,
    pendingHint: pending[0]
      ? pending[0].order.paymentMethod === "transfer"
        ? "Transferência · a validar"
        : pending[0].order.paymentMethod === "cod"
          ? "Pagamento na entrega"
          : `A aguardar PIN · ${METHOD_LABEL[pending[0].order.paymentMethod]}`
      : "Nenhum",
    fittingsTodayCount: active.length,
    fittingsPerStore: perStore || "Nenhuma marcada",
    methods,
    recent: all.slice(0, 6),
    attention,
    fittingsToday: active.map((f) => ({ ...f, storeCode: storeCode(f.storeId) })),
  };
}
