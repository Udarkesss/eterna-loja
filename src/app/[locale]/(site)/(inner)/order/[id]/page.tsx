import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { OrderAutoRefresh } from "@/components/checkout/OrderAutoRefresh";
import { DriverCard, TrackingMap } from "@/components/delivery/OrderTracking";
import styles from "@/components/delivery/Tracking.module.css";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { whatsappLink } from "@/data/site";
import { getDictionary, plural, t } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { localizePath } from "@/i18n/config";
import { toMaputo } from "@/lib/time";
import { currentCustomer } from "@/server/accounts";
import { getOrderStatus } from "@/server/checkout";
import { getDb } from "@/server/db";
import { orderEvents, orderLines, stores } from "@/server/db/schema";
import { trackingFor } from "@/server/delivery";
import { findOrder } from "@/server/orders";

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { robots: { index: false } };

/**
 * EN: "Acompanhar a entrega" of design V3 (and the same page for collection in store): status title, map with the driver
 *     while on the way, timeline with times, driver card, reception (or collection) code and address. The link uses the
 *     order's unguessable id.
 * PT: "Acompanhar a entrega" do V3 (e a mesma página para levantamento): título do estado, mapa com o entregador a
 *     caminho, cronologia com horas, cartão do entregador, código de recepção (ou levantamento) e morada.
 */
export default async function OrderPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const status = await getOrderStatus(id); // EN: also refreshes a pending payment. PT: também actualiza o pagamento.
  const order = status ? await findOrder(id) : null;
  if (!status || !order || order.kind !== "purchase") notFound();

  const dict = getDictionary(locale);
  const o = dict.order;
  const db = await getDb();
  const [events, lines, [store], customer] = await Promise.all([
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.at)),
    db.select({ quantity: orderLines.quantity }).from(orderLines).where(eq(orderLines.orderId, order.id)),
    order.pickupStoreId ? db.select().from(stores).where(and(eq(stores.id, order.pickupStoreId))) : Promise.resolve([]),
    currentCustomer(),
  ]);
  const at = (type: string) => events.find((e) => e.type === type)?.at ?? null;
  const time = (d: Date | null) => (d ? toMaputo(d).time : null);
  const isDelivery = order.fulfillmentType === "delivery";
  const f = order.fulfillmentStatus;
  const cancelled = f === "cancelled" || order.paymentStatus === "failed" || order.paymentStatus === "expired";
  const waiting = order.paymentStatus === "pending" && order.paymentMethod !== "cod";

  const flow = isDelivery
    ? [
        { key: "pending", at: order.createdAt },
        { key: "assigned", at: at("assigned") },
        { key: "in_transit", at: order.deliveryStartedAt ?? at("in_transit") },
        { key: "delivered", at: order.deliveredAt ?? at("delivered") },
        { key: "confirmed", at: order.deliveryConfirmedAt ?? at("confirmed") },
      ]
    : [
        { key: "pending", at: order.createdAt },
        { key: "ready", at: at("ready") },
        { key: "collected", at: at("collected") },
      ];
  const labels = isDelivery ? o.fulfillment.delivery : o.fulfillment.pickup;
  const current = Math.max(0, flow.findIndex((s) => s.key === f));
  const heading = cancelled ? o.heading.cancelled : waiting ? o.heading.payment : (o.heading as Record<string, string>)[`${isDelivery ? "d" : "p"}_${f}`] ?? o.heading.preparing;
  const stateLabel = cancelled ? o.state.cancelled : waiting ? o.state.payment : labels[current];
  const pieces = lines.reduce((n, l) => n + l.quantity, 0);
  const paidBy = order.paymentStatus === "paid" ? t(o.paidBy, { method: dict.checkout.methods[order.paymentMethod].name }) : order.paymentMethod === "cod" ? o.cod : o.notPaid;
  const tracking = isDelivery && order.driverId ? await trackingFor(order) : null;
  const showMap = isDelivery && f === "in_transit" && !!tracking?.destination;

  return (
    <div className={`page-x ${styles.page}`}>
      {status.paymentStatus === "pending" && <OrderAutoRefresh />}
      <nav aria-label={dict.nav.breadcrumb} className={styles.crumbs}>
        {customer && (
          <>
            <Link href={localizePath(locale, "/account")}>{o.myAccount}</Link>
            <span>/</span>
            <Link href={`${localizePath(locale, "/account")}#encomendas`}>{o.orders}</Link>
            <span>/</span>
          </>
        )}
        <span aria-current="page">{order.number}</span>
      </nav>

      <div className={styles.head}>
        <div>
          <span className="eyebrow">{t(isDelivery ? o.eyebrowDelivery : o.eyebrowPickup, { number: order.number })}</span>
          <h1 className={styles.title}>
            <RichText text={heading} />
          </h1>
        </div>
        <span className={styles.badge}>
          <Icon name={cancelled ? "alert" : isDelivery ? "truck" : "store"} size={14} />
          {stateLabel}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.left}>
          {isDelivery &&
            (showMap && tracking ? (
              <TrackingMap orderId={order.id} initial={tracking} />
            ) : (
              <div className={styles.mapEmpty}>{f === "delivered" || f === "confirmed" ? o.mapDone : o.mapWaiting}</div>
            ))}
          <ol className={styles.steps} style={{ "--n": flow.length } as React.CSSProperties} aria-label={o.deliveryState}>
            {flow.map((s, i) => (
              <li key={s.key} data-state={cancelled ? "todo" : i < current ? "done" : i === current ? "now" : "todo"}>
                <span>{labels[i]}</span>
                <span className={styles.xs}>{i <= current && !cancelled ? (time(s.at) ?? "—") : o.next}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.right}>
          {isDelivery &&
            (tracking?.driver ? (
              <DriverCard orderId={order.id} initial={tracking} />
            ) : (
              <section className={styles.card}>
                <span className="eyebrow">{o.tracking.yourDriver}</span>
                <span className={styles.muted}>{o.driverSoon}</span>
              </section>
            ))}

          {order.deliveryCode && !cancelled && f !== "confirmed" && f !== "collected" && (
            <section className={styles.code} aria-label={isDelivery ? o.receptionCode : o.pickupCode}>
              <span className="eyebrow">{isDelivery ? o.receptionCode : o.pickupCode}</span>
              <span className={styles.codeValue}>{order.deliveryCode}</span>
              <span className={styles.codeHint}>{isDelivery ? o.receptionHint : o.pickupHint}</span>
            </section>
          )}

          <section className={styles.card}>
            <span className="eyebrow">{isDelivery ? o.tracking.address : o.pickupTitle}</span>
            <span className={styles.address}>
              <Icon name={isDelivery ? "pin" : "store"} size={18} />
              <span>
                {isDelivery
                  ? [order.deliveryAddress, order.deliveryNeighbourhood, order.deliveryCity].filter(Boolean).join(", ")
                  : `${store?.name ?? "Eterna"} · ${store?.location ?? "Glória Mall"}`}
                {isDelivery && order.deliveryReference && (
                  <>
                    <br />
                    <span className={styles.muted}>{t(o.reference, { reference: order.deliveryReference })}</span>
                  </>
                )}
              </span>
            </span>
            <span className={styles.summary}>{[plural(o.pieces, pieces), paidBy].join(" · ")}</span>
            <a href={whatsappLink(t(o.helpMessage, { number: order.number }))} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {isDelivery ? o.helpDelivery : o.help}
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
