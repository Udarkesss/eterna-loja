import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { formatLongDate, toMaputo } from "@/lib/time";
import type { FittingKind } from "@/types";
import { dashboardFor } from "@/server/admin/dashboard";
import { FULFILLMENT_LABEL, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { can, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Painel" };

/** EN: "Gestão · 1 Painel". PT: Painel do dia. */
export default async function DashboardPage() {
  const staff = await requireStaffPage("dashboard");
  const d = await dashboardFor(staff);
  const hour = toMaputo(new Date()).time.slice(0, 2);
  const greeting = Number(hour) < 12 ? "Bom dia" : Number(hour) < 19 ? "Boa tarde" : "Boa noite";
  const date = formatLongDate(d.today, "pt");
  const hasDemo = d.recent.some((r) => r.order.isDemo) || d.fittingsToday.some((f) => f.isDemo);

  return (
    <>
      <PageTop
        eyebrow={date.charAt(0).toUpperCase() + date.slice(1)}
        title={
          <>
            {greeting}. <em>Hoje</em> na Eterna
          </>
        }
        actions={
          <>
            <form action="/gestao/encomendas" style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 12, color: "var(--ink-muted)", display: "flex" }}>
                <Icon name="search" size={18} />
              </span>
              <input name="q" type="search" aria-label="Pesquisar" placeholder="Procurar encomendas e clientes" className={s.input} style={{ width: 320, paddingLeft: 40 }} />
            </form>
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

      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Vendas de hoje</span>
          <span className={s.statValue}>{mzn(d.salesToday).replace(",00", "")}</span>
          <span className={s.statSub}>
            {d.paidTodayCount} {d.paidTodayCount === 1 ? "encomenda paga" : "encomendas pagas"}
          </span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Pagamentos pendentes</span>
          <span className={s.statValue} style={{ color: d.pendingCount ? "var(--warning)" : undefined }}>
            {d.pendingCount}
          </span>
          <span className={s.statSub}>{d.pendingHint}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Provas marcadas</span>
          <span className={s.statValue}>{d.fittingsTodayCount}</span>
          <span className={s.statSub}>{d.fittingsPerStore}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Métodos esta semana</span>
          <div className={s.bar} aria-hidden="true">
            {d.methods.map((m, i) => (
              <span key={m.label} style={{ width: `${m.pct}%`, background: ["#1C1917", "#C8A97E", "#8E9A86", "#E9D8CF", "#7A5C34", "#6B5E57"][i] }} />
            ))}
          </div>
          <span className={s.statSub}>{d.methods.length ? d.methods.map((m) => `${m.label} ${m.pct}%`).join(" · ") : "Sem vendas esta semana"}</span>
        </div>
      </div>

      <div className={s.split}>
        <section className={s.cardFlush}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>Encomendas recentes</h2>
            <Link href="/gestao/encomendas" className={s.a}>
              Ver todas
            </Link>
          </div>
          {d.recent.length === 0 ? (
            <p className={s.empty}>Ainda não há encomendas.</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Encomenda</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map(({ order: o, lines }) => (
                  <tr key={o.id}>
                    <td>
                      <span className={s.two}>
                        <Link href={`/gestao/encomendas/${o.id}`} className={s.a}>
                          {o.number}
                        </Link>
                        <span className={s.muted}>{when(o.createdAt)}</span>
                      </span>
                    </td>
                    <td>
                      <span className={s.two}>
                        <span>{o.contact.name}</span>
                        <span className={s.muted}>{lines.map((l) => l.code).join(", ")}</span>
                      </span>
                    </td>
                    <td className={s.num}>{mzn(o.total)}</td>
                    <td>
                      <span className={s.two}>
                        <Chip tone={PAYMENT_LABEL[o.paymentStatus].tone}>{PAYMENT_LABEL[o.paymentStatus].label}</Chip>
                        <span className={s.muted}>{METHOD_LABEL[o.paymentMethod]}</span>
                      </span>
                    </td>
                    <td className={s.muted}>
                      {o.fulfillmentType === "pickup" ? "Levantamento" : `Entrega · ${o.deliveryCity ?? ""}`}
                      <br />
                      {FULFILLMENT_LABEL[o.fulfillmentStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className={s.stack}>
          <section className={s.card}>
            <h2 className={s.h2}>Precisa da sua atenção</h2>
            {d.attention.length === 0 ? (
              <p className={s.muted}>Tudo em dia.</p>
            ) : (
              <ul className={s.list}>
                {d.attention.map((a, i) => (
                  <li key={i} className={s.listItem}>
                    <span style={{ color: a.tone === "bad" ? "var(--danger)" : "var(--warning)", display: "flex" }}>
                      <Icon name="alert" size={20} />
                    </span>
                    <span className={s.two}>
                      {a.href ? (
                        <Link href={a.href} className={s.strong}>
                          {a.title}
                        </Link>
                      ) : (
                        <span className={s.strong}>{a.title}</span>
                      )}
                      <span className={s.muted}>{a.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can(staff, "fittings") && (
            <section className={s.card}>
              <div className={s.cardHead}>
                <h2 className={s.h2}>Provas de hoje</h2>
                <Link href="/gestao/provas" className={s.a}>
                  Calendário
                </Link>
              </div>
              {d.fittingsToday.length === 0 ? (
                <p className={s.muted}>Sem provas hoje.</p>
              ) : (
                <ul className={s.list}>
                  {d.fittingsToday.map((f) => (
                    <li key={f.id} className={s.listItem}>
                      <span className={s.strong} style={{ minWidth: 48 }}>
                        {toMaputo(f.startsAt).time}
                      </span>
                      <span className={s.two}>
                        <Link href={`/gestao/provas?sel=${f.id}`} className={s.strong}>
                          {FITTING_KIND_LABELS[f.kind as FittingKind].pt}
                        </Link>
                        <span className={s.muted}>
                          Loja {f.storeCode} · {f.clientName}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
