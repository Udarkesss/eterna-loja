import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { DeliveriesBoard } from "@/components/admin/DeliveriesBoard";
import { DeliverySettings, EarningsTable } from "@/components/admin/DeliverySettings";
import { DemoTag, PageTop, mzn, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { DEFAULT_PRICING, type DeliveryPricing } from "@/lib/delivery";
import { formatLongDate, todayMaputo } from "@/lib/time";
import { getDb } from "@/server/db";
import { deliveryZones, roles, staffUsers } from "@/server/db/schema";
import { deliveryOrdersToday, driverMessage, earningsReport, livePositions, paymentLine, periodRange, type Period } from "@/server/delivery";
import { orderLinesOf } from "@/server/orders";
import { orderStoreId } from "@/server/admin/orders";
import { getSetting } from "@/server/settings";
import { accessOf, can, requireStaffPage, storeScope } from "@/server/staff/access";

export const metadata = { title: "Entregas" };

type Props = { searchParams: Promise<{ periodo?: string }> };

/** EN: "Gestão · 4 Entregas, mapa e comissões". PT: Entregas de hoje, mapa, preço, comissões e ganhos. */
export default async function DeliveriesPage({ searchParams }: Props) {
  const staff = await requireStaffPage("deliveries.assign");
  const p = (await searchParams).periodo;
  const period: Period = p === "month" || p === "lastMonth" ? p : "week";
  const db = await getDb();

  // EN: Orders in scope (store managers see their stores'). PT: Encomendas visíveis (gestoras vêem as suas lojas).
  const all = await deliveryOrdersToday();
  const lines = await orderLinesOf(all.map((o) => o.id));
  const scope = storeScope(staff, "deliveries.assign");
  const orders = all.filter((o) => !scope || scope.includes(orderStoreId(o, lines) ?? ""));
  const drivers = await db
    .select({ id: staffUsers.id, name: staffUsers.name, phone: staffUsers.phone, commissionPct: staffUsers.commissionPct })
    .from(staffUsers)
    .innerJoin(roles, eq(staffUsers.roleId, roles.id))
    .where(eq(roles.key, "entregador"));
  const positions = await livePositions(orders.filter((o) => o.fulfillmentStatus === "in_transit").map((o) => o.id));
  const [zones, pricing, general, report] = await Promise.all([
    db.select().from(deliveryZones).orderBy(asc(deliveryZones.position)),
    getSetting<DeliveryPricing>("delivery.pricing", DEFAULT_PRICING),
    getSetting<number>("delivery.commissionPct", 70),
    can(staff, "commissions.view") ? earningsReport(period) : Promise.resolve([]),
  ]);

  const rows = orders.map((o) => {
    const driver = drivers.find((d) => d.id === o.driverId);
    const pay = paymentLine(o);
    return {
      id: o.id,
      number: o.number,
      client: o.contact.name,
      zone: [o.deliveryNeighbourhood, o.deliveryAddress].filter(Boolean).join(" · ") || o.deliveryCity || "—",
      pay: pay.text,
      collect: pay.collect,
      paid: o.paymentStatus === "paid",
      status: o.fulfillmentStatus,
      driverId: o.driverId,
      when: when(o.createdAt),
      waLink: driver ? driverMessage(o, driver.phone) : null,
      driverPhone: driver?.phone ?? null,
      canAssign: o.paymentStatus === "paid" || o.paymentMethod === "cod",
      isDemo: o.isDemo,
      dest: o.deliveryLat != null && o.deliveryLng != null ? { lat: o.deliveryLat, lng: o.deliveryLng } : null,
      position: positions.find((x) => x.orderId === o.id) ?? null,
    };
  });
  const date = formatLongDate(todayMaputo(), "pt");

  return (
    <>
      <PageTop
        eyebrow={date.charAt(0).toUpperCase() + date.slice(1)}
        title="Entregas"
        actions={
          <Link href="/gestao/entregador" className={s.btnOutline}>
            <Icon name="device" size={16} />
            Ver app do entregador
          </Link>
        }
      />
      <DemoTag show={rows.some((r) => r.isDemo)} />

      <DeliveriesBoard
        rows={rows.map((r) => ({ ...r, position: r.position ? { lat: r.position.lat, lng: r.position.lng, at: r.position.at.toISOString() } : null }))}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        canAssign={can(staff, "deliveries.assign")}
      />

      {(can(staff, "deliveries.pricing") || can(staff, "commissions.view")) && (
        <DeliverySettings
          pricing={pricing}
          zones={zones.map((z) => ({ id: z.id, name: z.name, fee: z.fee, eta: z.eta.pt }))}
          editPricing={accessOf(staff, "deliveries.pricing") === "T"}
          showPricing={can(staff, "deliveries.pricing")}
          commissions={{ general, drivers: drivers.map((d) => ({ id: d.id, name: d.name, pct: d.commissionPct })) }}
          editCommissions={accessOf(staff, "commissions.pay") === "T"}
          showCommissions={can(staff, "commissions.view")}
        />
      )}

      {can(staff, "commissions.view") && (
        <section className={s.cardFlush}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>Relatório de ganhos</h2>
            <span className={s.actions}>
              <span className={s.segment}>
                {(["week", "month", "lastMonth"] as const).map((k) => (
                  <Link key={k} href={`?periodo=${k}`} aria-current={period === k ? "true" : undefined}>
                    {periodRange(k).label}
                  </Link>
                ))}
              </span>
              <a href={`/gestao/entregas/exportar?periodo=${period}`} className={`${s.btnOutline} ${s.small}`}>
                Exportar CSV
              </a>
            </span>
          </div>
          {report.length === 0 ? (
            <p className={s.empty}>Sem entregas feitas neste período.</p>
          ) : (
            <EarningsTable
              rows={report.map((r) => ({ ...r, valueLabel: mzn(r.value), amountLabel: mzn(r.amount) }))}
              period={period}
              canPay={accessOf(staff, "commissions.pay") === "T"}
            />
          )}
        </section>
      )}
    </>
  );
}
