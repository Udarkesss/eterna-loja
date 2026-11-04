import Image from "next/image";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import { MarkReadyButton } from "@/components/admin/MarkReadyButton";
import { DeliveryOffNote } from "@/components/admin/ModuleOffNote";
import { Chip, mzn, PageTop, when } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { deliveryEnabled } from "@/server/content";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { FULFILLMENT_LABEL, listOrdersFor, METHOD_LABEL, ORDER_VIEWS, orderView, PAYMENT_LABEL, type OrderView } from "@/server/admin/orders";
import { can, requireStaffPage } from "@/server/staff/access";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types";

export const metadata = { title: "Encomendas" };

type Props = { searchParams: Promise<{ q?: string; vista?: string; loja?: string; metodo?: string; pagina?: string }> };
const PAGE = 25;

/**
 * EN: "Gestão · Encomendas" of design V3: tabs by state (Por preparar, Prontas a levantar, Levantadas, A aguardar
 *     pagamento, Canceladas), search, store and payment filters, pieces as thumbnails, "Marcar pronta" and CSV export.
 * PT: Encomendas do V3: separadores por estado, pesquisa, filtros de loja e pagamento, peças em miniatura, "Marcar
 *     pronta" e exportar CSV.
 */
export default async function OrdersPage({ searchParams }: Props) {
  const staff = await requireStaffPage("orders.view");
  const p = await searchParams;
  const view: OrderView = p.vista && p.vista in ORDER_VIEWS ? (p.vista as OrderView) : p.q ? "preparar" : "preparar";
  const method = PAYMENT_METHODS.includes(p.metodo as PaymentMethod) ? (p.metodo as PaymentMethod) : undefined;
  const db = await getDb();
  const [all, storeRows, delivery] = await Promise.all([listOrdersFor(staff, { q: p.q }), db.select().from(stores), deliveryEnabled()]);
  const storeOf = (id: string | null) => storeRows.find((x) => x.id === id);
  const filtered = all
    .filter((r) => !p.loja || storeOf(r.order.pickupStoreId ?? null)?.code === p.loja)
    .filter((r) => !method || r.order.paymentMethod === method);
  const counts = Object.fromEntries(Object.keys(ORDER_VIEWS).map((v) => [v, filtered.filter((r) => orderView(r.order) === v).length])) as Record<OrderView, number>;
  // EN: A search shows matches in every tab. PT: Uma pesquisa mostra resultados de todos os separadores.
  const rows = p.q ? filtered : filtered.filter((r) => orderView(r.order) === view);
  const page = Math.max(1, Number(p.pagina) || 1);
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);
  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ q: p.q, vista: p.vista, loja: p.loja, metodo: p.metodo, ...patch }).filter((e): e is [string, string] => !!e[1]));
    return `?${q}`;
  };
  const canEdit = can(staff, "orders.edit");

  return (
    <>
      <PageTop
        eyebrow={`${all.length} ${all.length === 1 ? "encomenda" : "encomendas"}${all.some((r) => r.order.isDemo) ? " · inclui dados de exemplo" : ""}`}
        title="Encomendas"
        actions={
          <Link href="/gestao/clientes" className={s.btnOutline}>
            Ver por cliente
          </Link>
        }
      />
      {!delivery && <DeliveryOffNote />}

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Encomendas</h2>
          <Link href="/gestao/encomendas/exportar" className={`${s.btnOutline} ${s.small}`}>
            <Icon name="download" size={15} />
            Exportar CSV
          </Link>
        </div>
        <div className={d3.panelBody}>
          {!p.q && (
            <nav className={d3.tabs} aria-label="Estado">
              {(Object.keys(ORDER_VIEWS) as OrderView[]).map((v) => (
                <Link key={v} href={link({ vista: v, pagina: undefined })} aria-current={v === view ? "page" : undefined}>
                  {ORDER_VIEWS[v]}
                  {(v === "preparar" || v === "prontas") && counts[v] > 0 && <span className={d3.count}>{counts[v]}</span>}
                </Link>
              ))}
            </nav>
          )}
          <form className={d3.filterRow}>
            {p.vista && <input type="hidden" name="vista" value={p.vista} />}
            <label className={d3.search}>
              <Icon name="search" size={16} />
              <input type="search" name="q" defaultValue={p.q} placeholder="N.º de encomenda, nome ou telefone" aria-label="Procurar" />
            </label>
            <select className={s.select} name="loja" defaultValue={p.loja ?? ""} aria-label="Loja">
              <option value="">Todas as lojas</option>
              {storeRows.map((x) => (
                <option key={x.id} value={x.code}>
                  Loja {x.code}
                </option>
              ))}
            </select>
            <select className={s.select} name="metodo" defaultValue={method ?? ""} aria-label="Pagamento">
              <option value="">Qualquer pagamento</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            <button type="submit" className={`${s.btnOutline} ${s.small}`}>
              Filtrar
            </button>
          </form>

          {visible.length === 0 ? (
            <p className={d3.empty}>{p.q ? "Nenhuma encomenda encontrada." : `Nenhuma encomenda em “${ORDER_VIEWS[view]}”.`}</p>
          ) : (
            <table className={d3.table}>
              <thead>
                <tr>
                  <th>Encomenda</th>
                  <th>Cliente</th>
                  <th>Peças</th>
                  <th className={d3.right}>Total</th>
                  <th>Pagamento</th>
                  <th>Entrega</th>
                  <th>Acções</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ order: o, lines }) => {
                  const store = storeOf(o.pickupStoreId ?? null);
                  const transfer = o.paymentMethod === "transfer" && o.paymentStatus === "pending" ? (o.transferProofUrl ? " · a validar" : " · sem comprovativo") : "";
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/gestao/encomendas/${o.id}`} className={d3.strong}>
                          {o.number}
                        </Link>
                        <span className={d3.muted}>{when(o.createdAt)}</span>
                      </td>
                      <td>
                        {o.contact.name}
                        <span className={d3.muted}>{o.contact.phone ? `+258 ${o.contact.phone}` : o.contact.email ?? ""}</span>
                      </td>
                      <td>
                        <span className={d3.thumbs}>
                          {lines.slice(0, 3).map((l, i) =>
                            l.imageUrl ? <Image key={i} src={l.imageUrl} alt={l.code} width={34} height={44} /> : <span key={i}>{l.code}</span>,
                          )}
                        </span>
                      </td>
                      <td className={`${s.num} ${d3.right}`}>{mzn(o.total)}</td>
                      <td>
                        <Chip tone={transfer ? "warn" : PAYMENT_LABEL[o.paymentStatus].tone}>
                          {o.paymentStatus === "paid" ? "Paga" : PAYMENT_LABEL[o.paymentStatus].label} · {METHOD_LABEL[o.paymentMethod]}
                          {transfer}
                        </Chip>
                      </td>
                      <td>
                        <Chip tone="">
                          <Icon name={o.fulfillmentType === "pickup" ? "store" : "truck"} size={14} />
                          {o.fulfillmentType === "pickup" ? `Levantamento · Loja ${store?.code ?? ""}` : `Entrega · ${FULFILLMENT_LABEL[o.fulfillmentStatus]}`}
                        </Chip>
                      </td>
                      <td>
                        <span className={d3.actions}>
                          {canEdit && o.paymentStatus === "paid" && o.fulfillmentType === "pickup" && o.fulfillmentStatus === "pending" && <MarkReadyButton id={o.id} />}
                          <Link href={`/gestao/encomendas/${o.id}`} className={d3.textBtn}>
                            Detalhes
                          </Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className={d3.foot}>
            <span>
              {p.q
                ? `${rows.length} ${rows.length === 1 ? "encomenda encontrada" : "encomendas encontradas"}`
                : `${rows.length} ${rows.length === 1 ? "encomenda" : "encomendas"} · ${ORDER_VIEWS[view].toLowerCase()}`}
            </span>
            <span>“Marcar pronta” envia o aviso de levantamento por WhatsApp.</span>
          </div>
          {rows.length > PAGE && (
            <div className={s.pager}>
              <span>
                A mostrar {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} de {rows.length}
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                {page > 1 && (
                  <Link href={link({ pagina: String(page - 1) })} className={`${s.btnOutline} ${s.small}`}>
                    Anterior
                  </Link>
                )}
                {page * PAGE < rows.length && (
                  <Link href={link({ pagina: String(page + 1) })} className={`${s.btnOutline} ${s.small}`}>
                    Seguinte
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
