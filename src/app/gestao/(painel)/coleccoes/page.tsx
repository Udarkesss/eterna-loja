import Image from "next/image";
import Link from "next/link";
import c from "@/components/admin/AdminV3.module.css";
import k from "@/components/admin/Collections.module.css";
import { ImportHistory, StatusButton } from "@/components/admin/CollectionsForms";
import d3 from "@/components/admin/Dashboard.module.css";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { todayMaputo } from "@/lib/time";
import { listCampaignsAdmin } from "@/server/admin/campaigns";
import { listCollectionsAdmin } from "@/server/admin/collections";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Colecções" };

type Props = { searchParams: Promise<{ vista?: string }> };

const CAMP_STATE = {
  draft: { label: "Rascunho", tone: undefined },
  scheduled: { label: "Agendada", tone: "warn" },
  running: { label: "A decorrer", tone: "ok" },
  ended: { label: "Terminada", tone: undefined },
} as const;

const STATE = { active: { label: "Activa", tone: "ok" }, draft: { label: "Rascunho", tone: undefined }, archived: { label: "Arquivada", tone: undefined } } as const;

/**
 * EN: "Gestão · Colecções" of design V3-G-Coleccoes: collections, special editions and campaigns; the archive of old
 *     collections (covers only); the planning calendar (two years).
 * PT: Colecções do V3: colecções, edições especiais e campanhas; o arquivo das colecções antigas (só capas); o calendário
 *     de planeamento (dois anos).
 */
export default async function CollectionsPage({ searchParams }: Props) {
  await requireStaffPage("products.publish");
  const p = await searchParams;
  const view = p.vista === "activas" || p.vista === "arquivadas" ? p.vista : "todas";
  const [{ list, history }, camps] = await Promise.all([listCollectionsAdmin(), listCampaignsAdmin()]);
  const shown = list.filter((x) => view === "todas" || (view === "activas" ? x.status === "active" : x.status === "archived"));
  const shownCamps = camps.filter((x) => view === "todas" || (view === "activas" ? x.state === "running" || x.state === "scheduled" : x.state === "ended"));

  // EN: Planning calendar: this year and the next, by planned dates. PT: Calendário: este ano e o seguinte.
  const year = Number(todayMaputo().slice(0, 4));
  const pos = (date: string, end = false) => {
    const [y, m, d] = date.split("-").map(Number);
    return Math.max(0, Math.min(24, (y - year) * 12 + (m - 1) + (end ? d / 30 : (d - 1) / 30)));
  };
  const bars = [...list, ...history, ...camps.map((x) => ({ id: x.id, label: x.name, startsOn: x.startsOn, endsOn: x.endsOn, status: "draft" as const, kind: "Campanha" }))]
    .filter((x) => x.startsOn && x.endsOn && Number(x.endsOn.slice(0, 4)) >= year && Number(x.startsOn.slice(0, 4)) <= year + 1)
    .sort((a, b) => (a.startsOn! < b.startsOn! ? -1 : 1));

  return (
    <>
      <PageTop
        eyebrow="Catálogo"
        title="Colecções"
        actions={
          <>
            <a href="#historico" className={`${c.btn} ${c.sm}`}>
              <Icon name="upload" size={15} />
              Carregar histórico
            </a>
            <Link href="/gestao/campanhas/nova" className={`${c.btn} ${c.sm}`}>
              <Icon name="plus" size={15} />
              Nova campanha
            </Link>
            <Link href="/gestao/coleccoes/nova" className={`${c.btnPrimary} ${c.sm}`}>
              <Icon name="plus" size={15} />
              Nova colecção
            </Link>
          </>
        }
      />
      <div className={c.note}>
        <Icon name="layers" size={18} />
        <span>
          Só uma colecção sazonal activa de cada vez, mais as edições especiais e campanhas. Quando uma colecção termina, as peças voltam às listas normais, sem o nome da colecção, e a colecção passa ao
          arquivo, só na gestão.
        </span>
      </div>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Colecções, edições e campanhas</h2>
          <nav className={c.seg} aria-label="Estado">
            {(["todas", "activas", "arquivadas"] as const).map((v) => (
              <Link key={v} href={v === "todas" ? "?" : `?vista=${v}`} aria-current={v === view ? "page" : undefined}>
                {v === "todas" ? "Todas" : v === "activas" ? "Activas" : "Arquivadas"}
              </Link>
            ))}
          </nav>
        </div>
        {shown.length + shownCamps.length === 0 ? (
          <p className={d3.empty}>Nenhuma colecção.</p>
        ) : (
          <table className={d3.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ano</th>
                <th>Datas planeadas</th>
                <th>Peças (Festa / Executiva)</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id} className={x.status === "active" ? c.hl : undefined}>
                  <td>
                    <span className={c.row} style={{ gap: 12 }}>
                      <span className={k.coverCell}>{x.imageUrl ? <Image src={x.imageUrl} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /> : <Icon name="image" size={16} />}</span>
                      <span className={c.who}>
                        <b>
                          {x.label}
                          {x.inside && <span className={c.xsMuted}> · dentro da {x.inside}</span>}
                        </b>
                        <span className={c.xsMuted}>{x.kind}</span>
                      </span>
                    </span>
                  </td>
                  <td>{x.year ?? "—"}</td>
                  <td>{x.dates}</td>
                  <td>
                    <span className={c.num}>{x.pieces}</span>
                  </td>
                  <td>
                    <span className={c.st} data-tone={STATE[x.status].tone}>
                      {STATE[x.status].label}
                    </span>
                  </td>
                  <td>
                    <span className={c.row} style={{ gap: 6 }}>
                      <Link href={`/gestao/coleccoes/${x.id}`} className={`${c.btn} ${c.xs}`}>
                        Editar
                      </Link>
                      {x.status === "active" ? (
                        <StatusButton id={x.id} status="archived" label="Desactivar" confirmText={`Desactivar a ${x.name}? Deixa de aparecer no site.`} />
                      ) : x.status === "archived" ? (
                        <StatusButton id={x.id} status="active" label="Reactivar" confirmText={`Reactivar a ${x.name}?`} />
                      ) : (
                        <Link href={`/gestao/coleccoes/${x.id}?activar=1`} className={c.textBtn}>
                          Activar
                        </Link>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {shownCamps.map((x) => (
                <tr key={x.id} className={x.state === "running" ? c.hl : undefined}>
                  <td>
                    <span className={c.row} style={{ gap: 12 }}>
                      <span className={k.coverCell}>{x.imageUrl ? <Image src={x.imageUrl} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /> : <Icon name="tag" size={16} />}</span>
                      <span className={c.who}>
                        <b>
                          {x.name} <span className={c.xsMuted}>· {x.note}</span>
                        </b>
                        <span className={c.xsMuted}>Campanha</span>
                      </span>
                    </span>
                  </td>
                  <td>{x.year}</td>
                  <td>{x.dates}</td>
                  <td>
                    <span className={c.num}>{x.pieces} peças</span>
                  </td>
                  <td>
                    <span className={c.st} data-tone={CAMP_STATE[x.state].tone}>
                      {CAMP_STATE[x.state].label}
                    </span>
                  </td>
                  <td>
                    <Link href={`/gestao/campanhas/${x.id}`} className={`${c.btn} ${c.xs}`}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Colecções antigas · arquivo (não aparece no site)</h2>
          <Link href="/gestao/coleccoes/nova?antiga=1" className={`${c.btn} ${c.xs}`}>
            <Icon name="plus" size={13} />
            Colecção antiga
          </Link>
        </div>
        {history.length > 0 && (
          <table className={d3.table}>
            <thead>
              <tr>
                <th>Colecção</th>
                <th>Ano</th>
                <th>Datas</th>
                <th>Capa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className={c.row} style={{ gap: 12 }}>
                      <span className={k.thumb}>{x.imageUrl ? <Image src={x.imageUrl} alt="" fill sizes="48px" style={{ objectFit: "cover" }} /> : null}</span>
                      <b style={{ fontWeight: 500 }}>{x.label}</b>
                    </span>
                  </td>
                  <td>{x.year ?? "—"}</td>
                  <td>
                    <span className={c.small}>{x.dates}</span>
                  </td>
                  <td>
                    <span className={c.st} data-tone={x.imageUrl ? "ok" : "warn"}>
                      {x.imageUrl ? "Capa carregada" : "Sem capa"}
                    </span>
                  </td>
                  <td>
                    <Link href={`/gestao/coleccoes/${x.id}`} className={`${c.btn} ${c.xs}`}>
                      {x.imageUrl ? "Trocar capa" : "Carregar capa"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={d3.panelBody}>
          <div className={c.note}>
            <Icon name="info" size={16} />
            <span className={c.small}>Importar várias de uma vez: um Excel (nome, número, ano, início, fim) e um ZIP com as capas 3:4, com o mesmo nome de ficheiro da linha do Excel.</span>
          </div>
          <ImportHistory />
        </div>
      </section>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Calendário de planeamento</h2>
        </div>
        <div className={k.gantt}>
          <span className={c.label} style={{ color: "var(--muted)" }}>
            {year} · {year + 1}
          </span>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className={k.month} data-year={i === 12 || undefined}>
              {"JFMAMJJASOND"[i % 12]}
            </span>
          ))}
          {bars.map((x) => {
            const a = pos(x.startsOn!);
            const b = pos(x.endsOn!, true);
            const tone =
              x.status === "active"
                ? { background: "var(--contrast)", color: "var(--on-contrast)" }
                : x.kind === "Campanha"
                  ? { background: "var(--danger-soft)", color: "var(--danger)" }
                  : x.kind === "Edição especial"
                    ? { background: "var(--accent)", color: "var(--ink)" }
                    : { background: "var(--alt)", color: "var(--ink)" };
            return [
              <span key={`${x.id}-n`} className={c.small} style={{ paddingLeft: 4 }}>
                {x.label}
              </span>,
              <span key={`${x.id}-t`} className={k.track}>
                <span className={k.gbar} style={{ left: `${(a / 24) * 100}%`, width: `${Math.max(1, ((b - a) / 24) * 100)}%`, ...tone }}>
                  {x.label}
                </span>
              </span>,
            ];
          })}
        </div>
        <span className={c.xsMuted} style={{ display: "block", padding: "0 22px 18px" }}>
          Só planeamento: as colecções activam-se à mão.
        </span>
      </section>
    </>
  );
}
