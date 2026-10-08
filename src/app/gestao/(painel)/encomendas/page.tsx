import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Chip, DemoTag, mzn, PageTop, when } from "@/components/admin/ui";
import { FULFILLMENT_LABEL, listOrdersFor, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { requireStaffPage } from "@/server/staff/access";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/types";

export const metadata = { title: "Encomendas" };

type Props = { searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string; pagina?: string }> };
const PAGE = 25;

/**
 * EN: All orders the person may see, with search and filters (number, name, phone, status, dates).
 * PT: Todas as encomendas visíveis, com pesquisa e filtros.
 */
export default async function OrdersPage({ searchParams }: Props) {
  const staff = await requireStaffPage("orders.view");
  const p = await searchParams;
  const status = PAYMENT_STATUSES.includes(p.estado as PaymentStatus) ? (p.estado as PaymentStatus) : "all";
  const rows = await listOrdersFor(staff, { q: p.q, status, from: p.de, to: p.ate });
  const page = Math.max(1, Number(p.pagina) || 1);
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);
  const qs = (n: number) => `?${new URLSearchParams({ ...(p.q ? { q: p.q } : {}), ...(p.estado ? { estado: p.estado } : {}), ...(p.de ? { de: p.de } : {}), ...(p.ate ? { ate: p.ate } : {}), pagina: String(n) })}`;

  return (
    <>
      <PageTop
        eyebrow={`${rows.length} ${rows.length === 1 ? "encomenda" : "encomendas"}`}
        title="Encomendas"
        actions={
          <Link href="/gestao/clientes" className={s.btnOutline}>
            Ver por cliente
          </Link>
        }
      />
      <DemoTag show={rows.some((r) => r.order.isDemo)} />

      <form className={s.filters}>
        <label className={s.label} style={{ flex: "1 1 280px" }}>
          Procurar
          <input className={s.input} type="search" name="q" defaultValue={p.q} placeholder="Nº de encomenda, nome ou telefone" />
        </label>
        <label className={s.label}>
          Pagamento
          <select className={s.select} name="estado" defaultValue={status}>
            <option value="all">Todos</option>
            {PAYMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {PAYMENT_LABEL[st].label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.label}>
          De
          <input className={s.input} type="date" name="de" defaultValue={p.de} />
        </label>
        <label className={s.label}>
          Até
          <input className={s.input} type="date" name="ate" defaultValue={p.ate} />
        </label>
        <button type="submit" className={s.btn}>
          Filtrar
        </button>
      </form>

      <section className={s.cardFlush}>
        {visible.length === 0 ? (
          <p className={s.empty}>Nenhuma encomenda com estes filtros.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Encomenda</th>
                <th>Cliente</th>
                <th>Peças</th>
                <th>Total</th>
                <th>Pagamento</th>
                <th>Entrega</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ order: o, lines }) => (
                <tr key={o.id}>
                  <td>
                    <span className={s.two}>
                      <Link href={`/gestao/encomendas/${o.id}`} className={s.a}>
                        {o.number}
                      </Link>
                      <span className={s.muted}>{when(o.createdAt)}</span>
                    </span>
                  </td>
                  <td>{o.contact.name}</td>
                  <td className={s.muted}>{lines.map((l) => l.code).join(", ")}</td>
                  <td className={s.num}>{mzn(o.total)}</td>
                  <td>
                    <span className={s.two}>
                      <Chip tone={PAYMENT_LABEL[o.paymentStatus].tone}>{PAYMENT_LABEL[o.paymentStatus].label}</Chip>
                      <span className={s.muted}>
                        {METHOD_LABEL[o.paymentMethod]}
                        {o.paymentMethod === "transfer" && o.paymentStatus === "pending" ? (o.transferProofUrl ? " · a validar" : " · sem comprovativo") : ""}
                      </span>
                    </span>
                  </td>
                  <td className={s.muted}>
                    {o.fulfillmentType === "pickup" ? "Levantamento" : "Entrega"} · {FULFILLMENT_LABEL[o.fulfillmentStatus]}
                  </td>
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
        <div className={s.pager}>
          <span>
            A mostrar {rows.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(page * PAGE, rows.length)} de {rows.length}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            {page > 1 && (
              <Link href={qs(page - 1)} className={`${s.btnOutline} ${s.small}`}>
                Anterior
              </Link>
            )}
            {page * PAGE < rows.length && (
              <Link href={qs(page + 1)} className={`${s.btnOutline} ${s.small}`}>
                Seguinte
              </Link>
            )}
          </span>
        </div>
      </section>
    </>
  );
}
