import Image from "next/image";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import c from "@/components/admin/AdminV3.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import { NewStoreReservation, ReservationActions } from "@/components/admin/ReservationsForms";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatMZN } from "@/lib/format";
import { customersForReservation, listAdminReservations, piecesInStock, RESERVATION_VIEWS, type ReservationView } from "@/server/admin/reservations";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { isBridalStore } from "@/server/reservations";
import { canEdit, requireStaffPage, storeScope } from "@/server/staff/access";

export const metadata = { title: "Reservas" };

type Props = { searchParams: Promise<{ q?: string; vista?: string; loja?: string; origem?: string }> };

/**
 * EN: "Gestão · Reservas" of design V3 (online and in the store). PT: Reservas do V3 (online e na loja).
 */
export default async function ReservationsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("reservations");
  const p = await searchParams;
  const view: ReservationView = p.vista && p.vista in RESERVATION_VIEWS ? (p.vista as ReservationView) : "todas";
  const db = await getDb();
  const scope = storeScope(staff, "reservations");
  const [{ list, counts, kpis, settings }, storeRows, pieces, people] = await Promise.all([
    listAdminReservations(staff, { q: p.q, view, store: p.loja, origin: p.origem }),
    db.select().from(stores).orderBy(asc(stores.position)),
    piecesInStock(),
    customersForReservation(),
  ]);
  const myStores = storeRows.filter((s) => !scope || scope.includes(s.id));
  const edit = canEdit(staff, "reservations");
  const link = (patch: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.entries({ q: p.q, vista: p.vista, loja: p.loja, origem: p.origem, ...patch }).filter((e): e is [string, string] => !!e[1]))}`;

  return (
    <>
      <PageTop
        eyebrow="Online e na loja"
        title="Reservas"
        actions={
          <NewStoreReservation
            pieces={pieces.filter((x) => myStores.some((s) => s.code === x.storeCode))}
            people={people}
            stores={myStores.map((s) => ({ code: s.code, days: isBridalStore(s.code) ? settings.bridalDays : settings.days }))}
            depositPct={settings.depositPct}
            remindDays={settings.remindDays}
            disabled={!edit}
          />
        }
      />

      <div className={d3.kpis}>
        <div className={d3.kpi}>
          <span className={`${d3.kpiLabel} ${d3.muted}`}>Activas</span>
          <b>{kpis.active}</b>
          <span className={d3.kpiSub}>{kpis.activeStores || "Nenhuma reserva activa"}</span>
        </div>
        <div className={d3.kpi}>
          <span className={`${d3.kpiLabel} ${d3.muted}`}>A terminar ({settings.remindDays} dias)</span>
          <b style={{ color: "var(--warning)" }}>{kpis.ending}</b>
          <span className={d3.kpiSub}>Avise as clientes por WhatsApp</span>
        </div>
        <div className={d3.kpi}>
          <span className={`${d3.kpiLabel} ${d3.muted}`}>Sinais recebidos · {kpis.monthName}</span>
          <b style={{ color: "var(--success)" }}>{formatMZN(kpis.deposits, "pt")}</b>
          <span className={d3.kpiSub}>Descontam no preço final</span>
        </div>
        <div className={d3.kpi}>
          <span className={`${d3.kpiLabel} ${d3.muted}`}>Expiradas · {kpis.monthName}</span>
          <b style={{ color: "var(--danger)" }}>{kpis.expired}</b>
          <span className={d3.kpiSub}>Peças voltaram à venda</span>
        </div>
      </div>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Reservas</h2>
          <span className={c.row} style={{ gap: 16 }}>
            <span className={c.xsMuted} style={{ fontSize: 14 }}>
              Sinal: {settings.depositPct}% · {settings.days} dias · vestidos de noiva e Bridal {settings.bridalDays} dias
            </span>
            <Link href="/gestao/definicoes" className={d3.ulink}>
              Regras
            </Link>
          </span>
        </div>
        <div className={d3.panelBody}>
          <nav className={d3.tabs} aria-label="Estado">
            {(Object.keys(RESERVATION_VIEWS) as ReservationView[]).map((v) => (
              <Link key={v} href={link({ vista: v === "todas" ? undefined : v })} aria-current={v === view ? "page" : undefined}>
                {RESERVATION_VIEWS[v]}
                {(v === "todas" || v === "terminar") && counts[v] > 0 && <span className={d3.count}>{counts[v]}</span>}
              </Link>
            ))}
          </nav>
          <form className={d3.filterRow} role="search">
            {p.vista && <input type="hidden" name="vista" value={p.vista} />}
            <label className={d3.search}>
              <Icon name="search" size={16} />
              <input type="search" name="q" defaultValue={p.q} placeholder="Reserva, cliente, telefone ou código da peça" aria-label="Procurar reservas" />
            </label>
            <AutoSubmitSelect className={c.select} name="loja" defaultValue={p.loja ?? ""} aria-label="Loja" style={{ width: 170 }}>
              <option value="">Todas as lojas</option>
              {myStores.map((s) => (
                <option key={s.code} value={s.code}>
                  Loja {Number(s.code)}
                  {isBridalStore(s.code) ? " · Bridal" : ""}
                </option>
              ))}
            </AutoSubmitSelect>
            <AutoSubmitSelect className={c.select} name="origem" defaultValue={p.origem ?? ""} aria-label="Origem" style={{ width: 170 }}>
              <option value="">Online e na loja</option>
              <option value="online">Online</option>
              <option value="loja">Na loja</option>
            </AutoSubmitSelect>
          </form>

          {list.length === 0 ? (
            <p className={d3.empty}>{p.q ? "Nenhuma reserva encontrada." : view === "todas" ? "Ainda não há reservas." : `Nenhuma reserva em “${RESERVATION_VIEWS[view]}”.`}</p>
          ) : (
            <table className={d3.table}>
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Cliente</th>
                  <th>Peça</th>
                  <th>Loja</th>
                  <th>Pago / falta</th>
                  <th>Prazo</th>
                  <th>Estado</th>
                  <th>Acções</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={r.open && r.tone !== "ok" ? c.hl : undefined}>
                    <td>
                      <span className={c.who}>
                        <b>{r.number}</b>
                        <span className={c.xsMuted}>{r.origin}</span>
                      </span>
                    </td>
                    <td>
                      <span className={c.who}>
                        <span>{r.customer}</span>
                        <span className={c.xsMuted}>{r.phone ? `+258 ${r.phone.slice(0, 2)} ${r.phone.slice(2, 5)} ${r.phone.slice(5)}` : "—"}</span>
                      </span>
                    </td>
                    <td>
                      <span className={c.row} style={{ gap: 12 }}>
                        {r.image ? <Image src={r.image} alt="" width={40} height={52} style={{ objectFit: "cover" }} /> : null}
                        <span className={c.who}>
                          <b>{r.code}</b>
                          <span className={c.xsMuted}>{r.desc}</span>
                        </span>
                      </span>
                    </td>
                    <td>{r.store}</td>
                    <td>
                      <span className={c.who}>
                        <span className={c.num}>{r.paid} MT</span>
                        <span className={c.xsMuted}>falta {r.due}{r.due !== "—" ? " MT" : ""}</span>
                      </span>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      <span className={c.small}>{r.until}</span>
                      <span className={c.miniBar} data-tone={r.tone === "ok" ? undefined : r.tone} style={{ margin: "6px 0 4px" }}>
                        <span style={{ width: `${r.pct}%` }} />
                      </span>
                      <span className={c.xsMuted} style={{ color: `var(--${r.tone === "ok" ? "success" : r.tone === "warn" ? "warning" : "danger"})` }}>
                        {r.left}
                      </span>
                    </td>
                    <td>
                      <span className={c.st} data-tone={r.stateTone === "neutral" ? undefined : r.stateTone}>
                        {r.state}
                      </span>
                      {r.extra && <span className={c.xsMuted} style={{ display: "block", marginTop: 4 }}>{r.extra}</span>}
                    </td>
                    <td>
                      {r.open ? (
                        <ReservationActions
                          id={r.id}
                          number={r.number}
                          code={r.code}
                          customer={r.customer}
                          remindHref={r.remindHref}
                          canExtend={r.canExtend}
                          expiresAt={r.expiresAt}
                          extendTo={r.extendTo}
                          disabled={!edit}
                        />
                      ) : (
                        <Link href={`/gestao/produtos?q=${encodeURIComponent(r.code)}`} className={`${c.btn} ${c.xs}`}>
                          Ver peça
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
