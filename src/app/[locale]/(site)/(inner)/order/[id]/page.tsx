import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { OrderAutoRefresh } from "@/components/checkout/OrderAutoRefresh";
import { OrderTracking } from "@/components/delivery/OrderTracking";
import { Icon } from "@/components/ui/Icon";
import { getDictionary, t } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { formatMZN } from "@/lib/format";
import { getOrderStatus } from "@/server/checkout";
import { trackingFor } from "@/server/delivery";
import { findOrder } from "@/server/orders";
import type { FulfillmentStatus } from "@/types";
import styles from "./order.module.css";

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { robots: { index: false } };

const PICKUP_STEPS: FulfillmentStatus[] = ["pending", "ready", "collected"];
const DELIVERY_STEPS: FulfillmentStatus[] = ["pending", "assigned", "in_transit", "delivered", "confirmed"];

/**
 * EN: Order tracking ("Telemóvel · Acompanhar entrega"). The link uses the order's unguessable id.
 *     Once a driver is assigned: driver card, live map while in transit and "Confirmo que recebi".
 * PT: Acompanhar a encomenda. O endereço usa o id impossível de adivinhar da encomenda.
 *     Com entregador atribuído: cartão do entregador, mapa ao vivo em trânsito e "Confirmo que recebi".
 */
export default async function OrderPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const status = await getOrderStatus(id); // EN: also refreshes a pending payment. PT: também actualiza o pagamento.
  const order = status ? await findOrder(id) : null;
  if (!status || !order) notFound();

  const dict = getDictionary(locale);
  const isDelivery = order.fulfillmentType === "delivery";
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const labels = isDelivery ? dict.order.fulfillment.delivery : dict.order.fulfillment.pickup;
  const stage = Math.max(0, steps.indexOf(order.fulfillmentStatus));

  return (
    <>
      <PageHead eyebrow={t(dict.order.title, { number: order.number })} title={labels[stage]}>
        <p className={styles.total}>
          {dict.checkout.summary.total}: {formatMZN(order.total, locale)} · {dict.checkout.methods[order.paymentMethod].name}
        </p>
      </PageHead>
      <PageBody>
        {status.paymentStatus === "pending" && <OrderAutoRefresh />}

        <ol aria-label={dict.order.deliveryState} className={styles.timeline}>
          {labels.map((label, i) => (
            <li key={label} aria-current={i === stage ? "step" : undefined} className={i <= stage ? styles.done : styles.todo}>
              <span className={styles.mark}>{i <= stage ? "✓" : ""}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {isDelivery && (
          <>
            <section className={styles.code} aria-label={dict.order.receptionCode}>
              <span className="label">{dict.order.receptionCode}</span>
              <span className={styles.codeValue}>{order.deliveryCode}</span>
              <span className={styles.hint}>{dict.order.receptionHint}</span>
            </section>
            {order.driverId ? (
              <OrderTracking orderId={order.id} number={order.number} initial={await trackingFor(order)} />
            ) : (
              <p>{dict.order.driverSoon}</p>
            )}
            <div className={styles.address}>
              <Icon name="pin" size={18} />
              <span>
                {[order.deliveryAddress, order.deliveryNeighbourhood, order.deliveryCity].filter(Boolean).join(", ")}
              </span>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
