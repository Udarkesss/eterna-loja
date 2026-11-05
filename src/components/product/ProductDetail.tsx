"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCustomer } from "@/components/account/CustomerProvider";
import { useCart } from "@/components/cart/CartProvider";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { levelDiscount } from "@/lib/discounts";
import { formatMZN } from "@/lib/format";
import { sizeParts, sortSizes } from "@/lib/sizes";
import type { ProductDTO } from "@/types";
import styles from "./ProductDetail.module.css";

/**
 * EN: Interactive part of the product page of design V3 ("Loja · Produto"): photos per colour (thumbnails on the left,
 *     a swipe gallery on phones), colour swatches, size boxes (letter + US · EU; sizes that do not exist in the chosen
 *     colour are struck through), "Adicionar ao carrinho", favourite, and a fixed bar on phones. Server-rendered blocks
 *     (information lines, panels) come in as `children`.
 * PT: Parte interactiva da página da peça do V3: fotos por cor, amostras de cor, caixas de tamanho (os que não existem
 *     na cor ficam riscados), "Adicionar ao carrinho", favorito e barra fixa no telemóvel. Os blocos do servidor entram
 *     como `children`.
 */
export interface ReserveRules {
  depositPct: number;
  days: number;
  bridalDays: number;
}

export function ProductDetail({ product, eyebrow, badge, reserve, children }: { product: ProductDTO; eyebrow: string; badge: string | null; reserve: ReserveRules; children: ReactNode }) {
  const { dict, locale, href } = useI18n();
  const { add } = useCart();
  // EN: Signed-in customer's discount for the deposit shown on "Reservar". PT: Desconto da cliente para o sinal em "Reservar".
  const { customer } = useCustomer();
  const [levelPct, setLevelPct] = useState(0);
  const [stack, setStack] = useState(false);
  useEffect(() => {
    if (!customer) return setLevelPct(0);
    api
      .checkoutOptions(locale)
      .then((o) => {
        // EN: Reservations (and wedding dresses) may be left out of the level discount (Definições). PT: Podem ficar de fora.
        setLevelPct(o.loyalty?.onReservations === false ? 0 : (o.level?.pct ?? 0));
        setStack(!!o.loyalty?.stack);
      })
      .catch(() => setLevelPct(0));
  }, [customer, locale]);

  const firstInStock = product.colors.find((c) => product.variants.some((v) => v.color === c.key && v.stock > 0))?.key;
  const [color, setColor] = useState<string | null>(firstInStock ?? product.colors[0]?.key ?? null);
  const inColor = product.variants.filter((v) => !product.colors.length || v.color === color || v.color === null);
  const allSizes = sortSizes([...new Set(product.variants.map((v) => v.size))]);
  const [variantId, setVariantId] = useState<string | null>(inColor.find((v) => v.stock > 0)?.id ?? null);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const images = useMemo(() => {
    const forColor = product.images.filter((i) => !color || i.color === color || i.color === null);
    return forColor.length ? forColor : product.images;
  }, [product.images, color]);
  const main = images[Math.min(imageIndex, images.length - 1)];
  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const colorName = product.colors.find((c) => c.key === color)?.name ?? null;
  const price = product.salePrice ?? product.price;
  const soldOut = product.variants.every((v) => v.stock <= 0);
  const struck = allSizes.some((s) => !inColor.some((v) => v.size === s));

  function chooseColor(key: string) {
    setColor(key);
    setImageIndex(0);
    setAdded(false);
    const first = product.variants.find((v) => v.color === key && v.stock > 0);
    setVariantId(first?.id ?? null);
  }

  function handleAdd() {
    if (!selected || selected.stock <= 0) return;
    add({ slug: product.slug, variantId: selected.id, quantity: 1 });
    setAdded(true);
  }

  const addLabel = soldOut ? dict.product.soldOut : added ? t(dict.product.addedButton, { price: formatMZN(price, locale) }) : selected ? dict.product.addToCart : dict.product.chooseSize;
  const canAdd = !soldOut && !!selected && selected.stock > 0;
  // EN: "Reservar · 6 412,50 MT" (design V3): deposit of the final price; 60 days for Bridal pieces (Loja 22).
  // PT: "Reservar · 6 412,50 MT" (V3): sinal do preço final; 60 dias nas peças da Bridal (Loja 22).
  const final = price - levelDiscount([{ price: product.price, unit: price, quantity: 1 }], levelPct, stack);
  const deposit = Math.round((final * reserve.depositPct) / 100);
  const reserveDays = (selected ?? product.variants[0])?.store?.code === "22" ? reserve.bridalDays : reserve.days;

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
            {colorName && (
              <span className={styles.thumbNote}>
                {t(dict.product.photosOf, { color: colorName, n: images.length })}
                <br />
                {dict.product.photosHint}
              </span>
            )}
          </div>
        )}
        <div className={styles.main}>
          {main && <Image src={main.url} alt={main.alt} fill priority sizes="(min-width: 1024px) 620px, 100vw" className={styles.coverTop} />}
          {badge && <span className={styles.badge}>{badge}</span>}
          {colorName && <span className={styles.colorBadge}>{t(dict.product.colorBadge, { color: colorName })}</span>}
        </div>
        {/* EN: Phones: swipe through the colour's photos. PT: Telemóvel: deslizar pelas fotos da cor. */}
        <div className={styles.swipe}>
          {images.map((img, i) => (
            <div key={img.url} className={styles.slide}>
              <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="100vw" className={styles.coverTop} />
            </div>
          ))}
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.titles}>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className={styles.code}>{product.code}</h1>
          <span className={styles.name}>{product.name}</span>
          <span className={styles.price}>
            {product.salePrice != null && <s className={styles.old}>{formatMZN(product.price, locale)}</s>}
            <span className={product.salePrice != null ? styles.sale : undefined}>{formatMZN(price, locale)}</span>
          </span>
        </div>

        {product.colors.length > 0 && (
          <div className={styles.colorBlock}>
            <span className={styles.label}>
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
                  title={c.name}
                  className={styles.swatch}
                  style={{ background: c.hex ?? "var(--alt)" }}
                  onClick={() => chooseColor(c.key)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.sizeBlock}>
          <div className={styles.sizeHead}>
            <span className={styles.label}>{dict.product.size}</span>
            <Link href={href("/info/tamanhos")} className={styles.guide}>
              <Icon name="ruler" size={14} />
              {dict.product.sizeGuide}
            </Link>
          </div>
          <div role="radiogroup" aria-label={dict.product.size} className={styles.sizes}>
            {allSizes.map((s) => {
              const v = inColor.find((x) => x.size === s);
              const p = sizeParts(s);
              const missing = !v;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={!!v && v.id === variantId}
                  disabled={!v || v.stock <= 0}
                  className={`${styles.size} ${missing ? styles.sizeMissing : ""}`}
                  onClick={() => {
                    if (!v) return;
                    setVariantId(v.id);
                    setAdded(false);
                  }}
                >
                  <b>{p.letter === "Único" ? dict.product.oneSize : p.letter}</b>
                  {p.detail && <small>{p.detail}</small>}
                </button>
              );
            })}
          </div>
          {/* EN: Stock of the chosen size (design V3). PT: Stock do tamanho escolhido (V3). */}
          {selected && selected.stock > 0 && (
            <span className={styles.stock} data-last={selected.stock === 1 ? "" : undefined}>
              {selected.stock === 1 ? dict.product.lastOne : dict.product.available}
            </span>
          )}
          {struck && <span className={styles.note}>{dict.product.sizesStruck}</span>}
          <a href={whatsappLink(t(dict.product.otherSizeMessage, { code: product.code }))} target="_blank" rel="noopener noreferrer" className={styles.otherSize}>
            {dict.product.otherSize}
          </a>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.add} onClick={handleAdd} disabled={!canAdd}>
            {addLabel}
          </button>
          <div className={styles.actionRow}>
            {canAdd && selected ? (
              <Link href={href(`/checkout?reservar=${encodeURIComponent(product.slug)}&v=${selected.id}`)} className={styles.reserve}>
                <span>{t(dict.product.reserve, { price: formatMZN(deposit, locale) })}</span>
                <small>{t(dict.product.reserveSub, { pct: reserve.depositPct, days: reserveDays })}</small>
              </Link>
            ) : (
              <button type="button" className={styles.reserve} disabled>
                <span>{dict.product.reserveShort}</span>
                <small>{t(dict.product.reserveSub, { pct: reserve.depositPct, days: reserveDays })}</small>
              </button>
            )}
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

      {/* EN: Phones: fixed bar with the button, price and colour. PT: Telemóvel: barra fixa com o botão, preço e cor. */}
      <div className={styles.fixedBar} data-bottom-bar="">
        <button type="button" className={styles.add} onClick={handleAdd} disabled={!canAdd}>
          {addLabel}
        </button>
        <span className={styles.fixedPrice}>
          <b>{formatMZN(price, locale)}</b>
          {colorName && <small>{colorName}</small>}
        </span>
      </div>
    </section>
  );
}

/** EN: The accordion panels (Descrição open by default). PT: Os painéis (Descrição aberto por defeito). */
export function ProductPanels({ panels }: { panels: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  return (
    <div className={styles.panels}>
      {panels.map((panel, i) => (
        <div key={panel.title} className={styles.panel}>
          <button type="button" className={styles.panelButton} aria-expanded={!!open[i]} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
            {panel.title}
            <Icon name={open[i] ? "minus" : "plus"} size={16} />
          </button>
          {open[i] && <p className={styles.panelBody}>{panel.body}</p>}
        </div>
      ))}
    </div>
  );
}
