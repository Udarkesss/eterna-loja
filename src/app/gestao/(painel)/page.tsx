import Image from "next/image";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import m from "@/components/admin/Mobile.module.css";
import { DeliveryOffNote } from "@/components/admin/ModuleOffNote";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { formatLongDate, toMaputo } from "@/lib/time";
import type { FittingKind } from "@/types";
import { dashboardFor } from "@/server/admin/dashboard";
import { listAdminReservations } from "@/server/admin/reservations";
import { FULFILLMENT_LABEL, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { can, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Painel" };

/**
 * EN: "Gestão · Painel" of design V3: greeting, four numbers, active collection, reservations ending, notices, today's
 *     Bridal fittings, recent orders and the delivery-module note.
 * PT: Painel do V3: saudação, quatro números, colecção activa, reservas a terminar, avisos, provas de hoje da Bridal,
 *     encomendas recentes e a nota do módulo de entregas.
 */
export default async function DashboardPage() {
  const staff = await requireStaffPage("dashboard");
  const d = await dashboardFor(staff);
  // EN: "Reservas activas" and "Reservas a terminar" of design V3 (only for roles that see reservations).
  // PT: "Reservas activas" e "Reservas a terminar" do V3 (só para papéis que vêem reservas).
  const res = can(staff, "reservations") ? await listAdminReservations(staff, { view: "terminar" }) : null;
  const ending = res ? res.list.slice(0, 3) : [];
  const hour = Number(toMaputo(new Date()).time.slice(0, 2));
  const greeting = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const date = formatLongDate(d.today, "pt");
  const first = staff.name.replace(/[[\]]/g, "").split(" ")[0];
  const hasDemo = d.recent.some((r) => r.order.isDemo) || d.fittingsToday.some((f) => f.isDemo);
  const notices = [
    ...d.attention.map((a) => ({ icon: "alert" as const, title: a.title, body: a.body, href: a.href })),
    ...d.recent.slice(0, 3).map(({ order: o }) => ({
      icon: "bag" as const,
      title: `Nova encomenda ${o.number} · ${mzn(o.total)} · ${METHOD_LABEL[o.paymentMethod]}`,
      body: `${when(o.createdAt)} · ${PAYMENT_LABEL[o.paymentStatus].label.toLowerCase()}`,
      href: `/gestao/encomendas/${o.id}`,
    })),
  ].slice(0, 5);

  return (
    <>
      <PageTop
        eyebrow={date}
        title={
          <>
            {greeting}, <em>{first}</em>
          </>
        }
        actions={
          <>
            {can(staff, "reservations") && (
              <Link href="/gestao/reservas?nova=1" className={s.btnOutline}>
                Nova reserva
              </Link>
            )}
            {can(staff, "products.edit") && (
              <Link href="/gestao/produtos/novo" className={s.btn}>
                <Icon name="plus" size={16} />
                Novo produto
              </Link>
            )}
          </>
        }
      />
      <DemoTag show={hasDemo} />

      {/* EN: Phone (V3-M-G-Painel). PT: Telemóvel. */}
      <div className={`${m.mOnly} ${m.mbody}`}>
        <div className={m.mkpis}>
          <div className={m.kpi}>
            <span className={m.label}>Vendas de hoje</span>
            <b>{mzn(d.salesToday)}</b>
            <span className={m.small}>
              {d.paidTodayCount} {d.paidTodayCount === 1 ? "encomenda" : "encomendas"}
            </span>
          </div>
          <div className={m.kpi}>
            <span className={m.label}>Por preparar</span>
            <b>{d.toPrepare}</b>
            <span className={m.small}>{d.toPrepareStores || "Tudo preparado"}</span>
          </div>
          {res ? (
            <div className={m.kpi}>
              <span className={m.label}>Reservas activas</span>
              <b>{res.kpis.active}</b>
              <span className={m.small}>{res.kpis.ending ? `${res.kpis.ending} ${res.kpis.ending === 1 ? "termina" : "terminam"} em ${res.settings.remindDays} dias` : "Nenhuma a terminar"}</span>
            </div>
          ) : (
            <div className={m.kpi}>
              <span className={m.label}>Pagamentos pendentes</span>
              <b>{d.pendingCount}</b>
              <span className={m.small}>{d.pendingHint}</span>
            </div>
          )}
          <div className={m.kpi}>
            <span className={m.label}>Provas esta semana</span>
            <b>{d.fittingsWeek}</b>
            <span className={m.small}>{d.fittingRequests ? `${d.fittingRequests} por responder` : "Nenhum pedido"}</span>
          </div>
        </div>
        {d.collection && (
          <section className={m.mcard}>
            <div className={m.mcardH}>
              <h3>Colecção activa</h3>
            </div>
            <div className={m.mcardB}>
              <div className={m.mli} style={{ padding: 0, border: 0 }}>
                <span className={m.thumb}>{d.collection.imageUrl && <Image src={d.collection.imageUrl} alt="" fill sizes="48px" />}</span>
                <span className={m.t}>
                  {d.collection.edition && <span>{d.collection.edition}</span>}
                  <b>{d.collection.name}</b>
                </span>
              </div>
              <div className={m.mrow2}>
                {d.collection.lines.slice(0, 2).map((l) => (
                  <div key={l.name} className={m.kpi}>
                    <b>{l.count}</b>
                    <span className={m.small}>{l.name.replace(/^Roupa (de )?/, "")}</span>
                  </div>
                ))}
              </div>
              <span className={m.note}>{d.collection.soldOut} indisponíveis</span>
              <div className={m.mrow2}>
                {can(staff, "products.edit") && (
                  <Link href="/gestao/produtos/novo" className={s.btnOutline}>
                    Adicionar peças
                  </Link>
                )}
                <Link href="/gestao/coleccoes" className={s.btnOutline}>
                  Mudar colecção
                </Link>
              </div>
            </div>
          </section>
        )}
        {res && (
          <section className={m.mcard}>
            <div className={m.mcardH}>
              <h3>Reservas a terminar</h3>
              <Link href="/gestao/reservas?vista=terminar">Ver todas</Link>
            </div>
            {ending.length === 0 ? (
              <p className={m.empty}>Nenhuma reserva a terminar nos próximos {res.settings.remindDays} dias.</p>
            ) : (
              ending.map((r) => (
                <div key={r.id} className={m.mli} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <b style={{ fontWeight: 500 }}>
                      {r.code} · {r.customer}
                    </b>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {r.store} · {r.due !== "—" ? `falta pagar ${r.due} MT` : r.origin === "Na loja" ? "reserva feita na loja" : "reserva online"}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: r.tone === "bad" ? "var(--danger, #a63a2b)" : "var(--muted)", whiteSpace: "nowrap" }}>{r.left}</span>
                  {r.remindHref && (
                    <a href={r.remindHref} target="_blank" rel="noopener noreferrer" className={`${s.btnOutline} ${s.small}`}>
                      Avisar
                    </a>
                  )}
                </div>
              ))
            )}
          </section>
        )}
        <section className={m.mcard}>
          <div className={m.mcardH}>
            <h3>Encomendas recentes</h3>
            <Link href="/gestao/encomendas">Ver todas</Link>
          </div>
          {d.recent.length === 0 ? (
            <p className={m.empty}>Ainda não há encomendas.</p>
          ) : (
            d.recent.slice(0, 3).map(({ order: o }) => (
              <Link key={o.id} href={`/gestao/encomendas/${o.id}`} className={m.mli}>
                <span className={m.ic}>
                  <Icon name="bag" size={18} />
                </span>
                <span className={m.t}>
                  <b>{o.number}</b>
                  <span>
                    {o.contact.name} · {when(o.createdAt)}
                  </span>
                </span>
                <span className={m.r}>
                  <b>{mzn(o.total)}</b>
                  <Chip tone={o.fulfillmentStatus === "pending" ? "warn" : ""}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Chip>
                </span>
              </Link>
            ))
          )}
        </section>
        <section className={m.mcard}>
          <div className={m.mcardH}>
            <h3>Avisos</h3>
          </div>
          {notices.length === 0 ? (
            <p className={m.empty}>Tudo em dia.</p>
          ) : (
            notices.map((n, i) => (
              <Link key={i} href={n.href ?? "/gestao"} className={m.mli}>
                <span className={m.ic}>
                  <Icon name={n.icon} size={18} />
                </span>
                <span className={m.t}>
                  <b>{n.title}</b>
                  <span>{n.body}</span>
                </span>
              </Link>
            ))
          )}
        </section>
        {can(staff, "fittings") && d.fittingsToday.length > 0 && (
          <section className={m.mcard}>
            <div className={m.mcardH}>
              <h3>Provas de hoje</h3>
              <Link href="/gestao/provas">Agenda</Link>
            </div>
            {d.fittingsToday.map((f) => (
              <Link key={f.id} href={`/gestao/provas?sel=${f.id}`} className={m.mli}>
                <span className={m.t}>
                  <b>
                    {toMaputo(f.startsAt).time} · {f.clientName}
                  </b>
                  <span>
                    {FITTING_KIND_LABELS[f.kind as FittingKind].pt} · Loja {f.storeCode}
                  </span>
                </span>
                <span className={m.r}>
                  <Chip tone={f.status === "confirmed" ? "ok" : "warn"}>{f.status === "confirmed" ? "Confirmada" : "Por confirmar"}</Chip>
                </span>
              </Link>
            ))}
          </section>
        )}
        {!d.delivery && <DeliveryOffNote />}
      </div>

      <div className={`${d3.kpis} ${m.dOnly}`}>
        <div className={d3.kpi}>
          <span className={d3.kpiLabel}>Vendas de hoje</span>
          <b>{mzn(d.salesToday)}</b>
          <span className={d3.kpiSub}>
            {d.paidTodayCount} {d.paidTodayCount === 1 ? "encomenda" : "encomendas"}
          </span>
        </div>
        <div className={d3.kpi}>
          <span className={d3.kpiLabel}>Por preparar</span>
          <b className={d3.gold}>{d.toPrepare}</b>
          <span className={d3.kpiSub}>{d.toPrepareStores || "Tudo preparado"}</span>
        </div>
        {res ? (
          <div className={d3.kpi}>
            <span className={d3.kpiLabel}>Reservas activas</span>
            <b className={d3.gold}>{res.kpis.active}</b>
            <span className={d3.kpiSub}>{res.kpis.ending ? `${res.kpis.ending} ${res.kpis.ending === 1 ? "termina" : "terminam"} em ${res.settings.remindDays} dias` : "Nenhuma a terminar"}</span>
          </div>
        ) : (
          <div className={d3.kpi}>
            <span className={d3.kpiLabel}>Pagamentos pendentes</span>
            <b className={d3.gold}>{d.pendingCount}</b>
            <span className={d3.kpiSub}>{d.pendingHint}</span>
          </div>
        )}
        <div className={d3.kpi}>
          <span className={d3.kpiLabel}>Provas esta semana</span>
          <b>{d.fittingsWeek}</b>
          <span className={d3.kpiSub}>{d.fittingRequests ? `${d.fittingRequests} ${d.fittingRequests === 1 ? "pedido" : "pedidos"} por responder` : "Nenhum pedido por responder"}</span>
        </div>
      </div>

      <div className={`${d3.grid} ${m.dOnly}`}>
        <div className={d3.col}>
          {d.collection && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Colecção activa</h2>
                <Link href="/gestao/coleccoes" className={d3.ulink}>
                  Colecções
                </Link>
              </div>
              <div className={d3.collection}>
                <span className={d3.cover}>{d.collection.imageUrl && <Image src={d.collection.imageUrl} alt="" fill sizes="200px" />}</span>
                <div className={d3.collText}>
                  {d.collection.edition && <span className={d3.edition}>{d.collection.edition}</span>}
                  <span className={d3.collName}>{d.collection.name}</span>
                  <span className={d3.counts}>
                    {d.collection.lines.map((l) => (
                      <span key={l.name}>
                        <b>{l.count}</b> {l.name.replace(/^Roupa (de )?/, "")}
                      </span>
                    ))}
                    <span className={d3.muted}>
                      <b>{d.collection.soldOut}</b> indisponíveis
                    </span>
                  </span>
                  <div className={s.actions}>
                    {can(staff, "products.edit") && (
                      <Link href="/gestao/produtos/novo" className={s.btn}>
                        <Icon name="plus" size={16} />
                        Adicionar peças
                      </Link>
                    )}
                    <Link href="/gestao/coleccoes" className={s.btnOutline}>
                      Mudar colecção
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {res && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Reservas a terminar</h2>
                <Link href="/gestao/reservas?vista=terminar" className={d3.ulink}>
                  Ver todas
                </Link>
              </div>
              {ending.length === 0 ? (
              <p className={d3.empty}>Nenhuma reserva a terminar nos próximos {res.settings.remindDays} dias.</p>
            ) : (
              ending.map((r) => (
                <div key={r.id} className={undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <b style={{ fontWeight: 500 }}>
                      {r.code} · {r.customer}
                    </b>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {r.store} · {r.due !== "—" ? `falta pagar ${r.due} MT` : r.origin === "Na loja" ? "reserva feita na loja" : "reserva online"}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: r.tone === "bad" ? "var(--danger, #a63a2b)" : "var(--muted)", whiteSpace: "nowrap" }}>{r.left}</span>
                  {r.remindHref && (
                    <a href={r.remindHref} target="_blank" rel="noopener noreferrer" className={`${s.btnOutline} ${s.small}`}>
                      Avisar
                    </a>
                  )}
                </div>
              ))
            )}
            </section>
          )}

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Encomendas recentes</h2>
              <Link href="/gestao/encomendas" className={d3.ulink}>
                Ver todas
              </Link>
            </div>
            {d.recent.length === 0 ? (
              <p className={d3.empty}>Ainda não há encomendas.</p>
            ) : (
              <table className={d3.table}>
                <thead>
                  <tr>
                    <th>Encomenda</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>{d.delivery ? "Entrega" : "Levantamento"}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map(({ order: o }) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/gestao/encomendas/${o.id}`} className={d3.strong}>
                          {o.number}
                        </Link>
                        <span className={d3.muted}>{when(o.createdAt)}</span>
                      </td>
                      <td>{o.contact.name}</td>
                      <td className={s.num}>{mzn(o.total)}</td>
                      <td>
                        <Chip tone={PAYMENT_LABEL[o.paymentStatus].tone}>
                          {PAYMENT_LABEL[o.paymentStatus].label} · {METHOD_LABEL[o.paymentMethod]}
                        </Chip>
                      </td>
                      <td>
                        <Chip tone={o.fulfillmentStatus === "pending" ? "warn" : ""}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className={d3.col}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Avisos</h2>
            </div>
            {notices.length === 0 ? (
              <p className={d3.empty}>Tudo em dia.</p>
            ) : (
              <ul className={d3.notices}>
                {notices.map((n, i) => (
                  <li key={i}>
                    <span className={d3.noticeIcon}>
                      <Icon name={n.icon} size={18} />
                    </span>
                    <span className={d3.noticeText}>
                      {n.href ? (
                        <Link href={n.href} className={d3.strong}>
                          {n.title}
                        </Link>
                      ) : (
                        <span className={d3.strong}>{n.title}</span>
                      )}
                      <span className={d3.muted}>{n.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can(staff, "fittings") && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Provas de hoje · Bridal</h2>
                <Link href="/gestao/provas" className={d3.ulink}>
                  Agenda
                </Link>
              </div>
              {d.fittingsToday.length === 0 ? (
                <p className={d3.empty}>Sem provas hoje.</p>
              ) : (
                <ul className={d3.fittings}>
                  {d.fittingsToday.map((f) => (
                    <li key={f.id}>
                      <span className={d3.time}>{toMaputo(f.startsAt).time}</span>
                      <Link href={`/gestao/provas?sel=${f.id}`} className={d3.noticeText}>
                        <span>{f.clientName}</span>
                        <span className={d3.muted}>
                          {FITTING_KIND_LABELS[f.kind as FittingKind].pt} · Loja {f.storeCode}
                        </span>
                      </Link>
                      <Chip tone={f.status === "confirmed" ? "ok" : "warn"}>{f.status === "confirmed" ? "Confirmada" : "Por confirmar"}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!d.delivery && <DeliveryOffNote />}
        </div>
      </div>
    </>
  );
}
