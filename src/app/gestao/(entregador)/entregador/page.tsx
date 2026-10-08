import Link from "next/link";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { formatMZN } from "@/lib/format";
import { formatLongDate, toMaputo, todayMaputo } from "@/lib/time";
import { driverDashboard, paymentLine } from "@/server/delivery";
import { requireStaffPage } from "@/server/staff/access";

type Props = { searchParams: Promise<{ tab?: string }> };

const STATUS: Record<string, [string, string]> = {
  assigned: ["Atribuída", ""],
  in_transit: ["Em trânsito", "transit"],
  delivered: ["Entregue · a aguardar a cliente", "done"],
  confirmed: ["Confirmada", "done"],
};

/** EN: "Entregador · As minhas entregas". PT: As minhas entregas (só as atribuídas a mim). */
export default async function DriverHome({ searchParams }: Props) {
  const me = await requireStaffPage(undefined, { allowDriver: true });
  const tab = (await searchParams).tab === "historico" ? "historico" : (await searchParams).tab === "ganhos" ? "ganhos" : "hoje";
  const d = await driverDashboard(me);
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

      {tab === "ganhos" ? (
        <div className={s.section}>
          <div className={s.footer} style={{ borderTop: 0, paddingTop: 0 }}>
            <span className={s.muted}>Comissão</span>
            <span>{d.pct}% do preço da entrega</span>
          </div>
          <div className={s.footer}>
            <span className={s.muted}>Hoje</span>
            <span style={{ fontWeight: 500 }}>{formatMZN(d.earningsToday, "pt")}</span>
          </div>
          <div className={s.footer}>
            <span className={s.muted}>Últimos 7 dias</span>
            <span style={{ fontWeight: 500 }}>{formatMZN(d.weekEarnings, "pt")}</span>
          </div>
          <span className={s.muted}>A loja marca as comissões como pagas no relatório de ganhos. Enquanto os preços das entregas estiverem por definir, o valor é 0.</span>
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
