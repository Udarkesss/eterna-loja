"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { PRICE_RANGES, SIZE_LETTERS, type PriceRange } from "@/lib/filters";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { COLOR_FAMILIES, type ColorFamily } from "@/types";
import { useFilterParams } from "./useFilterParams";
import styles from "./Category.module.css";

/** EN: Swatch colours of the colour filter (design V3). PT: Cores das amostras do filtro de cor. */
export const SWATCHES: Record<ColorFamily, string> = {
  black: "#111111",
  off_white: "#FFFFFF",
  beige: "#E9D9B6",
  fuchsia: "#E58FA8",
  red: "#B3202A",
  blue: "#2F5BB7",
  green: "#2E7D4F",
  gold: "#C8A24A",
};
const COLOR_ORDER: ColorFamily[] = ["black", "off_white", "beige", "fuchsia", "red", "blue", "green", "gold"];


const SORT_KEYS = ["recommended", "newest", "price_asc", "price_desc"] as const;

/**
 * EN: Bar above the grid (design V3): "Filtros" + active filters + "Limpar tudo" · count · "Ordenar". On phones:
 *     "Filtrar" (opens the filters as a full-screen panel) and the sort button.
 * PT: Barra por cima da grelha: "Filtros" + filtros activos · contagem · "Ordenar". No telemóvel: "Filtrar" (abre os
 *     filtros em ecrã inteiro) e o botão de ordenar.
 */
export function CategoryToolbar({ total }: { total: number }) {
  const { dict } = useI18n();
  const { values, update, toggle, params } = useFilterParams();
  const [open, setOpen] = useState(false);
  const sizes = values("size");
  const colors = values("color") as ColorFamily[];
  const prices = values("price") as PriceRange[];
  const sale = params.get("sale") === "1";
  const chips = [
    ...sizes.map((s) => ({ key: "size", value: s, label: s })),
    ...colors.map((c) => ({ key: "color", value: c, label: dict.catalog.colors[c] ?? c })),
    ...prices.map((p) => ({ key: "price", value: p, label: dict.catalog.priceRanges[p] ?? p })),
    ...(sale ? [{ key: "sale", value: "1", label: dict.catalog.onSale }] : []),
  ];

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sort = (
    <select
      className={styles.select}
      aria-label={dict.catalog.sort}
      value={params.get("sort") ?? "recommended"}
      onChange={(e) => update({ sort: e.target.value === "recommended" ? null : e.target.value })}
    >
      {SORT_KEYS.map((key) => (
        <option key={key} value={key}>
          {dict.catalog.sortOptions[key]}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className={`page-x ${styles.toolbar}`}>
        <div className={styles.chips}>
          <span className={styles.label}>{dict.catalog.filters}</span>
          {chips.map((c) => (
            <button
              key={`${c.key}-${c.value}`}
              type="button"
              className={styles.activeChip}
              onClick={() => (c.key === "sale" ? update({ sale: null }) : toggle(c.key, c.value))}
              aria-label={t(dict.catalog.removeFilter, { name: c.label })}
            >
              {c.label}
              <Icon name="close" size={14} />
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className={styles.clear} onClick={() => update({ size: null, color: null, price: null, sale: null })}>
              {dict.catalog.clearAll}
            </button>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.count}>{plural(dict.catalog.count, total)}</span>
          <label className={styles.sortLabel}>
            <span className={styles.label}>{dict.catalog.sort}</span>
            {sort}
          </label>
        </div>
      </div>

      {/* EN: Phone bar. PT: Barra do telemóvel. */}
      <div className={`page-x ${styles.phoneBar}`}>
        <button type="button" className={styles.phoneButton} onClick={() => setOpen(true)} aria-expanded={open}>
          <Icon name="filter" size={18} />
          {dict.catalog.filterButton}
          {chips.length > 0 && <span className={styles.phoneCount}>{chips.length}</span>}
        </button>
        <label className={styles.phoneButton}>
          <Icon name="sort" size={18} />
          {sort}
        </label>
      </div>
      <p className={`page-x ${styles.phoneTotal}`}>{plural(dict.catalog.count, total)}</p>

      {open && (
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={dict.catalog.filters}>
          <div className={styles.sheetTop}>
            <span className={styles.label}>{dict.catalog.filters}</span>
            <button type="button" className={styles.sheetClose} aria-label={dict.common.close} onClick={() => setOpen(false)}>
              <Icon name="close" size={22} />
            </button>
          </div>
          <CategoryFilters inSheet />
          <div className={styles.sheetBottom}>
            <button type="button" className={styles.clear} onClick={() => update({ size: null, color: null, price: null, sale: null })}>
              {dict.catalog.clearAll}
            </button>
            <button type="button" className={styles.sheetApply} onClick={() => setOpen(false)}>
              {plural(dict.catalog.seeResults, total)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * EN: Side filters of design V3: Tamanho (letters + size guide) · Cor (8 swatches with names) · Preço · Disponibilidade
 *     ("em campanha") · "Não encontra o que procura?" with WhatsApp.
 * PT: Filtros laterais do V3: Tamanho (letras + guia) · Cor (8 amostras com nome) · Preço · Disponibilidade · "Não
 *     encontra o que procura?" com WhatsApp.
 */
export function CategoryFilters({ inSheet = false }: { inSheet?: boolean }) {
  const { dict, href } = useI18n();
  const { values, toggle, update, params } = useFilterParams();
  const sizes = values("size");
  const colors = values("color");
  const prices = values("price");
  const sale = params.get("sale") === "1";

  return (
    <aside aria-label={dict.catalog.filters} className={inSheet ? styles.sheetBody : styles.aside}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{dict.catalog.size}</legend>
        <div className={styles.sizes}>
          {SIZE_LETTERS.map((size) => (
            <button key={size} type="button" className={styles.sizeChip} aria-pressed={sizes.includes(size)} onClick={() => toggle("size", size)}>
              {size}
            </button>
          ))}
        </div>
        <a href={href("/info/tamanhos")} className={styles.guide}>
          <Icon name="ruler" size={14} />
          {dict.product.sizeGuide}
        </a>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{dict.catalog.color}</legend>
        <div className={styles.colors}>
          {COLOR_ORDER.filter((f) => COLOR_FAMILIES.includes(f)).map((family) => (
            <button
              key={family}
              type="button"
              className={styles.color}
              aria-pressed={colors.includes(family)}
              onClick={() => toggle("color", family)}
            >
              <span className={styles.swatch} style={{ background: SWATCHES[family] }} />
              <span>{dict.catalog.colors[family]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{dict.catalog.price}</legend>
        {PRICE_RANGES.map((range) => (
          <label key={range} className={styles.check}>
            <input type="checkbox" checked={prices.includes(range)} onChange={() => toggle("price", range)} />
            {dict.catalog.priceRanges[range]}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{dict.catalog.availability}</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={sale} onChange={() => update({ sale: sale ? null : "1" })} />
          {dict.catalog.onSale}
        </label>
      </fieldset>

      {!inSheet && <HelpBox />}
    </aside>
  );
}

/** EN: "Não encontra o que procura?" (also at the end of the list). PT: Também no fim da lista. */
export function HelpBox() {
  const { dict } = useI18n();
  return (
    <div className={styles.help}>
      <span className={styles.helpTitle}>{dict.catalog.helpTitle}</span>
      <span className={styles.helpBody}>{dict.catalog.helpBody}</span>
      <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={styles.helpLink}>
        <Icon name="whatsapp" size={16} />
        {dict.common.whatsapp}
      </a>
    </div>
  );
}

/** EN: Empty state + "Limpar filtros". PT: Estado vazio + "Limpar filtros". */
export function CategoryEmpty() {
  const { dict } = useI18n();
  const { update } = useFilterParams();
  return (
    <div role="status" className={styles.empty}>
      <span className={styles.emptyTitle}>{dict.catalog.emptyTitle}</span>
      <span className={styles.emptyBody}>{dict.catalog.emptyBody}</span>
      <button type="button" className={styles.emptyButton} onClick={() => update({ size: null, color: null, price: null, sale: null, type: null })}>
        {dict.catalog.clearFilters}
      </button>
    </div>
  );
}
