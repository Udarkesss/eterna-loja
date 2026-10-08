import { eq } from "drizzle-orm";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { DeliveryAssign } from "@/components/admin/DeliveryAssign";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { FULFILLMENT_LABEL, listOrdersFor, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { getDb } from "@/server/db";
import { roles, staffUsers } from "@/server/db/schema";
import { can, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Entregas" };

/**
 * EN: Home deliveries: assign a driver and follow the status. The live map, driver app and commissions
 *     (design "Gestão · 4 Entregas") arrive in phase 5.
 * PT: Entregas ao domicílio: atribuir entregador e seguir o estado. Mapa ao vivo, app do entregador e comissões
 *     chegam na fase 5.
 */
export default async function DeliveriesPage() {
  const staff = await requireStaffPage("deliveries.assign");
  const db = await getDb();
  const rows = (await listOrdersFor(staff)).filter(
    ({ order: o }) => o.fulfillmentType === "delivery" && o.fulfillmentStatus !== "cancelled" && (o.paymentStatus === "paid" || o.paymentMethod === "cod"),
  );
  const drivers = await db
    .select({ id: staffUsers.id, name: staffUsers.name })
    .from(staffUsers)
    .innerJoin(roles, eq(staffUsers.roleId, roles.id))
    .where(eq(roles.key, "entregador"));
  const open = rows.filter(({ order: o }) => !["delivered", "confirmed"].includes(o.fulfillmentStatus));
  const done = rows.filter(({ order: o }) => ["delivered", "confirmed"].includes(o.fulfillmentStatus)).slice(0, 20);

  const table = (list: typeof rows, assign: boolean) => (
    <table className={s.table}>
      <thead>
        <tr>
          <th>Encomenda</th>
          <th>Morada</th>
          <th>Valor</th>
          <th>Estado</th>
          <th>Entregador</th>
        </tr>
      </thead>
      <tbody>
        {list.map(({ order: o }) => (
          <tr key={o.id}>
            <td>
              <span className={s.two}>
                <Link href={`/gestao/encomendas/${o.id}`} className={s.a}>
                  {o.number}
                </Link>
                <span className={s.muted}>
                  {when(o.createdAt)} · {o.contact.name}
                </span>
              </span>
            </td>
            <td className={s.muted}>{[o.deliveryAddress, o.deliveryNeighbourhood, o.deliveryCity].filter(Boolean).join(", ")}</td>
            <td>
              <span className={s.two}>
                <span className={s.num}>{mzn(o.total)}</span>
                <span className={s.muted}>
                  {METHOD_LABEL[o.paymentMethod]} · {PAYMENT_LABEL[o.paymentStatus].label}
                  {o.paymentMethod === "cod" && o.paymentStatus === "pending" ? " · cobrar na entrega" : ""}
                </span>
              </span>
            </td>
            <td>
              <Chip tone={["delivered", "confirmed"].includes(o.fulfillmentStatus) ? "ok" : o.fulfillmentStatus === "pending" ? "warn" : ""}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Chip>
            </td>
            <td>{assign && can(staff, "deliveries.assign") ? <DeliveryAssign orderId={o.id} driverId={o.driverId} drivers={drivers} /> : (drivers.find((d) => d.id === o.driverId)?.name ?? "—")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <PageTop eyebrow={`${open.length} por entregar`} title="Entregas" />
      <DemoTag show={rows.some((r) => r.order.isDemo)} />
      <div className={s.warning}>O mapa ao vivo, a app do entregador (GPS e código de entrega) e as comissões chegam na fase 5. Por agora atribua o entregador e avance o estado no detalhe da encomenda.</div>
      <section className={s.cardFlush}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Por entregar</h2>
        </div>
        {open.length ? table(open, true) : <p className={s.empty}>Sem entregas por fazer.</p>}
      </section>
      {done.length > 0 && (
        <section className={s.cardFlush}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>Entregues recentemente</h2>
          </div>
          {table(done, false)}
        </section>
      )}
    </>
  );
}
