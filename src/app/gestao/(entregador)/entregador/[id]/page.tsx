import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverDeliveryView } from "@/components/delivery/DriverDeliveryView";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { formatMZN } from "@/lib/format";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { driverDelivery } from "@/server/delivery";
import { AppError } from "@/server/errors";
import { requireStaffPage } from "@/server/staff/access";

/** EN: "Entregador · Entrega, GPS e código". PT: Uma entrega: morada, rota, contacto, cobrança e código. */
export default async function DriverDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaffPage(undefined, { allowDriver: true });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await driverDelivery(me, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const o = d.order;
  const phone = o.contact.phone ?? o.msisdn;
  const dest = o.deliveryLat != null && o.deliveryLng != null ? { lat: o.deliveryLat, lng: o.deliveryLng } : null;
  const address = [o.deliveryAddress, o.deliveryNeighbourhood, o.deliveryCity].filter(Boolean).join(", ");
  const query = dest ? `${dest.lat},${dest.lng}` : encodeURIComponent(address);
  const cod = o.paymentMethod === "cod" && o.paymentStatus === "pending";

  return (
    <main className={s.body}>
      <Link href="/gestao/entregador" className={s.line} style={{ color: "var(--ink)", marginTop: -8 }}>
        <Icon name="arrowLeft" size={18} />
        <span className={s.number} style={{ fontSize: 18 }}>
          {o.number}
        </span>
      </Link>
      <h1 className={s.h1} style={{ fontSize: 32 }}>
        {o.contact.name}
      </h1>
      <span className={s.muted} style={{ fontSize: 14, marginTop: -10 }}>
        {d.pieces} {d.pieces === 1 ? "peça" : "peças"} · saco Eterna
      </span>

      <DriverDeliveryView
        order={{ id: o.id, status: o.fulfillmentStatus, cod, dest }}
        navigation={{
          google: `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`,
          waze: dest ? `https://waze.com/ul?ll=${query}&navigate=yes` : `https://waze.com/ul?q=${query}`,
        }}
        address={
          <span className={s.address}>
            <Icon name="pin" size={20} />
            <span>
              {address || "Morada por confirmar com a cliente"}
              {o.deliveryReference && (
                <>
                  <br />
                  <span className={s.muted}>Ref.: {o.deliveryReference}</span>
                </>
              )}
            </span>
          </span>
        }
        contact={
          phone ? (
            <div className={s.row2}>
              <a href={`tel:+258${phone}`} className={s.btnOutline} style={{ minHeight: 48 }} aria-label={`Ligar para +258 ${formatMsisdn(phone)}`}>
                <Icon name="phone" size={18} />
                Ligar
              </a>
              <a
                href={whatsappLink(`Olá ${o.contact.name.split(" ")[0]}, sou o entregador da Eterna com a sua encomenda ${o.number}.`, `258${phone}`)}
                className={s.btnOutline}
                style={{ minHeight: 48 }}
              >
                <Icon name="whatsapp" size={18} />
                WhatsApp
              </a>
            </div>
          ) : null
        }
        cash={
          cod ? (
            <section className={s.cash}>
              <Icon name="cash" size={22} />
              <span>
                <strong>Cobrar em dinheiro: {formatMZN(o.total, "pt")}</strong>
                <span style={{ fontSize: 13, color: "var(--ink)" }}>{o.cashChangeFor ? `A cliente pediu troco para ${o.cashChangeFor}.` : "Sem pedido de troco."}</span>
              </span>
            </section>
          ) : null
        }
      />

      <div className={s.footer}>
        <span className={s.muted}>A sua comissão nesta entrega</span>
        <span style={{ fontWeight: 500 }}>{formatMZN(d.commission, "pt")}</span>
      </div>
    </main>
  );
}
