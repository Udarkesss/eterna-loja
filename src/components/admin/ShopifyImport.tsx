"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { finishImportAction, importShopifyBatchAction, readOldSiteAction } from "@/app/gestao/actions/import";
import { categoryName, readShopify, type ImportReport, type OldSite } from "@/lib/import/shopify";
import s from "./admin.module.css";
import { Chip } from "./ui";

interface Props {
  stores: { code: string; name: string }[];
  canPublish: boolean;
}

const BATCH = 3; // EN: products per request (photos are downloaded on the server). PT: produtos por pedido.
const PAGE = 250; // EN: Shopify page size. PT: tamanho de página do Shopify.

/**
 * EN: "Produtos → Importar do Shopify" (migration). 1) choose the CSV and read the old site (eterna.co.mz), 2) check the
 *     cross-check report, 3) import in small batches with a progress bar. Existing products are overwritten with the
 *     source; nothing is duplicated. Closing the page stops the import; running it again continues.
 * PT: (migração) 1) escolher o CSV e ler o site antigo, 2) ver o cruzamento, 3) importar aos poucos com barra de
 *     progresso. Os produtos que já existem são substituídos pela origem; nada se duplica. Fechar a página pára a
 *     importação; voltar a correr continua.
 */
export function ShopifyImport({ stores, canPublish }: Props) {
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [mirror, setMirror] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [opts, setOpts] = useState({ stock: 1, store: stores[0]?.code ?? "02" });
  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "running" | "done">("pick");
  const [done, setDone] = useState({ n: 0, created: 0, updated: 0, failed: 0, photos: 0, published: 0 });
  const [failures, setFailures] = useState<string[]>([]);
  const stop = useRef(false);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError("");
    setCsv(file ? { name: file.name, text: await file.text() } : null);
  }

  /** EN: Reads the old site page by page through the server. PT: Lê o site antigo página a página pelo servidor. */
  async function readOld(): Promise<OldSite> {
    const call = async (req: Parameters<typeof readOldSiteAction>[0]) => {
      const r = await readOldSiteAction(req);
      if (!r.ok) throw new Error(r.message);
      return r.data;
    };
    const products: OldSite["products"] = [];
    for (let page = 1; ; page++) {
      setProgress(`A ler os produtos publicados no site antigo… ${products.length}`);
      const d = await call({ kind: "products", page });
      const list = d.products ?? [];
      products.push(...list);
      if (list.length < PAGE) break;
    }
    const collections: OldSite["collections"] = [];
    for (let page = 1; ; page++) {
      const d = await call({ kind: "collections", page });
      const list = d.collections ?? [];
      collections.push(...list);
      if (list.length < PAGE) break;
    }
    const members: OldSite["members"] = {};
    for (const [i, c] of collections.entries()) {
      setProgress(`A ler as colecções do site antigo… ${i + 1} de ${collections.length}`);
      members[c.handle] = [];
      for (let page = 1; ; page++) {
        const d = await call({ kind: "members", handle: c.handle, page });
        const list = d.handles ?? [];
        members[c.handle].push(...list);
        if (list.length < PAGE) break;
      }
    }
    return { products, collections, members };
  }

  async function analyse() {
    if (!csv && !mirror) return;
    setError("");
    setPhase("reading");
    try {
      const old = mirror ? await readOld() : null;
      setReport(readShopify(csv?.text ?? null, old));
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler os dados.");
      setPhase("pick");
    }
    setProgress("");
  }

  async function run() {
    if (!report) return;
    stop.current = false;
    setPhase("running");
    const total = { n: 0, created: 0, updated: 0, failed: 0, photos: 0, published: 0 };
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
          if (x.published) total.published += 1;
          if (x.result === "failed") failed.push(`${x.code}: ${x.message ?? "erro"}`);
        }
      }
      total.n = Math.min(i + BATCH, report.items.length);
      setDone({ ...total });
      setFailures([...failed]);
    }
    await finishImportAction(
      `${csv?.name ?? "site antigo"}: ${total.created} criados, ${total.updated} substituídos, ${total.published} publicados, ${total.failed} falharam, ${total.photos} fotos${stop.current ? " (parada a meio)" : ""}`,
    ).catch(() => undefined);
    setPhase("done");
  }

  if (phase === "pick" || phase === "reading" || !report) {
    return (
      <section className={s.card}>
        <h2 className={s.h2}>1. Ficheiro e site antigo</h2>
        <p className={s.muted}>
          No Shopify: Produtos → Exportar → “Todos os produtos” → “CSV para Excel”. O CSV traz também os rascunhos; o site antigo diz o que está
          publicado e em que colecções. Nada é gravado antes de confirmar.
        </p>
        <label className={s.label}>
          Ficheiro CSV do Shopify
          <input type="file" accept=".csv,text/csv" onChange={pick} className={s.input} disabled={phase === "reading"} />
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} disabled={phase === "reading"} />
          Espelhar o site antigo (eterna.co.mz): publicar só o que lá está publicado, nas mesmas colecções e ocasiões
        </label>
        {progress && <p className={s.hint}>{progress}</p>}
        {error && <p className={s.error}>{error}</p>}
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={analyse} disabled={phase === "reading" || (!csv && !mirror)}>
            {phase === "reading" ? "A ler…" : "Analisar"}
          </button>
        </div>
      </section>
    );
  }

  const warned = report.items.filter((i) => i.warnings.length);
  const toShop = report.items.filter((i) => i.publish).length;
  const pct = Math.round((done.n / Math.max(1, report.items.length)) * 100);
  const old = report.oldSite;

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
          <span className={s.statLabel}>Vão para a loja</span>
          <span className={s.statValue}>{toShop}</span>
          <span className={s.statSub}>{report.items.length - toShop} ficam em rascunho</span>
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
            {old && (
              <section className={s.card}>
                <h2 className={s.h2}>Cruzamento com o site antigo</h2>
                <dl className={s.dl}>
                  <dt>Publicados no site antigo</dt>
                  <dd className={s.num}>{old.visible}</dd>
                  <dt>No CSV e no site antigo</dt>
                  <dd className={s.num}>{old.both}</dd>
                  <dt>Só no site antigo (mais recentes que o CSV)</dt>
                  <dd className={s.num}>{old.siteOnly}</dd>
                  <dt>Só no CSV (não publicados → rascunho)</dt>
                  <dd className={s.num}>{old.csvOnly}</dd>
                </dl>
              </section>
            )}
            {old && (
              <section className={s.cardFlush}>
                <div className={s.cardHead}>
                  <h2 className={s.h2}>Colecções do site antigo</h2>
                </div>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>No site antigo</th>
                      <th>No site novo</th>
                      <th className={s.num}>Produtos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {old.collections.map((c) => (
                      <tr key={c.handle}>
                        <td>{c.title}</td>
                        <td>{c.slug ? categoryName(c.slug) : <Chip tone="warn">Sem equivalente</Chip>}</td>
                        <td className={s.num}>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            <section className={s.cardFlush}>
              <div className={s.cardHead}>
                <h2 className={s.h2}>Tipos de peça</h2>
              </div>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>No Shopify</th>
                    <th>No site novo</th>
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
              <p className={s.muted}>{[csv?.name, old ? "site antigo" : null].filter(Boolean).join(" + ")}</p>
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
              <p className={s.hint}>O Shopify não regista stock: os tamanhos esgotados no site antigo ficam com 0, os outros com este número.</p>
              {!canPublish && <p className={s.warning}>O seu papel só importa como rascunho; a publicação fica para quem pode publicar.</p>}
              {report.unmappedTags.length > 0 && (
                <p className={s.muted}>Etiquetas do Shopify sem uso no site novo: {report.unmappedTags.map((t) => `${t.tag} (${t.count})`).join(", ")}.</p>
              )}
              <p className={s.warning}>
                Os produtos que já existem são substituídos pelos dados do Shopify (nomes, textos, preços, categorias, tamanhos, fotos e estado).
              </p>
              <div className={s.actions}>
                <button type="button" className={s.btn} onClick={run}>
                  Importar {report.items.length} produtos
                </button>
                <button type="button" className={s.btnOutline} onClick={() => setPhase("pick")}>
                  Voltar
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
            {done.n} de {report.items.length} · {done.created} novos · {done.updated} substituídos · {done.published} na loja · {done.photos} fotografias
            {done.failed ? ` · ${done.failed} falharam` : ""}
          </p>
          {phase === "running" ? (
            <>
              <p className={s.hint}>Mantenha esta página aberta. Se a fechar, volte a importar para continuar.</p>
              <div className={s.actions}>
                <button type="button" className={s.btnOutline} onClick={() => (stop.current = true)}>
                  Parar
                </button>
              </div>
            </>
          ) : (
            <div className={s.actions}>
              <Link href="/gestao/produtos?tab=Publicados" className={s.btn}>
                Ver publicados
              </Link>
              <Link href="/gestao/produtos?tab=Rascunhos" className={s.btnOutline}>
                Ver rascunhos
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
