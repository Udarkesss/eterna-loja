"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { archiveProductAction, saveProductAction, uploadProductImageAction, type ProductActionResult } from "@/app/gestao/actions/products";
import { Icon } from "@/components/ui/Icon";
import { sizeParts, sortSizes } from "@/lib/sizes";
import { PALETTE, SIZE_SYSTEMS } from "@/data/palette";
import type { ColorFamily, Localized, ProductStatus } from "@/types";
import c from "./AdminV3.module.css";
import d3 from "./Dashboard.module.css";
import e from "./ProductEditor.module.css";

/**
 * EN: "Gestão · Editar produto" of design V3-G-Produto-Editar: Informação (code, name, type, price · sale, description),
 *     Cores e tamanhos (colour palette, size system, units per colour and size for each store; combinations at 0 are
 *     struck through on the site), Fotografias por cor; Publicação (published, "Pode ir a prova"), Colecções e ocasiões,
 *     and how the card looks in the lists. English texts stay in "Textos em inglês" (the store is bilingual).
 * PT: Editar produto do V3: Informação, Cores e tamanhos (paleta, sistema de tamanhos, unidades por cor e tamanho em cada
 *     loja; as combinações a 0 ficam riscadas no site), Fotografias por cor; Publicação, Colecções e ocasiões e como
 *     aparece nas listas. Os textos em inglês ficam em "Textos em inglês".
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
  collectionIds: string[];
  occasionIds: string[];
  fitting: boolean;
  colors: { key: string; name: Localized; hex: string | null; family: ColorFamily | null }[];
  variants: { id?: string; size: string; color: string | null; storeCode: string; stock: number }[];
  images: { id?: string; url: string; alt: Localized; color: string | null }[];
}

type Opt = { id: string; name: string; note?: string };

const systemOf = (sizes: string[]) =>
  (Object.keys(SIZE_SYSTEMS).find((k) => sizes.length > 0 && sizes.every((x) => SIZE_SYSTEMS[k].sizes.includes(x))) ?? (sizes.some((x) => /\//.test(x)) ? "clothing" : "letters")) as keyof typeof SIZE_SYSTEMS;
const sizeTop = (x: string) => sizeParts(x).letter;
const sizeSub = (x: string) => sizeParts(x).detail ?? (/^\d+(\.\d)?$/.test(x) ? `${x} US` : "");
const digits = (v: string) => Number(v.replace(/[^\d,]/g, "").split(",")[0]) || 0;
const mt = (n: number) => (n ? `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},00 MT` : "");

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
  const [uploading, setUploading] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [colorQuery, setColorQuery] = useState("");
  const firstStore = props.stores.find((x) => x.editable)?.code ?? props.stores[0]?.code ?? "02";
  const [store, setStore] = useState(p.variants[0]?.storeCode ?? firstStore);
  const usedSizes = useMemo(() => sortSizes([...new Set(p.variants.map((v) => v.size))]), [p.variants]);
  const [system, setSystem] = useState<keyof typeof SIZE_SYSTEMS>(systemOf(usedSizes));
  const [onSizes, setOnSizes] = useState<string[]>(usedSizes);
  const fileFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ro = !props.canEdit;
  const storeEditable = !ro && (props.stores.find((x) => x.code === store)?.editable ?? false);

  const set = (patch: Partial<EditorProduct>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setDirty(true);
    setResult(null);
  };

  // ── Colours / Cores ──
  function addColor(name: string, en: string, hex: string, family: ColorFamily | null) {
    if (p.colors.some((x) => x.name.pt === name)) return;
    const key = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
    set({ colors: [...p.colors, { key, name: { pt: name, en }, hex, family }] });
  }
  function removeColor(key: string) {
    set({ colors: p.colors.filter((x) => x.key !== key), variants: p.variants.filter((v) => v.color !== key), images: p.images.map((i) => (i.color === key ? { ...i, color: null } : i)) });
  }

  // ── Sizes and units / Tamanhos e unidades ──
  const colorRows = p.colors.length ? p.colors.map((x) => x.key) : [null];
  const unitsOf = (color: string | null, size: string) => p.variants.find((v) => v.color === color && v.size === size && v.storeCode === store);
  function setUnits(color: string | null, size: string, value: number) {
    const found = unitsOf(color, size);
    if (found) set({ variants: p.variants.map((v) => (v === found ? { ...v, stock: Math.max(0, value) } : v)) });
    else set({ variants: [...p.variants, { size, color, storeCode: store, stock: Math.max(0, value) }] });
  }
  function toggleSize(size: string) {
    if (onSizes.includes(size)) {
      setOnSizes(onSizes.filter((x) => x !== size));
      set({ variants: p.variants.filter((v) => v.size !== size || v.stock > 0) });
    } else setOnSizes(sortSizes([...onSizes, size]));
  }
  const total = p.variants.filter((v) => v.storeCode === store).reduce((n, v) => n + v.stock, 0);
  const systemSizes = sortSizes([...new Set([...SIZE_SYSTEMS[system].sizes, ...usedSizes.filter((x) => systemOf([x]) === system)])]);

  // ── Photos per colour / Fotografias por cor ──
  async function upload(files: FileList | null, color: string | null) {
    if (!files?.length) return;
    setUploading(color ?? "all");
    const added: EditorProduct["images"] = [];
    for (const file of Array.from(files).slice(0, 12)) {
      const form = new FormData();
      form.set("file", file);
      const r = await uploadProductImageAction(form);
      const colorName = p.colors.find((x) => x.key === color)?.name;
      if (r.ok && r.url) added.push({ url: r.url, alt: { pt: [p.code || "Peça", colorName?.pt].filter(Boolean).join(" · "), en: [p.code || "Piece", colorName?.en].filter(Boolean).join(" · ") }, color });
      else setResult(r);
    }
    set({ images: [...p.images, ...added] });
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
  }
  const groups: { key: string | null; name: string; hex: string | null }[] = [...p.colors.map((x) => ({ key: x.key, name: x.name.pt, hex: x.hex })), { key: null, name: "Todas as cores", hex: null }];

  // ── Save / Guardar ──
  function save() {
    start(async () => {
      const r = await saveProductAction({
        ...p,
        variants: p.variants.filter((v) => onSizes.includes(v.size) || v.stock > 0),
        composition: p.composition.pt || p.composition.en ? p.composition : null,
        seoTitle: p.seoTitle || null,
      });
      setResult(r);
      if (r.ok) {
        setDirty(false);
        if (!p.id && r.id) router.replace(`/gestao/produtos/${r.id}`);
        else router.refresh();
      }
    });
  }
  function archive() {
    if (!p.id || !window.confirm(`Arquivar o ${p.code}? Deixa de aparecer na loja; as encomendas antigas mantêm-se.`)) return;
    start(async () => {
      const r = await archiveProductAction(p.id!);
      setResult(r);
      if (r.ok) router.push("/gestao/produtos");
    });
  }

  const cardImage = p.images.find((i) => i.color === (p.colors[0]?.key ?? null)) ?? p.images[0];
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <>
      <div className={e.bar}>
        <span>
          {dirty ? (
            <span className={c.st} data-tone="warn">
              Alterações por guardar
            </span>
          ) : result?.ok ? (
            <span className={c.st} data-tone="ok">
              {result.message}
            </span>
          ) : null}
          {result && !result.ok && (
            <span role="alert" className={c.err}>
              {result.message}
            </span>
          )}
        </span>
        <span className={c.row}>
          {p.id && (
            <a href={`/pt/product/${p.code.toLowerCase()}`} target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
              <Icon name="eye" size={15} />
              Pré-visualizar
            </a>
          )}
          {props.canEdit && (
            <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending} onClick={save}>
              Guardar
            </button>
          )}
        </span>
      </div>

      <div className={e.cols}>
        <div className={e.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Informação</h2>
            </div>
            <div className={e.body}>
              <div className={e.codeName}>
                <label className={c.field}>
                  <span className={c.lbl}>Código</span>
                  <input className={c.input} value={p.code} readOnly={ro} onChange={(ev) => set({ code: ev.target.value.toUpperCase() })} placeholder="ex.: SUIT311" />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Nome</span>
                  <input className={c.input} value={p.name.pt} readOnly={ro} onChange={(ev) => set({ name: { ...p.name, pt: ev.target.value } })} />
                </label>
              </div>
              <div className={c.half}>
                <label className={c.field}>
                  <span className={c.lbl}>Tipo de peça</span>
                  <select className={c.select} value={p.typeId ?? ""} disabled={ro} onChange={(ev) => set({ typeId: ev.target.value || null })}>
                    <option value="">—</option>
                    {props.types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.note ? ` · ${t.note}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className={c.help}>A lista vem de Catálogo → Tipos de peça.</span>
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Preço · saldo</span>
                  <span className={c.row} style={{ gap: 8 }}>
                    <input className={`${c.input} ${c.num}`} inputMode="numeric" value={mt(p.price)} readOnly={ro} onChange={(ev) => set({ price: digits(ev.target.value) })} />
                    <input className={`${c.input} ${c.num}`} inputMode="numeric" placeholder="Preço de saldo" value={mt(p.salePrice ?? 0)} readOnly={ro} onChange={(ev) => set({ salePrice: digits(ev.target.value) || null })} />
                  </span>
                </label>
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Descrição</span>
                <textarea className={`${c.input} ${e.area}`} value={p.description.pt} readOnly={ro} onChange={(ev) => set({ description: { ...p.description, pt: ev.target.value } })} />
              </label>
              <details className={e.more}>
                <summary>Textos em inglês e composição</summary>
                <div className={e.body} style={{ padding: "14px 0 0" }}>
                  <label className={c.field}>
                    <span className={c.lbl}>Nome (EN)</span>
                    <input className={c.input} value={p.name.en} readOnly={ro} onChange={(ev) => set({ name: { ...p.name, en: ev.target.value } })} />
                  </label>
                  <label className={c.field}>
                    <span className={c.lbl}>Descrição (EN)</span>
                    <textarea className={`${c.input} ${e.area}`} value={p.description.en} readOnly={ro} onChange={(ev) => set({ description: { ...p.description, en: ev.target.value } })} />
                  </label>
                  <div className={c.half}>
                    <label className={c.field}>
                      <span className={c.lbl}>Composição e cuidados</span>
                      <textarea className={`${c.input} ${e.area}`} value={p.composition.pt} readOnly={ro} onChange={(ev) => set({ composition: { ...p.composition, pt: ev.target.value } })} />
                    </label>
                    <label className={c.field}>
                      <span className={c.lbl}>(EN)</span>
                      <textarea className={`${c.input} ${e.area}`} value={p.composition.en} readOnly={ro} onChange={(ev) => set({ composition: { ...p.composition, en: ev.target.value } })} />
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Cores e tamanhos</h2>
              <select className={c.select} style={{ width: 140 }} value={store} onChange={(ev) => setStore(ev.target.value)} aria-label="Loja">
                {props.stores.map((x) => (
                  <option key={x.code} value={x.code}>
                    Loja {Number(x.code)}
                  </option>
                ))}
              </select>
            </div>
            <div className={e.body}>
              <span className={c.label}>Cores</span>
              <div className={e.chips}>
                {p.colors.map((x) => (
                  <span key={x.key} className={e.chip} data-on>
                    <span className={e.dot} style={{ background: x.hex ?? "var(--alt)" }} />
                    {x.name.pt}
                    {!ro && (
                      <button type="button" aria-label={`Tirar ${x.name.pt}`} onClick={() => removeColor(x.key)}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {!ro && (
                  <button type="button" className={e.chip} data-dashed onClick={() => setPicker(!picker)}>
                    <Icon name="plus" size={14} /> Cor
                  </button>
                )}
              </div>
              {picker && !ro && (
                <div className={e.picker}>
                  <label className={d3.search}>
                    <Icon name="search" size={16} />
                    <input value={colorQuery} onChange={(ev) => setColorQuery(ev.target.value)} placeholder="Procurar cor…" aria-label="Procurar cor" />
                  </label>
                  <div className={e.palette}>
                    {PALETTE.filter(([name]) => !colorQuery || name.toLowerCase().includes(colorQuery.toLowerCase())).map(([name, en, hex, family]) => (
                      <button key={name} type="button" onClick={() => addColor(name, en, hex, family)}>
                        <span
                          className={e.swatch}
                          data-ring={p.colors.some((x) => x.name.pt === name) || undefined}
                          style={{ background: name === "Multicolor" ? "conic-gradient(#B3202A,#E9C93F,#2E7D4F,#2F5BB7,#B3202A)" : hex }}
                        />
                        <span>{name}</span>
                      </button>
                    ))}
                  </div>
                  <span className={c.xsMuted}>Combinação: escolha duas cores (ex.: Preto e Dourado). Estampados: use a cor principal.</span>
                </div>
              )}

              <span className={c.row} style={{ gap: 12, marginTop: 6 }}>
                <span className={c.label}>Tamanhos</span>
                <select className={c.select} style={{ width: 260 }} value={system} disabled={ro} onChange={(ev) => setSystem(ev.target.value as keyof typeof SIZE_SYSTEMS)}>
                  {Object.entries(SIZE_SYSTEMS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </span>
              <div className={e.chips}>
                {systemSizes.map((x) => (
                  <button key={x} type="button" className={e.chip} data-on={onSizes.includes(x) || undefined} disabled={ro} onClick={() => toggleSize(x)}>
                    {sizeTop(x)} {sizeSub(x) && <span className={c.xsMuted}>{sizeSub(x)}</span>}
                  </button>
                ))}
              </div>

              <span className={c.label} style={{ marginTop: 6 }}>
                Unidades por cor e tamanho · Loja {Number(store)}
              </span>
              {onSizes.length === 0 ? (
                <span className={c.xsMuted}>Escolha os tamanhos acima.</span>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className={e.matrix}>
                    <thead>
                      <tr>
                        <th>Cor \ tamanho</th>
                        {onSizes.map((x) => (
                          <th key={x}>
                            {sizeTop(x)}
                            {sizeSub(x) && (
                              <>
                                <br />
                                <span>{sizeSub(x)}</span>
                              </>
                            )}
                          </th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colorRows.map((key) => {
                        const color = p.colors.find((x) => x.key === key);
                        const rowTotal = onSizes.reduce((n, x) => n + (unitsOf(key, x)?.stock ?? 0), 0);
                        return (
                          <tr key={key ?? "u"}>
                            <th>
                              <span className={c.row} style={{ gap: 8 }}>
                                {color && <span className={e.dot} style={{ background: color.hex ?? "var(--alt)" }} />}
                                {color?.name.pt ?? "Sem cor"}
                              </span>
                            </th>
                            {onSizes.map((x) => {
                              const n = unitsOf(key, x)?.stock ?? 0;
                              return (
                                <td key={x} data-off={n === 0 || undefined}>
                                  <input
                                    value={n}
                                    inputMode="numeric"
                                    readOnly={!storeEditable}
                                    aria-label={`${color?.name.pt ?? "Sem cor"} ${x}`}
                                    onChange={(ev) => setUnits(key, x, Number(ev.target.value.replace(/\D/g, "")) || 0)}
                                  />
                                </td>
                              );
                            })}
                            <td>
                              <b className={c.num}>{rowTotal}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <span className={c.xsMuted}>
                As combinações a 0 ficam riscadas no site. Total: {total} {total === 1 ? "unidade" : "unidades"}.
              </span>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Fotografias por cor</h2>
            </div>
            <div className={e.body} style={{ gap: 0 }}>
              <div className={c.note} style={{ marginBottom: 6 }}>
                <Icon name="image" size={16} />
                <span>Fotos de produto: 3:4 · mínimo 1200 × 1600 px · JPG ou WebP · até 2 MB. Cada foto pertence a uma cor ou a “Todas as cores” (pormenores, etiqueta).</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(ev) => upload(ev.target.files, fileFor.current)}
              />
              {groups.map((g) => {
                const imgs = p.images.map((img, i) => ({ img, i })).filter(({ img }) => img.color === g.key || (g.key === null && !p.colors.some((x) => x.key === img.color)));
                return (
                  <div key={g.key ?? "all"} className={e.group}>
                    <span className={c.row} style={{ gap: 8, fontSize: 14 }}>
                      {g.hex ? <span className={e.dot} style={{ background: g.hex }} /> : <Icon name="image" size={16} />}
                      <b style={{ fontWeight: 500 }}>{g.name}</b>
                      <span className={c.xsMuted}>
                        · {imgs.length} {imgs.length === 1 ? "foto" : "fotos"}
                      </span>
                    </span>
                    <div className={c.row} style={{ gap: 10, flexWrap: "wrap" }}>
                      {imgs.map(({ img, i }) => (
                        <div key={img.url} className={e.photo}>
                          <Image src={img.url} alt={img.alt.pt} width={96} height={128} />
                          {!ro && (
                            <button type="button" className={e.remove} aria-label="Tirar fotografia" onClick={() => set({ images: p.images.filter((_, j) => j !== i) })}>
                              <Icon name="close" size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!ro && (
                        <button
                          type="button"
                          className={e.drop}
                          onClick={() => {
                            fileFor.current = g.key;
                            fileRef.current?.click();
                          }}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            void upload(ev.dataTransfer.files, g.key);
                          }}
                        >
                          <Icon name="upload" size={18} />
                          <span className={c.xsMuted}>{uploading === (g.key ?? "all") ? "A carregar…" : "Arraste fotos"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className={e.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Publicação</h2>
            </div>
            <div className={e.body}>
              <label className={c.toggleRow}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.status === "published"}
                  className={c.toggle}
                  disabled={!props.canPublish}
                  onClick={() => set({ status: p.status === "published" ? "draft" : "published" })}
                />
                <span>Publicado · está na loja e no site</span>
              </label>
              <label className={c.toggleRow}>
                <button type="button" role="switch" aria-checked={p.fitting} className={c.toggle} disabled={ro} onClick={() => set({ fitting: !p.fitting })} />
                <span>
                  Pode ir a prova <span className={c.xsMuted}>(só vestidos de noiva)</span>
                </span>
              </label>
              <div className={c.note}>
                <Icon name="info" size={16} />
                <span className={c.small}>Rascunho = no armazém ou a chegar. Não aparece no site.</span>
              </div>
              {p.id && props.canPublish && (
                <button type="button" className={c.textBtn} data-tone="bad" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={archive} disabled={pending}>
                  Arquivar produto
                </button>
              )}
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Colecções e ocasiões</h2>
            </div>
            <div className={e.body}>
              <span className={c.label}>Colecções</span>
              <div className={e.chips}>
                {props.collections.map((x) => (
                  <button key={x.id} type="button" className={e.chip} data-on={p.collectionIds.includes(x.id) || undefined} disabled={ro} onClick={() => set({ collectionIds: toggleIn(p.collectionIds, x.id) })}>
                    {p.collectionIds.includes(x.id) && <Icon name="check" size={12} />}
                    {x.name}
                    {x.note ? ` · ${x.note}` : ""}
                  </button>
                ))}
              </div>
              <span className={c.label}>Ocasiões</span>
              <div className={e.chips}>
                {props.occasions.map((x) => (
                  <button key={x.id} type="button" className={e.chip} data-on={p.occasionIds.includes(x.id) || undefined} disabled={ro} onClick={() => set({ occasionIds: toggleIn(p.occasionIds, x.id) })}>
                    {x.name}
                  </button>
                ))}
              </div>
              <label className={c.toggleRow}>
                <button type="button" role="switch" aria-checked={p.isNew} className={c.toggle} disabled={ro} onClick={() => set({ isNew: !p.isNew })} />
                <span>Selo “Novo”</span>
              </label>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Como aparece nas listas</h2>
            </div>
            <div className={e.body}>
              <div className={e.card}>
                <div className={e.cardImg}>{cardImage && <Image src={cardImage.url} alt="" fill sizes="220px" style={{ objectFit: "cover" }} />}</div>
                <span className={e.cardCode}>{p.code || "CÓDIGO"}</span>
                <span className={c.row} style={{ gap: 4 }}>
                  {p.colors.map((x, i) => (
                    <span key={x.key} className={e.dot} data-ring={i === 0 || undefined} style={{ background: x.hex ?? "var(--alt)" }} />
                  ))}
                  {p.colors[0] && <span className={c.xsMuted}>{p.colors[0].name.pt}</span>}
                </span>
                <span className={c.xsMuted}>{onSizes.map(sizeTop).join(" · ")}</span>
              </div>
              <span className={c.xsMuted}>Preço escondido nas listas (Definições). Na ficha o preço aparece sempre.</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
