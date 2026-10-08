import s from "@/components/admin/admin.module.css";
import { Chip, DemoTag, PageTop, when } from "@/components/admin/ui";
import { ACTION_GROUPS, listAudit } from "@/server/admin/audit";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Auditoria" };

type Props = { searchParams: Promise<{ q?: string; accao?: string; de?: string; ate?: string }> };
const RESULT = { success: ["Sucesso", "ok"], warning: ["Aviso", "warn"], blocked: ["Bloqueio", "bad"], failure: ["Falha", "bad"] } as const;

/** EN: "Gestão · A4 Auditoria" (read-only; the Administrador only views). PT: Registo só de leitura. */
export default async function AuditPage({ searchParams }: Props) {
  await requireStaffPage("audit");
  const p = await searchParams;
  const rows = await listAudit({ q: p.q, group: p.accao, from: p.de, to: p.ate });
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <PageTop
        eyebrow="Quem fez o quê, quando e de onde"
        title={
          <>
            Registo de <em>auditoria</em>
          </>
        }
        actions={
          <a href={`/gestao/auditoria/exportar?${qs}`} className={s.btnOutline}>
            Exportar
          </a>
        }
      />
      <DemoTag show={rows.some((r) => r.isDemo)} />
      <form className={s.filters}>
        <label className={s.label} style={{ flex: "1 1 220px" }}>
          Pessoa
          <input className={s.input} type="search" name="q" defaultValue={p.q} placeholder="Nome, utilizador ou detalhe" />
        </label>
        <label className={s.label}>
          Acção
          <select className={s.select} name="accao" defaultValue={p.accao ?? ""}>
            <option value="">Todas</option>
            {Object.entries(ACTION_GROUPS).map(([k, g]) => (
              <option key={k} value={k}>
                {g.label}
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
        <button className={s.btn} type="submit">
          Filtrar
        </button>
      </form>
      <section className={s.cardFlush}>
        {rows.length === 0 ? (
          <p className={s.empty}>Sem registos com estes filtros.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Pessoa</th>
                <th>Acção</th>
                <th>Detalhe</th>
                <th>Origem</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={s.num}>{when(r.at)}</td>
                  <td>
                    <span className={s.two}>
                      <span>{r.actorName}</span>
                      <span className={s.muted}>{r.actorRole ?? "—"}</span>
                    </span>
                  </td>
                  <td>{r.action}</td>
                  <td className={s.muted}>{r.detail ?? "—"}</td>
                  <td className={s.muted}>{r.origin ?? "—"}</td>
                  <td>
                    <Chip tone={RESULT[r.result][1]}>{RESULT[r.result][0]}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={s.pager}>Os registos não podem ser editados nem apagados. O Administrador só os pode ver.</div>
      </section>
    </>
  );
}
