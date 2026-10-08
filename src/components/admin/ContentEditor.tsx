"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishPageAction, type ContentResult } from "@/app/gestao/actions/content";
import { Icon } from "@/components/ui/Icon";
import s from "./admin.module.css";
import { FieldEditor } from "./FieldEditor";

/**
 * EN: "Gestão · 8 Conteúdo do site": sections top to bottom (move up/down, show/hide), the selected section's
 *     fields on the right, and "Publicar página" to save everything at once.
 * PT: Secções de cima para baixo (subir/descer, mostrar/esconder), os campos da secção à direita e
 *     "Publicar página" para guardar tudo de uma vez.
 */

export interface EditableSection {
  key: string;
  label: string;
  visible: boolean;
  data: Record<string, unknown>;
}

export function ContentEditor({ page, sections: initial, publishedAt }: { page: "home" | "info"; sections: EditableSection[]; publishedAt: string | null }) {
  const [sections, setSections] = useState(initial);
  const [sel, setSel] = useState(page === "home" ? (initial.find((x) => x.key === "hero")?.key ?? initial[0]?.key) : initial[0]?.key);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [pending, start] = useTransition();
  const cur = sections.find((x) => x.key === sel);

  const update = (next: EditableSection[]) => {
    setSections(next);
    setDirty(true);
    setResult(null);
  };
  const move = (i: number, d: number) => {
    const a = [...sections];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    update(a);
  };

  const publish = () =>
    start(async () => {
      const r = await publishPageAction(page, sections.map((x) => ({ key: x.key, visible: x.visible, data: x.data })));
      setResult(r);
      if (r.ok) setDirty(false);
    });

  return (
    <>
      <div className={s.top} style={{ marginTop: -16 }}>
        <div className={s.actions}>
          {dirty && <span className={s.chip} data-tone="warn">Alterações por publicar</span>}
          {result && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓ Página publicada" : result.message}</span>}
        </div>
        <div className={s.actions}>
          <a href={page === "home" ? "/pt" : `/pt/info/${sel}`} target="_blank" className={s.btnOutline}>
            <Icon name="eye" size={16} />
            Pré-visualizar
          </a>
          <button className={s.btn} disabled={pending || !dirty} onClick={publish}>
            Publicar página
          </button>
        </div>
      </div>

      <div className={s.splitNarrow}>
        <section className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>{page === "home" ? "Secções da página Início" : "Páginas de informação"}</h2>
            {page === "home" && <span className={s.muted}>De cima para baixo</span>}
          </div>
          <ol className={s.list}>
            {sections.map((x, i) => (
              <li key={x.key} className={s.listItem} style={{ alignItems: "center", background: x.key === sel ? "var(--blush-light)" : undefined, padding: "10px 8px" }}>
                <button type="button" className={s.two} style={{ flexGrow: 1, border: 0, background: "none", textAlign: "left", padding: 0, color: x.visible ? "var(--ink)" : "var(--ink-muted)" }} onClick={() => setSel(x.key)} aria-pressed={x.key === sel}>
                  <span className={x.key === sel ? s.strong : undefined}>{x.label}</span>
                  <span className={s.muted}>{!x.visible ? "Escondida" : x.key === sel ? "A editar" : "Visível"}</span>
                </button>
                {page === "home" && (
                  <>
                    <button className={`${s.btnOutline} ${s.small}`} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${x.label}`}>
                      <Icon name="arrowUp" size={14} />
                    </button>
                    <button className={`${s.btnOutline} ${s.small}`} onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Descer ${x.label}`}>
                      <Icon name="arrowDown" size={14} />
                    </button>
                    <label className={s.check} style={{ fontSize: 13 }}>
                      <input type="checkbox" checked={x.visible} onChange={() => update(sections.map((y) => (y.key === x.key ? { ...y, visible: !y.visible } : y)))} aria-label={`Mostrar ${x.label}`} />
                      Visível
                    </label>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className={s.card}>
          {cur && (
            <>
              <div className={s.cardHead}>
                <div className={s.two}>
                  <span className={s.eyebrow}>A editar</span>
                  <h2 className={s.h2}>{cur.label}</h2>
                </div>
                {publishedAt && <span className={s.muted}>Última publicação: {publishedAt}</span>}
              </div>
              {!cur.visible && (
                <div className={s.warning}>
                  <Icon name="alert" size={18} />
                  Esta secção está escondida e não aparece na loja.
                </div>
              )}
              {cur.key === "hero" && (
                <Link href="/gestao/conteudo/imagem-principal" className={s.a}>
                  Vídeo, imagem, parallax e ocasiões →
                </Link>
              )}
              {cur.key === "occasions" && (
                <Link href="/gestao/conteudo/imagem-principal#ocasioes" className={s.a}>
                  Editar o mosaico de ocasiões →
                </Link>
              )}
              <FieldEditor name="root" value={cur.data} onChange={(v) => update(sections.map((y) => (y.key === cur.key ? { ...y, data: v as Record<string, unknown> } : y)))} />
              <span className={s.hint}>Para pôr uma palavra em itálico dourado, escreva-a entre *asteriscos*. Uma linha em branco separa parágrafos.</span>
            </>
          )}
        </section>
      </div>
    </>
  );
}
