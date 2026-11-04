import Image from "next/image";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { formatLongDate, toMaputo } from "@/lib/time";
import type { FittingKind } from "@/types";
import { dashboardFor } from "@/server/admin/dashboard";
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
          can(staff, "products.edit") && (
            <Link href="/gestao/produtos/novo" className={s.btn}>
              <Icon name="plus" size={16} />
              Novo produto
            </Link>
          )
        }
      />
      <DemoTag show={hasDemo} />

      <div className={d3.kpis}>
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
        <div className={d3.kpi}>
          <span className={d3.kpiLabel}>Pagamentos pendentes</span>
          <b className={d3.gold}>{d.pendingCount}</b>
          <span className={d3.kpiSub}>{d.pendingHint}</span>
        </div>
        <div className={d3.kpi}>
          <span className={d3.kpiLabel}>Provas esta semana</span>
          <b>{d.fittingsWeek}</b>
          <span className={d3.kpiSub}>{d.fittingRequests ? `${d.fittingRequests} ${d.fittingRequests === 1 ? "pedido" : "pedidos"} por responder` : "Nenhum pedido por responder"}</span>
        </div>
      </div>

      <div className={d3.grid}>
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

          {!d.delivery && (
            <div className={d3.deliveryOff}>
              <Icon name="truck" size={18} />
              <span>
                Módulo de entregas <strong>desligado</strong>: o site só oferece levantamento na loja. Liga-se em Definições → Módulo de
                entregas.
              </span>
              <Link href="/gestao/definicoes" className={d3.ulink}>
                Definições
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
