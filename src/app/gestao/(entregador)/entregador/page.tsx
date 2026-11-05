import Link from "next/link";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { formatMZN } from "@/lib/format";
import { addDays, formatLongDate, toMaputo, todayMaputo } from "@/lib/time";
import { driverDashboard, driverEarnings, paymentLine } from "@/server/delivery";
import { requireStaffPage } from "@/server/staff/access";

type Props = { searchParams: Promise<{ tab?: string }> };

const STATUS: Record<string, [string, string]> = {
  assigned: ["Atribuída", ""],
  in_transit: ["Em trânsito", "transit"],
  delivered: ["Entregue · a aguardar a cliente", "done"],
  confirmed: ["Confirmada", "done"],
};

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];
/** EN: "Hoje, 29 out." · "Ontem, 28 out." · "Seg., 27 out.". PT: Rótulo do dia. */
function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const today = todayMaputo();
  const base = `${d} ${SHORT[m - 1]}.`;
  if (date === today) return `Hoje, ${base}`;
  if (date === addDays(today, -1)) return `Ontem, ${base}`;
  return `${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${base}`;
}

/** EN: "Entregador · As minhas entregas". PT: As minhas entregas (só as atribuídas a mim). */
export default async function DriverHome({ searchParams }: Props) {
  const me = await requireStaffPage(undefined, { allowDriver: true });
  const tab = (await searchParams).tab === "historico" ? "historico" : (await searchParams).tab === "ganhos" ? "ganhos" : "hoje";
  const [d, earn] = await Promise.all([driverDashboard(me), tab === "ganhos" ? driverEarnings(me) : Promise.resolve(null)]);
  const date = formatLongDate(todayMaputo(), "pt");
  const first = me.name.replace(/^\[[^\]]*\]\s*/, "").split(" ")[0];
  const list = tab === "historico" ? d.history : d.active;

  return (
    <main className={s.body}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className={s.eyebrow}>{date.charAt(0).toUpperCase() + date.slice(1)}</span>
        <h1 className={s.h1}>Olá, {first}</h1>
      </div>

      {me.roleKey !== "entregador" && (
        <div className={s.notice} style={{ background: "var(--warning-soft)" }}>
          <span>
            <strong>Pré-visualização</strong>
            Esta é a área dos entregadores. Aqui só aparecem as entregas atribuídas a quem tem sessão iniciada.
          </span>
        </div>
      )}

      {d.newest && (
        <Link href={`/gestao/entregador/${d.newest.id}`} className={s.notice}>
          <span style={{ color: "var(--success)", display: "flex" }}>
            <Icon name="whatsappFull" size={22} />
          </span>
          <span>
            <strong>Nova entrega atribuída · {d.newest.number}</strong>
            Toque para ver os detalhes.
          </span>
        </Link>
      )}

      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Hoje</span>
          <span className={s.statValue}>{d.todayCount}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Por fazer</span>
          <span className={s.statValue}>{d.toDo}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Ganhos hoje</span>
          <span className={s.statValue}>{formatMZN(d.earningsToday, "pt").replace(",00", "")}</span>
        </div>
      </div>

      <nav className={s.tabs} aria-label="Entregas">
        <Link href="?tab=hoje" aria-current={tab === "hoje" ? "page" : undefined}>
          Para hoje
        </Link>
        <Link href="?tab=historico" aria-current={tab === "historico" ? "page" : undefined}>
          Histórico
        </Link>
        <Link href="?tab=ganhos" aria-current={tab === "ganhos" ? "page" : undefined}>
          Ganhos
        </Link>
      </nav>

      {tab === "ganhos" && earn ? (
        // EN: "Os meus ganhos" of design V3-E-Ganhos. PT: Os meus ganhos do V3.
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className={s.cardTop}>
            <h2 className={s.title} style={{ fontSize: 28 }}>
              Os meus <em>ganhos</em>
            </h2>
            <span className={s.chip}>Esta semana</span>
          </div>
          <div className={s.stats} style={{ gridTemplateColumns: "1fr 1fr" }}>
            {(
              [
                ["Entregas", String(earn.week.count)],
                ["Comissão", formatMZN(earn.week.commission, "pt").replace(",00", "")],
                ["Dinheiro cobrado", formatMZN(earn.week.cash, "pt").replace(",00", "")],
                ["A entregar na loja", formatMZN(earn.week.toStore, "pt").replace(",00", "")],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={s.stat}>
                <span className={s.statLabel}>{k}</span>
                <span className={s.statValue} style={{ fontSize: 20 }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
          <div className={s.notice}>
            <Icon name="calendar" size={20} />
            <span>
              <strong>Próximo pagamento: sexta-feira</strong>
              Comissão de {earn.pct}% do preço de cada entrega, definida pela gestão.
            </span>
          </div>
          <ul className={s.list}>
            {earn.days.length === 0 && <li className={s.empty}>Ainda sem entregas feitas.</li>}
            {earn.days.map((day) => (
              <li key={day.date} className={s.card} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  <span className={s.number} style={{ fontSize: 15 }}>
                    {dayLabel(day.date)}
                  </span>
                  <br />
                  <span className={s.muted}>
                    {day.count} {day.count === 1 ? "entrega" : "entregas"}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>{formatMZN(day.amount, "pt")}</span>
                  <span className={s.chip} data-tone={day.paid ? "done" : "transit"}>
                    {day.paid ? "Pago" : "Por pagar"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <a href="/gestao/entregador/resumo" download className={s.btnOutline}>
            <Icon name="download" size={18} />
            Descarregar resumo
          </a>
        </div>
      ) : (
        <ul className={s.list}>
          {list.length === 0 && <li className={s.empty}>{tab === "hoje" ? "Sem entregas por fazer. Avisamos quando houver uma nova." : "Ainda sem entregas feitas."}</li>}
          {list.map((o) => {
            const pay = paymentLine(o);
            const st = STATUS[o.fulfillmentStatus] ?? ["", ""];
            const when = o.deliveredAt ? `Entregue ${toMaputo(o.deliveredAt).time}` : o.deliveryEtaAt ? `Previsto ${toMaputo(o.deliveryEtaAt).time}` : "Por iniciar";
            return (
              <li key={o.id}>
                <Link href={`/gestao/entregador/${o.id}`} className={s.card}>
                  <span className={s.cardTop}>
                    <span className={s.number}>{o.number}</span>
                    <span className={s.chip} data-tone={st[1] || undefined}>
                      {st[0]}
                    </span>
                  </span>
                  <span className={s.line}>
                    <Icon name="pin" size={18} />
                    {o.contact.name} · {o.deliveryNeighbourhood ?? o.deliveryCity}
                  </span>
                  <span className={s.meta}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Icon name="clock" size={16} />
                      {when}
                    </span>
                    <span className={pay.collect ? s.collect : s.paid}>{pay.text}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
