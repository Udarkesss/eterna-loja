import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { formatMsisdn, maskMsisdn } from "@/lib/payments/msisdn";
import { addDays, todayMaputo } from "@/lib/time";
import { listCustomersFor } from "@/server/admin/customers";
import { FULFILLMENT_LABEL, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { accessOf, requireStaffPage } from "@/server/staff/access";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/types";

export const metadata = { title: "Clientes" };

type Props = { searchParams: Promise<{ q?: string; c?: string; estado?: string; periodo?: string; de?: string; ate?: string }> };

const PERIODS: Record<string, { label: string; days: number | null }> = {
  "30": { label: "Últimos 30 dias", days: 30 },
  hoje: { label: "Hoje", days: 0 },
  "7": { label: "Últimos 7 dias", days: 7 },
  ano: { label: "Este ano", days: 365 },
  tudo: { label: "Desde sempre", days: null },
};

/**
 * EN: "Gestão · 2 Encomendas por cliente". Staff with "E" access (drivers) would only see delivery data — they have
 *     no menu entry here. Phone numbers are masked except for the selected customer.
 * PT: "Encomendas por cliente". Os números aparecem mascarados, excepto o da cliente seleccionada.
 */
export default async function CustomersPage({ searchParams }: Props) {
  const staff = await requireStaffPage("customers");
  const p = await searchParams;
  const period = PERIODS[p.periodo ?? "tudo"] ? (p.periodo ?? "tudo") : "tudo";
  const days = PERIODS[period].days;
  const from = p.de || (days === null ? undefined : addDays(todayMaputo(), -days));
  const list = await listCustomersFor(staff, { q: p.q, from, to: p.ate });
  const current = list.find((c) => c.key === p.c) ?? list[0];
  const status = PAYMENT_STATUSES.includes(p.estado as PaymentStatus) ? (p.estado as PaymentStatus) : null;
  const orders = current ? current.orders.filter((o) => !status || o.order.paymentStatus === status) : [];
  const orderCount = list.reduce((n, c) => n + c.orders.length, 0);
  const link = (key: string) => `?${new URLSearchParams({ ...(p.q ? { q: p.q } : {}), ...(p.estado ? { estado: p.estado } : {}), periodo: period, c: key })}`;

  return (
    <>
      <PageTop
        eyebrow={`${list.length} ${list.length === 1 ? "cliente" : "clientes"} · ${orderCount} ${orderCount === 1 ? "encomenda" : "encomendas"}`}
        title={
          <>
            Encomendas <em>por cliente</em>
          </>
        }
        actions={
          accessOf(staff, "customers.export") !== "—" && (
            <a href={`/gestao/clientes/exportar?periodo=${period}`} className={s.btnOutline}>
              Exportar CSV
            </a>
          )
        }
      />
      <DemoTag show={list.some((c) => c.isDemo)} />

      <form className={s.filters}>
        <label className={s.label} style={{ flex: "1 1 260px" }}>
          Procurar cliente
          <input className={s.input} type="search" name="q" defaultValue={p.q} placeholder="Nome, telefone ou nº de encomenda" />
        </label>
        <label className={s.label}>
          Estado
          <select className={s.select} name="estado" defaultValue={status ?? "todos"}>
            <option value="todos">Todos</option>
            {PAYMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {PAYMENT_LABEL[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.label}>
          Data
          <select className={s.select} name="periodo" defaultValue={period}>
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={s.btn}>
          Filtrar
        </button>
      </form>

      <div className={s.splitNarrow}>
        <section className={s.cardFlush}>
          {list.length === 0 ? (
            <p className={s.empty}>Nenhum cliente encontrado. Tente o número sem espaços.</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Encom.</th>
                  <th>Total gasto</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const on = c.key === current?.key;
                  return (
                    <tr key={c.key} style={on ? { background: "var(--blush-light)" } : undefined}>
                      <td>
                        <Link href={link(c.key)} className={s.two} aria-current={on ? "true" : undefined}>
                          <span className={on ? s.strong : undefined}>{c.name}</span>
                          <span className={s.muted}>{c.phone ? `+258 ${maskMsisdn(c.phone)}` : c.email ?? "—"}</span>
                        </Link>
                      </td>
                      <td>{c.orders.length}</td>
                      <td className={s.num}>{mzn(c.totalPaid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {current && (
          <section className={s.cardFlush}>
            <div className={s.cardHead}>
              <div className={s.two}>
                <span className={s.muted}>
                  Cliente desde {current.since.getFullYear()} · {current.hasAccount ? "com conta" : "sem conta"}
                </span>
                <h2 className={s.h2}>{current.name}</h2>
                <span className={s.muted}>
                  {[current.phone ? `+258 ${formatMsisdn(current.phone)}` : null, current.email].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <span className={s.two}>
                  <span className={s.statLabel}>Encomendas</span>
                  <span className={s.statValue} style={{ fontSize: 28 }}>
                    {current.orders.length}
                  </span>
                </span>
                <span className={s.two}>
                  <span className={s.statLabel}>Total gasto</span>
                  <span className={s.statValue} style={{ fontSize: 28 }}>
                    {mzn(current.totalPaid)}
                  </span>
                </span>
              </div>
            </div>
            {orders.length === 0 ? (
              <p className={s.empty}>Este cliente não tem encomendas com este estado.</p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Encomenda</th>
                    <th>Peças</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>Entrega</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map(({ order: o, lines }) => (
                    <tr key={o.id}>
                      <td>
                        <span className={s.two}>
                          <span className={s.strong}>{o.number}</span>
                          <span className={s.muted}>{when(o.createdAt)}</span>
                        </span>
                      </td>
                      <td className={s.muted}>{lines.map((l) => l.code).join(", ")}</td>
                      <td className={s.num}>{mzn(o.total)}</td>
                      <td>
                        <span className={s.two}>
                          <Chip tone={PAYMENT_LABEL[o.paymentStatus].tone}>{PAYMENT_LABEL[o.paymentStatus].label}</Chip>
                          <span className={s.muted}>{METHOD_LABEL[o.paymentMethod]}</span>
                        </span>
                      </td>
                      <td className={s.muted}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</td>
                      <td>
                        <Link href={`/gestao/encomendas/${o.id}`} className={s.a}>
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </>
  );
}
