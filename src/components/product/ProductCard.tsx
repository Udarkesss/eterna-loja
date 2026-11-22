import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { getDictionary } from "@/i18n";
import { formatMZN } from "@/lib/format";
import { productHref } from "@/lib/links";
import { sizeParts, sortSizes } from "@/lib/sizes";
import type { CardPrice, Locale, ProductDTO } from "@/types";
import styles from "./ProductCard.module.css";

/**
 * EN: Product card of design V3, the same in every list: 3:4 photo (badge "Novo" or "−%", heart), the reference, the
 *     colours as circles (the first ringed, with its name) and the sizes in stock (letter, "6 US · 38 EU" below).
 *     The price is hidden unless "Preço nos cartões" is on (Gestão → Definições); a piece on sale always shows it.
 * PT: Cartão de produto do design V3, igual em todas as listas: foto 3:4 (selo "Novo" ou "−%", coração), a referência,
 *     as cores em círculos (a primeira com anel e nome) e os tamanhos em stock. O preço só aparece com "Preço nos
 *     cartões" ligado; uma peça em saldo mostra-o sempre.
 */
export function ProductCard({
  product,
  locale,
  showPrice = "sale",
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
}: {
  product: ProductDTO;
  locale: Locale;
  showPrice?: CardPrice;
  sizes?: string;
  priority?: boolean;
}) {
  const dict = getDictionary(locale);
  const image = product.images[0];
  const sale = product.salePrice != null && product.salePrice < product.price;
  const off = sale ? Math.round(100 - (100 * product.salePrice!) / product.price) : 0;
  const inStock = sortSizes([...new Set(product.variants.filter((v) => v.stock > 0).map((v) => v.size))]);
  const colors = product.colors.slice(0, 5);

  return (
    <div className={styles.card}>
      <Link href={productHref(product.slug, locale)} className={styles.link}>
        <span className={styles.media}>
          {image && <Image src={image.url} alt={image.alt || product.code} fill sizes={sizes} priority={priority} className={styles.image} />}
          <span className={styles.tags}>
            {sale ? (
              <span className={`${styles.badge} ${styles.sale}`}>−{off}%</span>
            ) : (
              product.isNew && <span className={styles.badge}>{dict.product.new}</span>
            )}
          </span>
        </span>
        <span className={styles.body}>
          <span className={styles.code}>{product.code}</span>
          {(showPrice === true || (sale && showPrice === "sale")) && (
            <span className={styles.prices}>
              {sale ? (
                <>
                  <s className={styles.old}>{formatMZN(product.price, locale)}</s>
                  <span className={`${styles.price} ${styles.salePrice}`}>{formatMZN(product.salePrice!, locale)}</span>
                </>
              ) : (
                <span className={styles.price}>{formatMZN(product.price, locale)}</span>
              )}
            </span>
          )}
          {colors.length > 0 && (
            <span className={styles.swatches}>
              {colors.map((c, i) => (
                // EN: Only the dot; the colour's name shows on hover (owner 2026-11-22). PT: Só o ponto; o nome aparece ao passar o rato.
                <span
                  key={c.key}
                  role="img"
                  aria-label={c.name}
                  data-name={c.name}
                  className={`${styles.swatch} ${i === 0 && product.colors.length > 1 ? styles.ring : ""}`}
                  style={{ background: c.hex ?? "var(--alt)" }}
                />
              ))}
              {product.colors.length > 5 && <span className={styles.more}>+{product.colors.length - 5}</span>}
            </span>
          )}
          {inStock.length > 0 && (
            <span className={styles.sizes} aria-label={dict.product.sizesInStock}>
              {inStock.map((s) => {
                const p = sizeParts(s);
                return (
                  <span key={s} className={styles.size}>
                    <b>{p.letter === "Único" ? dict.product.oneSize : p.letter}</b>
                    {p.detail && <small>{p.detail}</small>}
                  </span>
                );
              })}
            </span>
          )}
        </span>
      </Link>
      <FavoriteButton slug={product.slug} code={product.code} />
    </div>
  );
}
