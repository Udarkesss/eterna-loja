import Image from "next/image";
import { PrintButton } from "@/components/admin/PrintButton";
import { notFound } from "next/navigation";
import s from "@/components/admin/admin.module.css";
import { OrderActions, OrderNotes, OrderRefunds } from "@/components/admin/OrderActions";
import { Chip, mzn, PageTop, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { site, whatsappLink } from "@/data/site";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { eq } from "drizzle-orm";
import { eventLabel, FULFILLMENT_LABEL, getOrderDetail, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { getDb } from "@/server/db";
import { roles, staffUsers } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { accessOf, can, canEdit, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Encomenda" };

/** EN: "Gestão · 3 Detalhe da encomenda". PT: Detalhe da encomenda. */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getOrderDetail(staff, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const { order: o } = d;
  const phone = o.contact.phone ?? o.msisdn;
  const pay = PAYMENT_LABEL[o.paymentStatus];

  // EN: Drivers for the "Entregas" select. PT: Entregadores para atribuir.
  const db = await getDb();
  const drivers =
    o.fulfillmentType === "delivery" && can(staff, "deliveries.assign")
      ? await db
          .select({ id: staffUsers.id, name: staffUsers.name })
          .from(staffUsers)
          .innerJoin(roles, eq(staffUsers.roleId, roles.id))
          .where(eq(roles.key, "entregador"))
      : [];

  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/encomendas", label: "Encomendas" }, { href: `/gestao/encomendas?q=${encodeURIComponent(o.contact.name)}`, label: o.contact.name }, { label: o.number }]}
        eyebrow={`${when(o.createdAt)} · loja online`}
        title={
          <>
            Encomenda <em>{o.number}</em>
          </>
        }
        actions={
          <>
            <Chip tone={pay.tone}>{pay.label}</Chip>
            {o.fulfillmentStatus !== "pending" && <Chip tone={o.fulfillmentStatus === "cancelled" ? "bad" : "ok"}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Chip>}
            {o.isDemo && <Chip>Exemplo</Chip>}
            <PrintButton />
          </>
        }
      />

      <div className={s.split}>
        <div className={s.stack}>
          <section className={s.card}>
            <h2 className={s.h2}>Peças</h2>
            <ul className={s.list}>
              {d.lines.map((l) => (
                <li key={l.id} className={s.listItem} style={{ alignItems: "center" }}>
                  {l.imageUrl ? <Image src={l.imageUrl} alt="" width={56} height={70} className={s.thumb} style={{ width: 56, height: 70 }} /> : <span className={s.thumb} />}
                  <span className={s.two} style={{ flexGrow: 1 }}>
                    <span className={s.strong}>{l.code}</span>
                    <span className={s.muted}>
                      {[l.color, l.size, `Qtd. ${l.quantity}`, d.lineStores.find((st) => st.id === l.storeId) ? `Loja ${d.lineStores.find((st) => st.id === l.storeId)!.code}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={s.num}>{mzn(l.unitPrice * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className={s.dl} style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <dt>Subtotal</dt>
              <dd className={s.num}>{mzn(o.subtotal)}</dd>
              {o.discount > 0 && (
                <>
                  <dt>Desconto {o.discountCode}</dt>
                  <dd className={s.num}>−{mzn(o.discount)}</dd>
                </>
              )}
              <dt>{o.fulfillmentType === "pickup" ? "Levantamento em loja" : "Entrega"}</dt>
              <dd>{o.shippingFee ? mzn(o.shippingFee) : o.fulfillmentType === "pickup" ? "Grátis" : "[por definir]"}</dd>
              <dt className={s.strong} style={{ color: "var(--ink)" }}>
                Total
              </dt>
              <dd className={`${s.num} ${s.strong}`}>{mzn(o.total)}</dd>
            </dl>
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Pagamento</h2>
            <dl className={s.dl}>
              <dt>Método</dt>
              <dd>{METHOD_LABEL[o.paymentMethod]}</dd>
              {d.msisdnMasked && (
                <>
                  <dt>Número</dt>
                  <dd>+258 {d.msisdnMasked}</dd>
                </>
              )}
              <dt>Referência</dt>
              <dd>{o.paymentReference ?? "—"}</dd>
              <dt>Resposta</dt>
              <dd>{o.paymentResponseCode ? `${o.paymentResponseCode}${o.paymentResponseCode === "INS-0" ? " · sucesso" : ""}` : "—"}</dd>
              {o.paymentMethod === "cod" && o.cashChangeFor && (
                <>
                  <dt>Troco para</dt>
                  <dd>{o.cashChangeFor}</dd>
                </>
              )}
              {o.paymentMethod === "transfer" && (
                <>
                  <dt>Comprovativo</dt>
                  <dd>
                    {o.transferProofUrl ? (
                      <a href={`/gestao/ficheiro?encomenda=${o.id}`} target="_blank" className={s.a}>
                        Abrir comprovativo
                      </a>
                    ) : (
                      "Ainda não enviado"
                    )}
                  </dd>
                </>
              )}
            </dl>
            <OrderRefunds
              orderId={o.id}
              total={o.total}
              refunds={d.refunds.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, status: r.status, at: when(r.createdAt) }))}
              canRequest={o.paymentStatus === "paid" && accessOf(staff, "refunds") !== "—"}
              canApprove={accessOf(staff, "refunds") === "T"}
              needsApproval={accessOf(staff, "refunds") === "Pd"}
            />
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Cronologia</h2>
            <ol className={s.timeline}>
              {d.events.map((e) => (
                <li key={e.id}>
                  <span className={s.dot} />
                  <span className={s.muted}>{when(e.at).replace("Hoje, ", "")}</span>
                  <span className={s.two}>
                    <span>{eventLabel(e.type)}</span>
                    {(e.detail || e.actorName) && (
                      <span className={s.muted}>
                        {[e.detail?.replace(/ · Foto: file:[0-9a-f-]{36}/, ""), e.actorName].filter(Boolean).join(" · ")}
                        {/* EN: Door photo of a failed delivery. PT: Foto da porta de uma entrega não concluída. */}
                        {e.detail?.match(/file:([0-9a-f-]{36})/) && (
                          <>
                            {" · "}
                            <a href={`/gestao/ficheiro?encomenda=${o.id}&foto=${e.detail.match(/file:([0-9a-f-]{36})/)![1]}`} target="_blank" className={s.a}>
                              Ver foto
                            </a>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className={s.stack}>
          <section className={s.card}>
            <h2 className={s.h2}>Próximo passo</h2>
            <OrderActions
              order={{
                id: o.id,
                paymentMethod: o.paymentMethod,
                paymentStatus: o.paymentStatus,
                fulfillmentType: o.fulfillmentType,
                fulfillmentStatus: o.fulfillmentStatus,
                hasProof: !!o.transferProofUrl,
                storeLabel: d.store ? `Loja ${d.store.code}` : "a loja",
                driverId: o.driverId,
                deliveryCode: o.deliveryCode,
              }}
              drivers={drivers}
              can={{
                edit: canEdit(staff, "orders.edit"),
                validate: can(staff, "transfers.validate"),
                cancel: can(staff, "orders.cancel"),
                assign: can(staff, "deliveries.assign"),
              }}
            />
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Cliente</h2>
            <div className={s.two}>
              <span className={s.strong}>{o.contact.name}</span>
              {phone && <span>+258 {formatMsisdn(phone)}</span>}
              {o.contact.email && <span className={s.muted}>{o.contact.email}</span>}
              <span className={s.muted}>
                {d.customerIndex}.ª encomenda{d.account ? ` · conta desde ${d.account.createdAt.getFullYear()}` : " · sem conta"}
              </span>
            </div>
            {o.fulfillmentType === "pickup" && o.deliveryCode && (
              <span>
                Código de levantamento: <strong style={{ fontWeight: 500, letterSpacing: "0.2em" }}>{o.deliveryCode}</strong>
              </span>
            )}
            {o.fulfillmentType === "delivery" && (
              <div className={s.two}>
                <span className={s.muted}>Morada</span>
                <span>
                  {[o.deliveryAddress, o.deliveryNeighbourhood, o.deliveryCity].filter(Boolean).join(", ")}
                </span>
                {o.deliveryCode && (
                  <span>
                    Código de recepção: <strong style={{ fontWeight: 500, letterSpacing: "0.2em" }}>{o.deliveryCode}</strong>
                  </span>
                )}
              </div>
            )}
            {phone && (
              <div className={s.actions}>
                <a href={whatsappLink(`Olá ${o.contact.name.split(" ")[0]}, sobre a sua encomenda ${o.number} na Eterna:`, `258${phone}`)} target="_blank" rel="noopener noreferrer" className={s.btnOutline}>
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                </a>
                <a href={`sms:+258${phone}`} className={s.btnOutline}>
                  Enviar SMS
                </a>
                {o.fulfillmentType === "delivery" && o.deliveryCode && !["confirmed", "cancelled"].includes(o.fulfillmentStatus) && (
                  <a
                    href={whatsappLink(
                      `Olá ${o.contact.name.replace(/^\[[^\]]*\]\s*/, "").split(" ")[0]}, o código de recepção da sua encomenda Eterna ${o.number} é ${o.deliveryCode}. Dê-o ao entregador só depois de receber e verificar a encomenda. Acompanhe: ${site.url}/${o.locale}/order/${o.id}`,
                      `258${phone}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.btnOutline}
                  >
                    <Icon name="whatsapp" size={16} />
                    Reenviar código
                  </a>
                )}
              </div>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Notas internas</h2>
            <OrderNotes orderId={o.id} initial={o.internalNotes ?? ""} canEdit={canEdit(staff, "orders.edit")} />
          </section>
        </div>
      </div>
    </>
  );
}
