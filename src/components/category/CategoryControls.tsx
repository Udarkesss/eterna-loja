"use client";

import { Icon } from "@/components/ui/Icon";
import { SIZE_SCALE } from "@/data/catalog";
import { whatsappLink } from "@/data/site";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { COLOR_FAMILIES, type ColorFamily } from "@/types";
import { useFilterParams } from "./useFilterParams";
import styles from "./Category.module.css";

/** EN: Swatch colours from the design's colour filter. PT: Cores das amostras do filtro do design. */
export const SWATCHES: Record<ColorFamily, string> = {
  blue: "#2F4E8C",
  off_white: "#F4F0E8",
  beige: "#D7C3A8",
  fuchsia: "#B8306E",
  black: "#1C1917",
  red: "#B3261E",
  green: "#4F6B55",
  gold: "#C8A97E",
};

export const PRICE_RANGES = ["upTo20", "from20to30", "over30"] as const;
export type PriceRange = (typeof PRICE_RANGES)[number];

/**
 * EN: The toolbar above the grid: "Filtros" + active filter chips + "Limpar tudo" · count · "Ordenar".
 * PT: A barra por cima da grelha: "Filtros" + filtros activos + "Limpar tudo" · contagem · "Ordenar".
 */
export function CategoryToolbar({ total }: { total: number }) {
  const { dict } = useI18n();
  const { values, update, toggle, params } = useFilterParams();
  const sizes = values("size");
  const colors = values("color") as ColorFamily[];
  const prices = values("price") as PriceRange[];
  const hasFilters = sizes.length + colors.length + prices.length > 0;

  const chips = [
    ...sizes.map((s) => ({ key: "size", value: s, label: s })),
    ...colors.map((c) => ({ key: "color", value: c, label: dict.catalog.colors[c] ?? c })),
    ...prices.map((p) => ({ key: "price", value: p, label: dict.catalog.priceRanges[p] ?? p })),
  ];

  return (
    <div className={`${styles.toolbar}`}>
      <div className={styles.chips}>
        <span className="label">{dict.catalog.filters}</span>
        {chips.map((c) => (
          <button
            key={`${c.key}-${c.value}`}
            type="button"
            className={styles.activeChip}
            onClick={() => toggle(c.key, c.value)}
            aria-label={t(dict.catalog.removeFilter, { name: c.label })}
          >
            {c.label}
            <Icon name="close" size={14} />
          </button>
        ))}
        {hasFilters && (
          <button type="button" className={styles.clear} onClick={() => update({ size: null, color: null, price: null })}>
            {dict.catalog.clearAll}
          </button>
        )}
      </div>
      <div className={styles.toolbarRight}>
        <span className={styles.count}>{plural(hasFilters ? dict.catalog.countFiltered : dict.catalog.count, total)}</span>
        <label className={`label ${styles.sortLabel}`}>
          {dict.catalog.sort}
          <select
            className={styles.select}
            value={params.get("sort") ?? "recommended"}
            onChange={(e) => update({ sort: e.target.value === "recommended" ? null : e.target.value })}
          >
            {(Object.keys(dict.catalog.sortOptions) as (keyof typeof dict.catalog.sortOptions)[]).map((key) => (
              <option key={key} value={key}>
                {dict.catalog.sortOptions[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/**
 * EN: Side filters from the design: Tamanho (checkboxes) · Cor (8 swatches) · Preço · help box.
 * PT: Filtros laterais do design: Tamanho · Cor (8 amostras) · Preço · caixa de ajuda.
 */
export function CategoryFilters() {
  const { dict, href } = useI18n();
  const { values, toggle } = useFilterParams();
  const sizes = values("size");
  const colors = values("color");
  const prices = values("price");

  return (
    <aside aria-label={dict.catalog.filters} className={styles.aside}>
      <fieldset className={styles.fieldset}>
        <legend className={`label ${styles.legend}`}>{dict.catalog.size}</legend>
        {SIZE_SCALE.map((size) => (
          <label key={size} className={styles.check}>
            <input type="checkbox" checked={sizes.includes(size)} onChange={() => toggle("size", size)} />
            {size}
          </label>
        ))}
        <a href={href("/info/tamanhos")} className={`underline ${styles.guide}`}>
          {dict.product.sizeGuide}
        </a>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={`label ${styles.legend}`}>{dict.catalog.color}</legend>
        <div className={styles.swatches}>
          {COLOR_FAMILIES.map((family) => (
            <button
              key={family}
              type="button"
              className={styles.swatch}
              style={{ background: SWATCHES[family] }}
              aria-label={dict.catalog.colors[family]}
              aria-pressed={colors.includes(family)}
              onClick={() => toggle("color", family)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={`label ${styles.legend}`}>{dict.catalog.price}</legend>
        {PRICE_RANGES.map((range) => (
          <label key={range} className={styles.check}>
            <input type="checkbox" checked={prices.includes(range)} onChange={() => toggle("price", range)} />
            {dict.catalog.priceRanges[range]}
          </label>
        ))}
      </fieldset>

      <div className={styles.help}>
        <span className={styles.helpTitle}>{dict.catalog.helpTitle}</span>
        <span className={styles.helpBody}>{dict.catalog.helpBody}</span>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={styles.helpLink}>
          {dict.common.whatsapp}
        </a>
      </div>
    </aside>
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
      <button type="button" className={styles.emptyButton} onClick={() => update({ size: null, color: null, price: null, type: null })}>
        {dict.catalog.clearFilters}
      </button>
    </div>
  );
}
