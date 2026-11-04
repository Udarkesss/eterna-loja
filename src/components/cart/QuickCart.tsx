"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomer } from "@/components/account/CustomerProvider";
import { Icon } from "@/components/ui/Icon";
import { plural, t } from "@/i18n";
import { api } from "@/lib/api-client";
import { useI18n } from "@/i18n/I18nProvider";
import { cartTotal, nowLines } from "@/lib/cart";
import { formatMZN } from "@/lib/format";
import { sizeParts } from "@/lib/sizes";
import type { CartLine, ProductDTO } from "@/types";
import { useCart } from "./CartProvider";
import { describeLine, useCartProducts } from "./useCartProducts";
import styles from "./QuickCart.module.css";

/**
 * EN: Quick cart of design V3: opens on "Adicionar ao carrinho" — side panel on computers, bottom sheet on phones —
 *     with the piece just added, the rest of the cart, the subtotal and "Finalizar compra" / "Ver carrinho".
 * PT: Carrinho rápido do V3: abre em "Adicionar ao carrinho" — painel lateral no computador, painel de baixo no
 *     telemóvel — com a peça acabada de juntar, o resto do carrinho, o subtotal e "Finalizar compra" / "Ver carrinho".
 */
export function QuickCart() {
  const { locale, dict, href } = useI18n();
  const c = dict.cart;
  const { justAdded, closeQuick } = useCart();
  const { lines, products } = useCartProducts();
  const { customer } = useCustomer();
  // EN: "Com o nome do nível" (Gestão · Descontos): the note names the level. PT: A nota diz o nome do nível.
  const [named, setNamed] = useState<string | null>(null);
  const open = !!justAdded;
  useEffect(() => {
    if (!open || !customer) return;
    api
      .checkoutOptions(locale)
      .then((o) => setNamed(o.levelDisplay === "named" && o.level && o.level.pct > 0 ? o.level.name : null))
      .catch(() => setNamed(null));
  }, [open, customer, locale]);

  useEffect(() => {
    if (!justAdded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeQuick();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [justAdded, closeQuick]);

  if (!justAdded) return null;
  const priceOf = (slug: string) => {
    const p = products[slug];
    return p ? (p.salePrice ?? p.price) : undefined;
  };
  const others = lines.filter((l) => l.variantId !== justAdded.variantId);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className={styles.backdrop} onClick={closeQuick}>
      <aside role="dialog" aria-modal="true" aria-label={c.added} className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.added}>
            <Icon name="check" size={18} />
            {c.added}
          </span>
          <button type="button" className={styles.close} aria-label={dict.common.close} onClick={closeQuick} autoFocus>
            <Icon name="close" size={22} />
          </button>
        </div>

        {products[justAdded.slug] ? <Line line={justAdded} products={products} big /> : <p className={styles.loading}>{dict.common.loading}</p>}

        {others.length > 0 && (
          <div className={styles.others}>
            <span className={styles.label}>{plural(c.inCart, count)}</span>
            {others.map((l) => (
              <Line key={l.variantId} line={l} products={products} />
            ))}
          </div>
        )}

        <div className={styles.foot}>
          <div className={styles.subtotal}>
            <span>{c.subtotal}</span>
            <span className={styles.price}>{formatMZN(cartTotal(nowLines(lines), priceOf), locale)}</span>
          </div>
          <span className={styles.note}>{named ? t(c.quickNoteNamed, { level: named }) : c.quickNote}</span>
          <Link href={href("/checkout")} className={styles.btn} onClick={closeQuick}>
            {c.checkout}
          </Link>
          <Link href={href("/cart")} className={styles.btnOutline} onClick={closeQuick}>
            {c.viewCart}
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Line({ line, products, big = false }: { line: CartLine; products: Record<string, ProductDTO>; big?: boolean }) {
  const { locale, href } = useI18n();
  const { product, variant, colorName, image } = describeLine(line, products);
  if (!product) return null;
  const size = variant ? sizeParts(variant.size) : null;
  const detail = [colorName, size && [size.detail, size.letter].filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
  return (
    <Link href={href(`/product/${line.slug}`)} className={big ? styles.big : styles.line}>
      <span className={styles.thumb}>{image && <Image src={image.url} alt="" fill sizes="72px" />}</span>
      <span className={styles.info}>
        <span className={big ? styles.code : styles.small}>
          {big ? product.code : `${product.code}${product.type ? ` · ${product.type.name}` : ""}`}
        </span>
        <span className={styles.meta}>{big ? [product.type?.name, detail].filter(Boolean).join(" · ") : detail}</span>
        {big && <span className={styles.price}>{formatMZN(product.salePrice ?? product.price, locale)}</span>}
      </span>
      {!big && <span className={styles.linePrice}>{formatMZN((product.salePrice ?? product.price) * line.quantity, locale)}</span>}
    </Link>
  );
}
