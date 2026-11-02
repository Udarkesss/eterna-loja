"use client";

import Image from "next/image";
import Link from "next/link";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { cartTotal, nowLines } from "@/lib/cart";
import { formatMZN } from "@/lib/format";
import { MT_PER_POINT } from "@/lib/loyalty";
import { sizeParts } from "@/lib/sizes";
import { useCart } from "./CartProvider";
import { describeLine, useCartProducts } from "./useCartProducts";
import styles from "./CartView.module.css";

/**
 * EN: Cart of design V3 ("Carrinho: escolher o que compra agora"): each piece has a "buy now" box; unticked pieces stay
 *     saved for later. Summary with the pieces chosen, subtotal, free collection, total, points earned and the
 *     final-sale note. A piece out of stock cannot be chosen.
 * PT: Carrinho do V3: cada peça tem a caixa "comprar agora"; as desmarcadas ficam guardadas para depois. Resumo com as
 *     peças escolhidas, subtotal, levantamento grátis, total, pontos ganhos e a nota de venda final. Uma peça sem
 *     stock não se pode escolher.
 */
export function CartView() {
  const { locale, dict, href } = useI18n();
  const c = dict.cart;
  const { remove, toggleLater } = useCart();
  const { toggle: toggleFavorite, isFavorite } = useFavorites();
  const { lines, products, loading } = useCartProducts();

  if (loading) return <p className={styles.muted}>{dict.common.loading}</p>;

  if (!lines.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>{c.empty}</p>
        <ButtonLink href={href("/")} variant="outline">
          {c.continue}
        </ButtonLink>
      </div>
    );
  }

  const priceOf = (slug: string) => {
    const p = products[slug];
    return p ? (p.salePrice ?? p.price) : undefined;
  };
  const described = lines.map((line) => describeLine(line, products));
  const available = (d: (typeof described)[number]) => !!d.variant && d.variant.stock >= d.line.quantity;
  const chosen = nowLines(described.filter(available).map((d) => d.line));
  const total = cartTotal(chosen, priceOf);
  const pieces = chosen.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className={styles.layout}>
      <ul className={styles.lines}>
        {described.map((d) => {
          const { line, product, variant, colorName, image } = d;
          const ok = available(d);
          const now = ok && !line.later;
          const size = variant ? sizeParts(variant.size) : null;
          return (
            <li key={line.variantId} className={styles.line} data-off={!ok || undefined}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={now}
                  disabled={!ok}
                  onChange={() => toggleLater(line.variantId)}
                  aria-label={t(c.buyNow, { code: product?.code ?? line.slug.toUpperCase() })}
                />
              </label>
              <span className={styles.thumb}>{image && <Image src={image.url} alt={image.alt} fill sizes="112px" className={styles.cover} />}</span>
              <div className={styles.info}>
                <div className={styles.top}>
                  {product ? (
                    <Link href={href(`/product/${line.slug}`)} className={styles.code}>
                      {product.code}
                    </Link>
                  ) : (
                    <span className={styles.code}>{line.slug.toUpperCase()}</span>
                  )}
                  <span className={styles.price}>{product ? formatMZN((priceOf(line.slug) ?? 0) * line.quantity, locale) : "—"}</span>
                </div>
                <span className={styles.meta}>
                  {[product?.type?.name, colorName, size && [size.detail, size.letter].filter(Boolean).join(" · "), line.quantity > 1 && t(c.qty, { n: line.quantity })]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {!ok && (
                  <span className={styles.badgeWarn}>
                    <Icon name="hourglass" size={14} />
                    {variant ? c.soldOut : c.unavailable}
                  </span>
                )}
                {ok && line.later && <span className={styles.badge}>{c.later}</span>}
                <div className={styles.actions}>
                  {product && !isFavorite(line.slug) && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleFavorite(line.slug);
                        remove(line.variantId);
                      }}
                    >
                      {c.toFavorites}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(line.variantId)}>
                    {c.remove}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className={styles.summary} aria-label={c.summary}>
        <h2 className={styles.summaryTitle}>{c.summary}</h2>
        <span className={styles.muted}>{plural(c.selected, pieces)}</span>
        <dl className={styles.totals}>
          <div>
            <dt>{c.subtotal}</dt>
            <dd>{formatMZN(total, locale)}</dd>
          </div>
          <div>
            <dt>{c.pickup}</dt>
            <dd>{c.free}</dd>
          </div>
          <div className={styles.grand}>
            <dt>{c.total}</dt>
            <dd>{formatMZN(total, locale)}</dd>
          </div>
        </dl>
        {total >= MT_PER_POINT && (
          <span className={styles.points}>
            <Icon name="sparkle" size={16} />
            {plural(c.points, Math.floor(total / MT_PER_POINT))}
          </span>
        )}
        {chosen.length ? (
          <ButtonLink href={href("/checkout")} block size="lg">
            {c.checkout}
          </ButtonLink>
        ) : (
          <p className={styles.error}>{c.noneSelected}</p>
        )}
        <p className={styles.note}>
          <Icon name="return" size={16} />
          <span>
            {dict.product.finalSale}{" "}
            <Link href={`${href("/")}#contactos`} className={styles.link}>
              {dict.product.tryInStore}
            </Link>
          </span>
        </p>
      </aside>
    </div>
  );
}
