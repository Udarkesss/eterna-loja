"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { formatMZN } from "@/lib/format";
import { resolveHref } from "@/lib/links";
import type { ProductDTO } from "@/types";
import styles from "./ProductDetail.module.css";

/** EN: "6US/38EUR/S" → "6US / 38EUR / S", as shown on the product page. PT: Como na página de produto. */
const spacedSize = (size: string) => size.split("/").join(" / ");

/**
 * EN: Interactive part of the product page (design "Produto · 8G1L7"): gallery that follows the chosen colour,
 *     colour and size pickers, stock message, "Adicionar ao carrinho", "Marcar prova" and favourite.
 *     Server-rendered blocks (trust list, panels) come in as `children`.
 * PT: Parte interactiva da página de produto: galeria que segue a cor, escolha de cor e tamanho, mensagem de stock,
 *     "Adicionar ao carrinho", "Marcar prova" e favorito. Os blocos do servidor entram como `children`.
 */
export function ProductDetail({ product, children }: { product: ProductDTO; children: ReactNode }) {
  const { dict, locale, href } = useI18n();
  const { add } = useCart();

  const firstInStock = product.colors.find((c) => product.variants.some((v) => v.color === c.key && v.stock > 0))?.key;
  const [color, setColor] = useState<string | null>(firstInStock ?? product.colors[0]?.key ?? null);
  const sizes = product.variants.filter((v) => !product.colors.length || v.color === color);
  const [variantId, setVariantId] = useState<string | null>(sizes.find((v) => v.stock > 0)?.id ?? sizes[0]?.id ?? null);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const images = useMemo(() => {
    const forColor = product.images.filter((i) => !color || i.color === color || i.color === null);
    return forColor.length ? forColor : product.images;
  }, [product.images, color]);
  const main = images[Math.min(imageIndex, images.length - 1)];
  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const colorName = product.colors.find((c) => c.key === color)?.name;
  const price = product.salePrice ?? product.price;
  const soldOut = product.variants.every((v) => v.stock <= 0);

  function chooseColor(key: string) {
    setColor(key);
    setImageIndex(0);
    setAdded(false);
    const first = product.variants.find((v) => v.color === key && v.stock > 0) ?? product.variants.find((v) => v.color === key);
    setVariantId(first?.id ?? null);
  }

  function handleAdd() {
    if (!selected || selected.stock <= 0) return;
    add({ slug: product.slug, variantId: selected.id, quantity: 1 });
    setAdded(true);
  }

  const stockLine = !selected
    ? null
    : selected.stock <= 0
      ? { cls: styles.stockOut, icon: "alert" as const, text: dict.product.soldOutSize }
      : selected.stock === 1
        ? { cls: styles.stockLow, icon: "clock" as const, text: dict.product.lastUnit }
        : { cls: styles.stockOk, icon: "check" as const, text: dict.product.available };

  const collectionClass = product.collection ? styles[`badge-${product.collection.slug}`] : "";

  return (
    <section className={`page-x ${styles.layout}`}>
      <div className={styles.gallery}>
        {images.length > 1 && (
          <div className={styles.thumbs}>
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                className={styles.thumb}
                aria-label={t(dict.product.viewImage, { n: i + 1 })}
                aria-pressed={i === imageIndex}
                onClick={() => setImageIndex(i)}
              >
                <Image src={img.url} alt="" fill sizes="96px" className={styles.cover} />
              </button>
            ))}
          </div>
        )}
        <div className={styles.main}>
          {main && <Image src={main.url} alt={main.alt} fill priority sizes="(min-width: 1024px) 648px, 100vw" className={styles.coverTop} />}
          {product.collection && <span className={`${styles.badge} ${collectionClass}`}>{product.collection.name}</span>}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.titles}>
          <span className="eyebrow">{[product.occasions[0]?.name, product.type?.name].filter(Boolean).join(" · ")}</span>
          <h1 className={styles.code}>{product.code}</h1>
          <span className={styles.name}>{product.name}</span>
          <span className={styles.price}>
            {product.salePrice != null && <s className={styles.old}>{formatMZN(product.price, locale)}</s>}
            {formatMZN(price, locale)}
          </span>
        </div>

        {product.colors.length > 0 && (
          <div className={styles.colorBlock}>
            <span className="label">
              {dict.product.color}: <span className={styles.plain}>{colorName}</span>
            </span>
            <div className={styles.swatches} role="radiogroup" aria-label={dict.product.color}>
              {product.colors.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={c.key === color}
                  aria-label={c.name}
                  className={styles.swatch}
                  style={{ background: c.hex ?? "var(--blush-light)" }}
                  onClick={() => chooseColor(c.key)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.sizeBlock}>
          <div className={styles.sizeHead}>
            <span className="label">{dict.product.size}</span>
            <Link href={href("/info/tamanhos")} className={`underline ${styles.guide}`}>
              {dict.product.sizeGuide}
            </Link>
          </div>
          <div role="radiogroup" aria-label={dict.product.size} className={styles.sizes}>
            {sizes.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variantId}
                disabled={v.stock <= 0}
                className={styles.size}
                onClick={() => {
                  setVariantId(v.id);
                  setAdded(false);
                }}
              >
                {spacedSize(v.size)}
              </button>
            ))}
          </div>
          {stockLine && (
            <span className={`${styles.stock} ${stockLine.cls}`}>
              <Icon name={stockLine.icon} size={16} />
              {stockLine.text}
            </span>
          )}
          <a
            href={whatsappLink(t(dict.product.otherSizeMessage, { code: product.code }))}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.otherSize}
          >
            {dict.product.otherSize}
          </a>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.add} onClick={handleAdd} disabled={soldOut || !selected || selected.stock <= 0}>
            {soldOut ? dict.product.soldOut : added ? t(dict.product.addedButton, { price: formatMZN(price, locale) }) : dict.product.addToCart}
          </button>
          <div className={styles.actionRow}>
            <Link href={`${resolveHref("#prova", locale)}?piece=${product.slug}`} className={styles.fitting}>
              <Icon name="calendar" size={18} />
              {dict.product.bookFitting}
            </Link>
            <FavoriteButton slug={product.slug} code={product.code} variant="square" />
          </div>
          {added && (
            <div role="status" className={styles.added}>
              <Icon name="check" size={18} />
              <span className={styles.grow}>{dict.product.added}</span>
              <Link href={href("/cart")} className={styles.addedLink}>
                {dict.product.viewCartPay}
              </Link>
            </div>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}

/** EN: The four accordion panels (Descrição open by default). PT: Os quatro painéis (Descrição aberto). */
export function ProductPanels({ panels }: { panels: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  return (
    <div className={styles.panels}>
      {panels.map((panel, i) => (
        <div key={panel.title} className={styles.panel}>
          <button
            type="button"
            className={styles.panelButton}
            aria-expanded={!!open[i]}
            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
          >
            {panel.title}
            <span aria-hidden="true" className={styles.sign}>
              {open[i] ? "−" : "+"}
            </span>
          </button>
          {open[i] && <p className={styles.panelBody}>{panel.body}</p>}
        </div>
      ))}
    </div>
  );
}
