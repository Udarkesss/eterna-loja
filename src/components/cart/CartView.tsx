"use client";

import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { RichText } from "@/components/ui/RichText";
import { useI18n } from "@/i18n/I18nProvider";
import { MAX_QUANTITY, cartTotal } from "@/lib/cart";
import { formatMZN } from "@/lib/format";
import { useCart } from "./CartProvider";
import { describeLine, useCartProducts } from "./useCartProducts";
import styles from "./CartView.module.css";

/**
 * EN: Bag page — step 1 ("Carrinho") of the design's checkout steps. Same visual language as the order summary.
 * PT: Página do carrinho — passo 1 ("Carrinho") dos passos do checkout. Mesmo estilo do resumo de encomenda.
 */
export function CartView() {
  const { locale, dict, href } = useI18n();
  const { remove, setQuantity } = useCart();
  const { lines, products, loading } = useCartProducts();

  if (loading) return <p className={styles.muted}>{dict.common.loading}</p>;

  if (!lines.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>{dict.cart.empty}</p>
        <ButtonLink href={href("/")} variant="outline">
          {dict.cart.continue}
        </ButtonLink>
      </div>
    );
  }

  const priceOf = (slug: string) => {
    const p = products[slug];
    return p ? (p.salePrice ?? p.price) : undefined;
  };
  const total = cartTotal(lines, priceOf);
  const described = lines.map((line) => describeLine(line, products));
  const blocked = described.some((d) => !d.variant || d.variant.stock < d.line.quantity);

  return (
    <div className={styles.layout}>
      <ul className={styles.lines}>
        {described.map(({ line, product, variant, colorName, image }) => {
          const max = Math.max(1, Math.min(MAX_QUANTITY, variant?.stock ?? 1));
          return (
            <li key={line.variantId} className={styles.line}>
              <span className={styles.thumb}>
                {image && <Image src={image.url} alt={image.alt} fill sizes="96px" className={styles.cover} />}
              </span>
              <div className={styles.info}>
                {product ? (
                  <Link href={href(`/product/${line.slug}`)} className={styles.code}>
                    {product.code}
                  </Link>
                ) : (
                  <span className={styles.code}>{line.slug.toUpperCase()}</span>
                )}
                {variant ? (
                  <span className={styles.meta}>{[colorName, variant.size].filter(Boolean).join(" · ")}</span>
                ) : (
                  <span className={styles.error}>{dict.cart.unavailable}</span>
                )}
                {variant && variant.stock < line.quantity && <span className={styles.error}>{dict.cart.unavailable}</span>}
                <div className={styles.controls}>
                  <label>
                    <span className="visually-hidden">{dict.cart.quantity}</span>
                    <select
                      className={styles.select}
                      value={line.quantity}
                      disabled={!variant}
                      onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                    >
                      {Array.from({ length: Math.max(max, line.quantity) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className={styles.remove} onClick={() => remove(line.variantId)}>
                    {dict.cart.remove}
                  </button>
                </div>
              </div>
              <span className={styles.price}>{variant ? formatMZN((priceOf(line.slug) ?? 0) * line.quantity, locale) : "—"}</span>
            </li>
          );
        })}
      </ul>

      <aside className={styles.summary} aria-label={dict.checkout.summary.title}>
        <h2 className={styles.summaryTitle}>
          <RichText text={dict.checkout.summary.title} />
        </h2>
        <dl className={styles.totals}>
          <div>
            <dt>{dict.cart.subtotal}</dt>
            <dd>{formatMZN(total, locale)}</dd>
          </div>
          <div>
            <dt>{dict.cart.delivery}</dt>
            <dd className={styles.muted}>{dict.cart.deliveryNote}</dd>
          </div>
          <div className={styles.grand}>
            <dt>{dict.cart.total}</dt>
            <dd>{formatMZN(total, locale)}</dd>
          </div>
        </dl>
        {blocked ? (
          <p className={styles.error}>{dict.errors.OUT_OF_STOCK}</p>
        ) : (
          <ButtonLink href={href("/checkout")} block size="lg">
            {dict.cart.checkout}
          </ButtonLink>
        )}
      </aside>
    </div>
  );
}
