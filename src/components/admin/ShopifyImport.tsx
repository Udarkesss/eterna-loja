"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { finishImportAction, importShopifyBatchAction } from "@/app/gestao/actions/import";
import { categoryName, readShopifyExport, type ImportReport } from "@/lib/import/shopify";
import s from "./admin.module.css";
import { Chip } from "./ui";

interface Props {
  stores: { code: string; name: string }[];
  canPublish: boolean;
}

const BATCH = 3; // EN: products per request (photos are downloaded on the server). PT: produtos por pedido.

/**
 * EN: "Produtos → Importar do Shopify". 1) choose the CSV (read in the browser), 2) check the report and options,
 *     3) import in small batches with a progress bar. Closing the page stops the import; running it again continues
 *     without duplicates.
 * PT: 1) escolher o CSV (lido no browser), 2) ver o relatório e as opções, 3) importar aos poucos com barra de
 *     progresso. Fechar a página pára a importação; voltar a correr continua sem duplicar.
 */
export function ShopifyImport({ stores, canPublish }: Props) {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [opts, setOpts] = useState({ publishActive: false, stock: 1, store: stores[0]?.code ?? "02" });
  const [phase, setPhase] = useState<"pick" | "review" | "running" | "done">("pick");
  const [done, setDone] = useState({ n: 0, created: 0, updated: 0, failed: 0, photos: 0 });
  const [failures, setFailures] = useState<string[]>([]);
  const stop = useRef(false);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      setReport(readShopifyExport(await file.text()));
      setFileName(file.name);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler o ficheiro.");
    }
  }

  async function run() {
    if (!report) return;
    stop.current = false;
    setPhase("running");
    const total = { n: 0, created: 0, updated: 0, failed: 0, photos: 0 };
    const failed: string[] = [];
    for (let i = 0; i < report.items.length && !stop.current; i += BATCH) {
      const batch = report.items.slice(i, i + BATCH);
      const r = await importShopifyBatchAction({ items: batch.map((item) => ({ ...item, warnings: undefined })), options: opts }).catch(() => null);
      if (!r?.ok || !r.results) {
        total.failed += batch.length;
        failed.push(...batch.map((b) => `${b.code}: ${r?.message ?? "sem ligação ao servidor"}`));
      } else {
        for (const x of r.results) {
          total[x.result] += 1;
          total.photos += x.photos;
          if (x.result === "failed") failed.push(`${x.code}: ${x.message ?? "erro"}`);
        }
      }
      total.n = Math.min(i + BATCH, report.items.length);
      setDone({ ...total });
      setFailures([...failed]);
    }
    await finishImportAction(
      `${fileName}: ${total.created} criados, ${total.updated} actualizados, ${total.failed} falharam, ${total.photos} fotos${stop.current ? " (parada a meio)" : ""}`,
    ).catch(() => undefined);
    setPhase("done");
  }

  if (phase === "pick" || !report) {
    return (
      <section className={s.card}>
        <h2 className={s.h2}>1. Escolher o ficheiro</h2>
        <p className={s.muted}>
          No Shopify: Produtos → Exportar → “Todos os produtos” → “CSV para Excel”. O ficheiro é lido aqui no browser; nada é gravado
          antes de confirmar.
        </p>
        <label className={s.label}>
          Ficheiro CSV do Shopify
          <input type="file" accept=".csv,text/csv" onChange={pick} className={s.input} />
        </label>
        {error && <p className={s.error}>{error}</p>}
      </section>
    );
  }

  const warned = report.items.filter((i) => i.warnings.length);
  const active = report.items.filter((i) => i.active).length;
  const pct = Math.round((done.n / Math.max(1, report.items.length)) * 100);

  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Produtos</span>
          <span className={s.statValue}>{report.items.length}</span>
          <span className={s.statSub}>{report.items.reduce((n, i) => n + i.variants.length, 0)} tamanhos e cores</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Fotografias</span>
          <span className={s.statValue}>{report.imageCount}</span>
          <span className={s.statSub}>descarregadas do Shopify</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Activos no Shopify</span>
          <span className={s.statValue}>{active}</span>
          <span className={s.statSub}>{report.items.length - active} em rascunho</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>A rever</span>
          <span className={s.statValue}>{warned.length}</span>
          <span className={s.statSub}>com avisos</span>
        </div>
      </div>

      {phase === "review" && (
        <div className={s.split}>
          <div className={s.stack}>
            <section className={s.cardFlush}>
              <div className={s.cardHead}>
                <h2 className={s.h2}>Correspondência dos tipos</h2>
              </div>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>No Shopify</th>
                    <th>No site</th>
                    <th className={s.num}>Produtos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.types.map((t) => (
                    <tr key={t.shopify}>
                      <td>{t.shopify || "—"}</td>
                      <td>{t.slug ? categoryName(t.slug) : <Chip tone="warn">Não importado</Chip>}</td>
                      <td className={s.num}>{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {(warned.length > 0 || report.skipped.length > 0) && (
              <section className={s.card}>
                <h2 className={s.h2}>A rever depois</h2>
                <ul className={s.list}>
                  {report.skipped.map((x) => (
                    <li key={x.code} className={s.listItem}>
                      <span className={s.strong}>{x.code}</span>
                      <span className={s.muted}>{x.reason}</span>
                    </li>
                  ))}
                  {warned.slice(0, 40).map((i) => (
                    <li key={i.sourceId} className={s.listItem}>
                      <span className={s.strong}>{i.code}</span>
                      <span className={s.muted}>{i.warnings.join(" · ")}</span>
                    </li>
                  ))}
                </ul>
                {warned.length > 40 && <p className={s.muted}>E mais {warned.length - 40}.</p>}
              </section>
            )}
          </div>

          <div className={s.stack}>
            <section className={s.card}>
              <h2 className={s.h2}>2. Opções</h2>
              <p className={s.muted}>{fileName}</p>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={opts.publishActive}
                  disabled={!canPublish}
                  onChange={(e) => setOpts({ ...opts, publishActive: e.target.checked })}
                />
                Publicar já os {active} produtos activos no Shopify
              </label>
              <p className={s.hint}>
                {canPublish ? "Sem esta opção, entram todos como rascunho para a equipa rever." : "O seu papel só importa como rascunho."}
              </p>
              <div className={s.row2}>
                <label className={s.label}>
                  Stock de cada tamanho
                  <input
                    type="number"
                    min={0}
                    max={999}
                    className={s.input}
                    value={opts.stock}
                    onChange={(e) => setOpts({ ...opts, stock: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })}
                  />
                </label>
                <label className={s.label}>
                  Loja
                  <select className={s.select} value={opts.store} onChange={(e) => setOpts({ ...opts, store: e.target.value })}>
                    {stores.map((st) => (
                      <option key={st.code} value={st.code}>
                        Loja {st.code} · {st.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className={s.hint}>O Shopify não tinha stock registado. Ajuste depois em cada produto.</p>
              {report.unmappedTags.length > 0 && (
                <p className={s.warning}>
                  Etiquetas sem categoria no site (ficam de fora): {report.unmappedTags.map((t) => `${t.tag} (${t.count})`).join(", ")}.
                </p>
              )}
              <p className={s.muted}>
                Pode repetir a importação: os produtos já importados não se duplicam, e nomes, textos e fotos editados na gestão mantêm-se.
              </p>
              <div className={s.actions}>
                <button type="button" className={s.btn} onClick={run}>
                  Importar {report.items.length} produtos
                </button>
                <button type="button" className={s.btnOutline} onClick={() => setPhase("pick")}>
                  Outro ficheiro
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {(phase === "running" || phase === "done") && (
        <section className={s.card}>
          <h2 className={s.h2}>{phase === "running" ? "3. A importar…" : stop.current ? "Importação parada" : "Importação concluída"}</h2>
          <div className={s.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%`, background: "var(--privee)" }} />
          </div>
          <p>
            {done.n} de {report.items.length} · {done.created} novos · {done.updated} já existiam · {done.photos} fotografias
            {done.failed ? ` · ${done.failed} falharam` : ""}
          </p>
          {phase === "running" ? (
            <>
              <p className={s.hint}>Mantenha esta página aberta. Se a fechar, volte a importar o mesmo ficheiro para continuar.</p>
              <div className={s.actions}>
                <button type="button" className={s.btnOutline} onClick={() => (stop.current = true)}>
                  Parar
                </button>
              </div>
            </>
          ) : (
            <div className={s.actions}>
              <Link href="/gestao/produtos?tab=Rascunhos" className={s.btn}>
                Ver rascunhos
              </Link>
              <Link href="/gestao/produtos" className={s.btnOutline}>
                Todos os produtos
              </Link>
            </div>
          )}
          {failures.length > 0 && (
            <ul className={s.list}>
              {failures.slice(0, 30).map((f) => (
                <li key={f} className={s.listItem}>
                  <span className={s.muted}>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
