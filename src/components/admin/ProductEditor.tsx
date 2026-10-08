"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { archiveProductAction, saveProductAction, uploadProductImageAction, type ProductActionResult } from "@/app/gestao/actions/products";
import { Icon } from "@/components/ui/Icon";
import { COLOR_FAMILIES, type ColorFamily, type Localized, type ProductStatus } from "@/types";
import s from "./admin.module.css";

/**
 * EN: "Gestão · 7 Editar produto". Texts in Portuguese and English (the store is bilingual); the first photo is the
 *     main one; stock per size, colour and store. "Publicar" needs the publish permission (matrix: products.publish).
 * PT: Textos em português e inglês (a loja é bilingue); a primeira foto é a principal; stock por tamanho, cor e loja.
 */

export interface EditorProduct {
  id?: string;
  code: string;
  name: Localized;
  description: Localized;
  composition: Localized;
  price: number;
  salePrice: number | null;
  status: ProductStatus;
  publishAt: string | null;
  isNew: boolean;
  seoTitle: string;
  typeId: string | null;
  collectionId: string | null;
  occasionIds: string[];
  colors: { key: string; name: Localized; hex: string | null; family: ColorFamily | null }[];
  variants: { id?: string; size: string; color: string | null; storeCode: string; stock: number }[];
  images: { id?: string; url: string; alt: Localized; color: string | null }[];
}

type Opt = { id: string; name: string };
const FAMILY_PT: Record<ColorFamily, string> = { blue: "Azul", off_white: "Off-white", beige: "Bege", fuchsia: "Fúcsia", black: "Preto", red: "Vermelho", green: "Verde", gold: "Dourado" };
const digits = (v: string) => Number(v.replace(/\D/g, "").slice(0, 8)) || 0;
const fmt = (n: number) => (n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");

export function ProductEditor(props: {
  product: EditorProduct;
  types: Opt[];
  collections: Opt[];
  occasions: Opt[];
  stores: { code: string; name: string; editable: boolean }[];
  canPublish: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState(props.product);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ProductActionResult | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<EditorProduct>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setDirty(true);
    setResult(null);
  };
  const ro = !props.canEdit;
  const stock = p.variants.reduce((n, v) => n + v.stock, 0);
  const lowStock = p.variants.length > 0 && p.variants.some((v) => v.stock <= 1);
  const seo = p.seoTitle || `${p.name.pt || "Nome da peça"} ${p.code} | Eterna Maputo`;

  function save(status: ProductStatus) {
    start(async () => {
      const r = await saveProductAction({
        ...p,
        status,
        composition: p.composition.pt || p.composition.en ? p.composition : null,
        seoTitle: p.seoTitle || null,
      });
      setResult(r);
      if (r.ok) {
        setDirty(false);
        setP((cur) => ({ ...cur, status: props.canPublish ? status : cur.status }));
        if (!p.id && r.id) router.replace(`/gestao/produtos/${r.id}`);
        else router.refresh();
      }
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: EditorProduct["images"] = [];
    for (const file of Array.from(files).slice(0, 8 - p.images.length)) {
      const form = new FormData();
      form.set("file", file);
      const r = await uploadProductImageAction(form);
      const first = p.images.length + added.length === 0;
      if (r.ok && r.url) added.push({ url: r.url, alt: { pt: `${p.code || "Peça"}${first ? " de frente" : ""}`, en: `${p.code || "Piece"}${first ? " front" : ""}` }, color: null });
      else setResult(r);
    }
    set({ images: [...p.images, ...added] });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const moveImage = (i: number, d: number) => {
    const a = [...p.images];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ images: a });
  };

  const statusLabel = p.status === "published" ? "Publicado na loja" : p.status === "scheduled" ? "Agendado" : p.status === "archived" ? "Arquivado" : "Rascunho";

  return (
    <>
      <div className={s.top} style={{ marginTop: -20 }}>
        <div className={s.actions}>
          {dirty && <span className={s.chip} data-tone="warn">Alterações por publicar</span>}
          {!dirty && result?.ok && <span className={s.chip} data-tone="ok">✓ {result.message}</span>}
          {!dirty && !result && <span className={s.chip}>{statusLabel}</span>}
        </div>
        <div className={s.actions}>
          {p.id && (
            <a href={`/pt/product/${p.code.toLowerCase()}`} target="_blank" className={s.btnOutline}>
              <Icon name="eye" size={16} />
              Pré-visualizar
            </a>
          )}
          {props.canEdit && (
            <button className={s.btnOutline} disabled={pending} onClick={() => save(props.canPublish ? "draft" : p.status)}>
              {props.canPublish ? "Guardar rascunho" : "Guardar"}
            </button>
          )}
          {props.canPublish && (
            <button className={s.btn} disabled={pending} onClick={() => save(p.status === "scheduled" ? "scheduled" : "published")}>
              {p.status === "scheduled" ? "Agendar" : "Publicar"}
            </button>
          )}
        </div>
      </div>
      {result && !result.ok && <div className={s.error}>{result.message}</div>}

      <div className={s.split}>
        <div className={s.stack}>
          <section className={s.card}>
            <h2 className={s.h2}>Informação</h2>
            <div className={s.row3}>
              <label className={s.label}>
                Código
                <input className={s.input} value={p.code} readOnly={ro} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="ex.: 8G1L7" />
              </label>
              <label className={s.label} style={{ gridColumn: "span 2" }}>
                Nome da peça (PT)
                <input className={s.input} value={p.name.pt} readOnly={ro} onChange={(e) => set({ name: { ...p.name, pt: e.target.value } })} />
              </label>
            </div>
            <label className={s.label}>
              Nome da peça (EN)
              <input className={s.input} value={p.name.en} readOnly={ro} onChange={(e) => set({ name: { ...p.name, en: e.target.value } })} />
            </label>
            <div className={s.row2}>
              <label className={s.label}>
                Descrição (PT)
                <textarea className={s.textarea} rows={4} value={p.description.pt} readOnly={ro} onChange={(e) => set({ description: { ...p.description, pt: e.target.value } })} />
              </label>
              <label className={s.label}>
                Descrição (EN)
                <textarea className={s.textarea} rows={4} value={p.description.en} readOnly={ro} onChange={(e) => set({ description: { ...p.description, en: e.target.value } })} />
              </label>
            </div>
            <div className={s.row2}>
              <label className={s.label}>
                Composição e cuidados (PT)
                <textarea className={s.textarea} rows={2} value={p.composition.pt} readOnly={ro} onChange={(e) => set({ composition: { ...p.composition, pt: e.target.value } })} />
              </label>
              <label className={s.label}>
                Composição e cuidados (EN)
                <textarea className={s.textarea} rows={2} value={p.composition.en} readOnly={ro} onChange={(e) => set({ composition: { ...p.composition, en: e.target.value } })} />
              </label>
            </div>
            <span className={s.hint}>Frases curtas, em português de Moçambique. Sem emojis. *palavra* fica em itálico.</span>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.h2}>Fotografias</h2>
              <span className={s.muted}>{p.images.length} de 8</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {p.images.map((img, i) => (
                <div key={img.url} className={s.fieldset}>
                  <div style={{ position: "relative", aspectRatio: "4 / 5", background: "var(--blush-light)" }}>
                    <Image src={img.url} alt={img.alt.pt} fill sizes="160px" style={{ objectFit: "cover" }} />
                    {i === 0 && (
                      <span className={s.chip} data-tone="dark" style={{ position: "absolute", left: 8, top: 8 }}>
                        Principal
                      </span>
                    )}
                  </div>
                  {!ro && (
                    <div className={s.actions} style={{ gap: 4 }}>
                      <button className={`${s.btnOutline} ${s.small}`} onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Mover para a esquerda">
                        ←
                      </button>
                      <button className={`${s.btnOutline} ${s.small}`} onClick={() => moveImage(i, 1)} disabled={i === p.images.length - 1} aria-label="Mover para a direita">
                        →
                      </button>
                      <button className={`${s.btnDanger} ${s.small}`} onClick={() => set({ images: p.images.filter((_, j) => j !== i) })} aria-label="Remover fotografia">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  )}
                  <label className={s.label}>
                    Texto alternativo (PT)
                    <input className={s.input} value={img.alt.pt} readOnly={ro} onChange={(e) => set({ images: p.images.map((x, j) => (j === i ? { ...x, alt: { ...x.alt, pt: e.target.value } } : x)) })} />
                  </label>
                  <label className={s.label}>
                    (EN)
                    <input className={s.input} value={img.alt.en} readOnly={ro} onChange={(e) => set({ images: p.images.map((x, j) => (j === i ? { ...x, alt: { ...x.alt, en: e.target.value } } : x)) })} />
                  </label>
                  {p.colors.length > 1 && (
                    <select className={s.select} value={img.color ?? ""} disabled={ro} onChange={(e) => set({ images: p.images.map((x, j) => (j === i ? { ...x, color: e.target.value || null } : x)) })} aria-label="Cor da fotografia">
                      <option value="">Todas as cores</option>
                      {p.colors.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name.pt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {!ro && p.images.length < 8 && (
                <label
                  style={{ aspectRatio: "4 / 5", border: "1px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 12, cursor: "pointer", fontSize: 13, color: "var(--ink-muted)" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    upload(e.dataTransfer.files);
                  }}
                >
                  <Icon name="upload" />
                  {uploading ? "A carregar…" : "Arraste fotos ou escolha ficheiros"}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
                </label>
              )}
            </div>
            <span className={s.hint}>Retrato 4:5, luz natural, fundo neutro. JPG ou WebP até 5 MB. A primeira é a principal. Sem fotografia, a peça não aparece na loja.</span>
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Preço e stock</h2>
            <div className={s.row2}>
              <label className={s.label}>
                Preço (MT)
                <input className={s.input} inputMode="numeric" value={fmt(p.price)} readOnly={ro} onChange={(e) => set({ price: digits(e.target.value) })} />
              </label>
              <label className={s.label}>
                Preço em saldo (MT)
                <input className={s.input} inputMode="numeric" placeholder="Opcional" value={fmt(p.salePrice ?? 0)} readOnly={ro} onChange={(e) => set({ salePrice: digits(e.target.value) || null })} />
                <span className={s.hint}>Mostra o preço antigo riscado e o selo Saldos.</span>
              </label>
            </div>

            <div className={s.fieldset}>
              <span className={s.legend}>Cores</span>
              {p.colors.map((c, i) => (
                <div key={i} className={s.row3} style={{ gridTemplateColumns: "1fr 1fr 110px 150px auto", alignItems: "end" }}>
                  <label className={s.label}>
                    Nome (PT)
                    <input className={s.input} value={c.name.pt} readOnly={ro} onChange={(e) => set({ colors: p.colors.map((x, j) => (j === i ? { ...x, name: { ...x.name, pt: e.target.value } } : x)) })} />
                  </label>
                  <label className={s.label}>
                    Nome (EN)
                    <input className={s.input} value={c.name.en} readOnly={ro} onChange={(e) => set({ colors: p.colors.map((x, j) => (j === i ? { ...x, name: { ...x.name, en: e.target.value } } : x)) })} />
                  </label>
                  <label className={s.label}>
                    Cor
                    <input className={s.input} type="color" value={c.hex ?? "#ffffff"} disabled={ro} onChange={(e) => set({ colors: p.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} style={{ padding: 4 }} />
                  </label>
                  <label className={s.label}>
                    Filtro
                    <select className={s.select} value={c.family ?? ""} disabled={ro} onChange={(e) => set({ colors: p.colors.map((x, j) => (j === i ? { ...x, family: (e.target.value || null) as ColorFamily | null } : x)) })}>
                      <option value="">—</option>
                      {COLOR_FAMILIES.map((f) => (
                        <option key={f} value={f}>
                          {FAMILY_PT[f]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!ro && (
                    <button className={`${s.btnDanger} ${s.small}`} onClick={() => set({ colors: p.colors.filter((_, j) => j !== i), variants: p.variants.map((v) => (v.color === c.key ? { ...v, color: null } : v)) })} aria-label="Remover cor">
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              ))}
              {!ro && (
                <button
                  className={`${s.btnOutline} ${s.small}`}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => set({ colors: [...p.colors, { key: `cor-${Date.now().toString(36)}`, name: { pt: "", en: "" }, hex: "#FFFFFF", family: null }] })}
                >
                  <Icon name="plus" size={14} />
                  Adicionar cor
                </button>
              )}
            </div>

            <table className={s.table}>
              <thead>
                <tr>
                  <th>Tamanho</th>
                  <th>Cor</th>
                  <th>Stock</th>
                  <th>Loja</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v, i) => {
                  const editable = !ro && (props.stores.find((st) => st.code === v.storeCode)?.editable ?? false);
                  const upd = (patch: Partial<EditorProduct["variants"][number]>) => set({ variants: p.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <tr key={v.id ?? `n${i}`}>
                      <td>
                        <input className={s.input} value={v.size} readOnly={!editable} onChange={(e) => upd({ size: e.target.value })} placeholder="6US/38EUR/S" aria-label="Tamanho" />
                      </td>
                      <td>
                        <select className={s.select} value={v.color ?? ""} disabled={!editable} onChange={(e) => upd({ color: e.target.value || null })} aria-label="Cor">
                          <option value="">—</option>
                          {p.colors.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.name.pt || c.key}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ width: 110 }}>
                        <input className={s.input} type="number" min={0} value={v.stock} readOnly={!editable} onChange={(e) => upd({ stock: Math.max(0, Number(e.target.value)) })} aria-label={`Stock ${v.size}`} />
                      </td>
                      <td>
                        <select className={s.select} value={v.storeCode} disabled={!editable} onChange={(e) => upd({ storeCode: e.target.value })} aria-label="Loja">
                          {props.stores.filter((st) => st.editable || st.code === v.storeCode).map((st) => (
                            <option key={st.code} value={st.code}>
                              Loja {st.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {editable && (
                          <button className={`${s.btnDanger} ${s.small}`} onClick={() => set({ variants: p.variants.filter((_, j) => j !== i) })} aria-label="Remover tamanho">
                            <Icon name="close" size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!ro && (
              <button
                className={`${s.btnOutline} ${s.small}`}
                style={{ alignSelf: "flex-start" }}
                onClick={() => set({ variants: [...p.variants, { size: "", color: p.colors[0]?.key ?? null, storeCode: props.stores.find((st) => st.editable)?.code ?? props.stores[0].code, stock: 1 }] })}
              >
                <Icon name="plus" size={14} />
                Adicionar tamanho
              </button>
            )}
            {lowStock && (
              <div className={s.warning}>
                <Icon name="alert" size={18} />
                <span>
                  <strong style={{ fontWeight: 500 }}>Atenção:</strong>{" "}
                  {stock === 0 ? "sem stock — a peça aparece como esgotada na loja." : "há tamanhos com a última unidade ou esgotados."}
                </span>
              </div>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Pesquisa no Google</h2>
            <label className={s.label}>
              Título da página
              <input className={s.input} value={p.seoTitle} placeholder={seo} readOnly={ro} onChange={(e) => set({ seoTitle: e.target.value })} />
              <span className={s.hint}>Gerado a partir do nome; pode ser editado.</span>
            </label>
            <div style={{ padding: 16, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
              <span className={s.muted}>eterna.co.mz › pt › product › {p.code.toLowerCase() || "codigo"}</span>
              <span style={{ fontSize: 18, color: "#1a0dab" }}>{seo}</span>
              <span className={s.muted}>
                {fmt(p.salePrice ?? p.price)} MT · {p.description.pt.slice(0, 130) || "Descrição da peça."} Glória Mall, Maputo.
              </span>
            </div>
          </section>
        </div>

        <div className={s.stack}>
          <section className={s.card}>
            <h2 className={s.h2}>Publicação</h2>
            <div role="radiogroup" aria-label="Estado" className={s.fieldset}>
              {(
                [
                  ["published", "Publicado na loja"],
                  ["draft", "Rascunho (só a equipa vê)"],
                  ["scheduled", "Agendar publicação"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className={s.check}>
                  <input type="radio" name="estado" checked={p.status === id} disabled={!props.canPublish} onChange={() => set({ status: id })} />
                  {label}
                </label>
              ))}
            </div>
            {!props.canPublish && <span className={s.hint}>Só a Administração publica ou tira peças da loja.</span>}
            {p.status === "scheduled" && (
              <label className={s.label}>
                Publicar em
                <input className={s.input} type="datetime-local" value={p.publishAt ?? ""} disabled={!props.canPublish} onChange={(e) => set({ publishAt: e.target.value })} />
              </label>
            )}
            <label className={s.check}>
              <input type="checkbox" checked={p.isNew} disabled={ro} onChange={() => set({ isNew: !p.isNew })} />
              Mostrar selo “Novo”
            </label>
            {props.canPublish && p.id && p.status !== "archived" && (
              <button
                className={s.linkBtn}
                style={{ alignSelf: "flex-start", color: "var(--danger)" }}
                onClick={() =>
                  window.confirm("Arquivar este produto? Deixa de aparecer na loja; as encomendas antigas mantêm-se.") &&
                  start(async () => {
                    setResult(await archiveProductAction(p.id!));
                    router.refresh();
                  })
                }
              >
                Arquivar produto
              </button>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Organização</h2>
            <label className={s.label}>
              Colecção
              <select className={s.select} value={p.collectionId ?? ""} disabled={ro} onChange={(e) => set({ collectionId: e.target.value || null })}>
                <option value="">—</option>
                {props.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Tipo de peça
              <select className={s.select} value={p.typeId ?? ""} disabled={ro} onChange={(e) => set({ typeId: e.target.value || null })}>
                <option value="">—</option>
                {props.types.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>Ocasiões</legend>
              <div className={s.checks} style={{ flexDirection: "column" }}>
                {props.occasions.map((o) => (
                  <label key={o.id}>
                    <input
                      type="checkbox"
                      disabled={ro}
                      checked={p.occasionIds.includes(o.id)}
                      onChange={() => set({ occasionIds: p.occasionIds.includes(o.id) ? p.occasionIds.filter((x) => x !== o.id) : [...p.occasionIds, o.id] })}
                    />
                    {o.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className={s.card}>
            <span className={s.legend}>Como aparece na loja</span>
            <div style={{ position: "relative", aspectRatio: "4 / 5", background: "var(--blush-light)" }}>
              {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="300px" style={{ objectFit: "cover" }} />}
              {p.isNew && (
                <span className={s.chip} style={{ position: "absolute", left: 10, top: 10, background: "var(--ivory)", color: "var(--ink)" }}>
                  Novo
                </span>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
              <span className={s.strong}>{p.code || "CÓDIGO"}</span>
              <span>{fmt(p.salePrice ?? p.price) || "0"},00 MT</span>
            </div>
            <span className={s.muted}>{p.name.pt}</span>
          </section>
        </div>
      </div>
    </>
  );
}
