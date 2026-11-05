import Link from "next/link";
import { asc } from "drizzle-orm";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import c from "@/components/admin/AdminV3.module.css";
import {
  ClientCardForms,
  ImportClientsButton,
  NotifyUpsButton,
} from "@/components/admin/ClientsForms";
import d3 from "@/components/admin/Dashboard.module.css";
import mob from "@/components/admin/Mobile.module.css";
import { DemoTag, PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import type { LoyaltyLevel } from "@/data/help";
import { BAR_POINTS } from "@/lib/loyalty";
import { formatMsisdn, maskMsisdn } from "@/lib/payments/msisdn";
import { toMaputo } from "@/lib/time";
import {
  clientHistory,
  listClients,
  originText,
  reviewForecast,
} from "@/server/admin/customers";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { currentYear } from "@/server/loyalty";
import { accessOf, canEdit, requireStaffPage } from "@/server/staff/access";
import { loyaltyLevels } from "@/server/loyalty";

export const metadata = { title: "Clientes" };

type Props = {
  searchParams: Promise<{ q?: string; nivel?: string; c?: string }>;
};

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const day = (d: Date) => {
  const [y, m, dd] = toMaputo(d).date.split("-");
  return `${Number(dd)} ${MONTHS[Number(m) - 1]} ${y}`;
};
const initials = (name: string) =>
  name
    .replace(/\[[^\]]*\]\s*/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function LevelBadge({
  level,
  children,
  size = 14,
}: {
  level: LoyaltyLevel;
  children?: React.ReactNode;
  size?: number;
}) {
  return (
    <span className={c.badge}>
      <span style={{ color: level.color, display: "inline-flex" }}>
        <Icon name={level.icon} size={size} />
      </span>
      {children ?? level.name.pt}
    </span>
  );
}

/**
 * EN: "Gestão · Clientes" of design V3: loyalty programme — the yearly review, the old store's import, the list (level
 *     and points of this year, origin, last purchase) and the customer's card (history, level by hand, store purchase,
 *     points adjustment).
 * PT: Clientes do V3: programa de fidelidade — revisão anual, importação da loja antiga, a lista (nível e pontos deste
 *     ano, origem, última compra) e a ficha da cliente (histórico, nível à mão, compra na loja, ajuste de pontos).
 */
export default async function ClientsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("customers");
  const p = await searchParams;
  const levels = await loyaltyLevels();
  const level = levels.some((l) => l.key === p.nivel) ? p.nivel : undefined;
  const db = await getDb();
  const [all, storeRows] = await Promise.all([
    listClients(),
    db
      .select({ code: stores.code, name: stores.name })
      .from(stores)
      .orderBy(asc(stores.position)),
  ]);
  const list = await listClients({ q: p.q, level });
  const current = list.find((x) => x.id === p.c) ?? list[0];
  const history = current ? await clientHistory(current) : [];
  const year = currentYear();
  const forecast = reviewForecast(all);
  const edit = canEdit(staff, "customers");
  const canExport = accessOf(staff, "customers.export") !== "—";
  const link = (patch: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.entries({ q: p.q, nivel: level, c: current?.id, ...patch }).filter((e): e is [string, string] => !!e[1]))}`;

  return (
    <>
      <div
        style={{ display: "contents" }}
        className={p.c ? mob.dOnly : undefined}
      >
        <PageTop
          eyebrow="Programa de fidelidade · Rubi, Safira, Pérola, Diamante"
          title="Clientes"
          actions={
            <>
              {canExport && (
                <Link
                  prefetch={false}
                  href="/gestao/clientes/exportar"
                  className={`${c.btn} ${c.sm}`}
                >
                  <Icon name="download" size={15} />
                  Exportar CSV
                </Link>
              )}
              <ImportClientsButton size="sm" disabled={!edit} />
            </>
          }
        />
        <DemoTag show={all.some((x) => x.isDemo)} />

        <div className={c.note}>
          <Icon name="calendar" size={18} />
          <span>
            <b>Revisão anual a 1 de janeiro de {year + 1}</b> · previsão com as
            compras de {year}: {forecast.up.length}{" "}
            {forecast.up.length === 1 ? "sobe" : "sobem"}, {forecast.keep}{" "}
            {forecast.keep === 1 ? "mantém" : "mantêm"}, {forecast.down.length}{" "}
            {forecast.down.length === 1 ? "desce" : "descem"}.
          </span>
          <span className={c.noteActions}>
            {canExport && (
              <Link
                prefetch={false}
                href="/gestao/clientes/exportar?revisao=1"
                className={`${c.btn} ${c.xs}`}
              >
                Ver relatório
              </Link>
            )}
            <NotifyUpsButton disabled={!edit || forecast.up.length === 0} />
          </span>
        </div>

        <div className={c.note}>
          <Icon name="upload" size={18} />
          <span>
            <b>Clientes da loja antiga</b> · importe um Excel com nome,
            telefone, e-mail, nível e pontos do ano. Telefones repetidos
            juntam-se à mesma ficha.
          </span>
          <span className={c.noteActions}>
            <Link
              prefetch={false}
              href="/gestao/clientes/modelo"
              className={`${c.btn} ${c.xs}`}
            >
              <Icon name="download" size={13} />
              Modelo Excel
            </Link>
            <ImportClientsButton primary size="xs" disabled={!edit} />
          </span>
        </div>
      </div>

      {/* EN: Phone (V3-M-G-Clientes / V3-M-G-Cliente): the list, or the chosen card on its own screen.
          PT: Telemóvel: a lista, ou a ficha escolhida num ecrã só seu. */}
      <div className={c.cols}>
        <section className={`${d3.panel} ${p.c ? mob.dOnly : ""}`}>
          <div className={d3.panelHead}>
            <h2>Clientes</h2>
          </div>
          <div className={d3.panelBody}>
            <form className={c.filters} role="search">
              <label className={d3.search}>
                <Icon name="search" size={16} />
                <input
                  type="search"
                  name="q"
                  defaultValue={p.q}
                  placeholder="Nome, telefone ou e-mail"
                  aria-label="Nome, telefone ou e-mail"
                />
              </label>
              <AutoSubmitSelect
                className={c.select}
                name="nivel"
                defaultValue={level ?? ""}
                aria-label="Nível"
              >
                <option value="">Todos os níveis</option>
                {levels.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.name.pt}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            {list.length === 0 ? (
              <p className={d3.empty}>
                {all.length === 0
                  ? "Ainda não há clientes. Importe as clientes da loja antiga ou espere pelas primeiras contas do site."
                  : "Nenhuma cliente encontrada."}
              </p>
            ) : (
              <table className={`${d3.table} ${c.table}`}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Nível {year}</th>
                    <th>Pontos {year}</th>
                    <th>Origem</th>
                    <th>Última compra</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((x) => {
                    const on = x.id === current?.id;
                    return (
                      <tr key={x.id} className={on ? c.hl : undefined}>
                        <td>
                          <span className={c.who}>
                            <b>{x.name}</b>
                            <span className={c.xsMuted}>
                              {x.phone
                                ? `+258 ${on ? formatMsisdn(x.phone) : maskMsisdn(x.phone)}`
                                : (x.email ?? "—")}
                            </span>
                          </span>
                        </td>
                        <td>
                          <LevelBadge level={x.level} />
                        </td>
                        <td>
                          <b className={`${d3.strong} ${c.num}`}>
                            {x.year.points}
                          </b>
                        </td>
                        <td>
                          <span className={c.xsMuted}>{originText(x)}</span>
                        </td>
                        <td>{x.lastPurchase ? day(x.lastPurchase) : "—"}</td>
                        <td>
                          <Link
                            href={link({ c: x.id })}
                            className={d3.textBtn}
                            aria-current={on ? "true" : undefined}
                          >
                            Ver ficha
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {current && (
          <section className={`${d3.panel} ${p.c ? "" : mob.dOnly}`}>
            <div className={d3.panelHead}>
              <Link
                href={link({ c: undefined })}
                className={`${d3.textBtn} ${mob.mOnly}`}
                style={{ alignItems: "center", gap: 6 }}
              >
                <Icon name="chevronLeft" size={14} />
                Clientes
              </Link>
              <h2>Ficha da cliente</h2>
            </div>
            <div className={c.ficha}>
              <div className={c.person}>
                <span className={c.av}>{initials(current.name)}</span>
                <span>
                  <span className={c.name}>{current.name}</span>
                  <br />
                  <span className={c.xsMuted}>
                    {[
                      `Cliente desde ${toMaputo(current.since).date.slice(0, 4)}`,
                      current.email,
                      current.phone
                        ? `+258 ${formatMsisdn(current.phone)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </div>

              <div className={c.levelBox}>
                <div className={c.levelLine}>
                  <LevelBadge level={current.level}>
                    {current.level.name.pt} · {current.level.pct}% em {year}
                  </LevelBadge>
                  <span className={c.num}>
                    <b>{current.year.points}</b> pontos em {year}
                  </span>
                </div>
                <div className={c.bar} aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((current.year.points / BAR_POINTS) * 100))}%`,
                    }}
                  />
                </div>
                <span className={c.xsMuted}>
                  {(() => {
                    const up = levels.find((l) => l.min > current.year.points);
                    const head = up
                      ? `Faltam ${up.min - current.year.points} pontos para ${up.name.pt} em ${year + 1}`
                      : `Diamante em ${year + 1}`;
                    return [
                      head,
                      `${current.year.online} online`,
                      `${current.year.store} na loja`,
                      current.year.other
                        ? `${current.year.other > 0 ? "+" : ""}${current.year.other} outros`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                  })()}
                </span>
                {current.levelSetByHand && current.levelReason && (
                  <span className={c.xsMuted}>
                    Nível definido à mão · {current.levelReason}
                  </span>
                )}
              </div>

              <div>
                <span className={c.label}>Histórico</span>
                <table className={c.hist}>
                  <thead>
                    <tr>
                      <th>Ano</th>
                      <th className={c.r}>Pontos</th>
                      <th>Nível no ano seguinte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.year}>
                        <td>{h.year}</td>
                        <td className={`${c.r} ${c.num}`}>
                          {h.current ? `${h.points} (até hoje)` : h.points}
                        </td>
                        <td>
                          {h.current
                            ? `${h.next.name.pt} (se mantiver)`
                            : `${h.next.name.pt} · ${h.year + 1}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ClientCardForms
                key={current.id}
                id={current.id}
                level={current.level.key}
                reason={current.levelReason}
                levels={levels.map((l) => ({
                  key: l.key,
                  label: `${l.name.pt} · ${l.pct}%`,
                }))}
                stores={storeRows.map((x) => ({
                  code: x.code,
                  name: `Loja ${Number(x.code)}`,
                }))}
                canEdit={edit}
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
