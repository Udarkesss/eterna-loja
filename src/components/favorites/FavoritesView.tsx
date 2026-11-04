"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { ProductCard } from "@/components/product/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import { productHref } from "@/lib/links";
import type { CardPrice, ProductDTO } from "@/types";
import { useFavorites } from "./FavoritesProvider";
import styles from "./Favorites.module.css";

/** EN: Department whose pieces go to the bridal fitting block. PT: Departamento das peças do bloco de prova. */
const BRIDAL = "noivas";
const FITTING_MAX = 6;

/**
 * EN: Favourites of design V3: "Todos · 7 | Noivas · 3"; with Eterna Bridal pieces, the "Prove o conjunto" block (book a
 *     fitting with those pieces) and the `companions` row (for bridesmaids and mothers of the bride); then the other
 *     pieces, each with "Mover para o carrinho" (straight to the bag when only one size is left, otherwise to the piece
 *     to choose the size).
 * PT: Favoritos do V3: "Todos · 7 | Noivas · 3"; com peças da Eterna Bridal, o bloco "Prove o conjunto" (marcar prova
 *     com essas peças) e a fila `companions` (madrinhas e mães da noiva); depois as outras peças, cada uma com "Mover
 *     para o carrinho" (directo quando só resta um tamanho; senão abre a peça para escolher o tamanho).
 */
export function FavoritesView({ showPrice, companions, exploreHref }: { showPrice: CardPrice; companions: ReactNode; exploreHref: string }) {
  const { locale, dict, href } = useI18n();
  const f = dict.favorites;
  const { slugs } = useFavorites();
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [bridalSlugs, setBridalSlugs] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "bridal">("all");
  const [moved, setMoved] = useState<string | null>(null);

  useEffect(() => {
    if (!slugs.length) return setProducts([]);
    let cancelled = false;
    Promise.all([api.listProducts({ locale, slugs }), api.listProducts({ locale, slugs, category: BRIDAL })])
      .then(([all, bridal]) => {
        if (cancelled) return;
        // EN: Most recently saved first. PT: As guardadas mais recentemente primeiro.
        const order = [...slugs].reverse();
        setProducts(all.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)));
        setBridalSlugs(bridal.map((p) => p.slug));
      })
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [locale, slugs]);

  const bridal = useMemo(() => (products ?? []).filter((p) => bridalSlugs.includes(p.slug)), [products, bridalSlugs]);
  const others = useMemo(() => (products ?? []).filter((p) => !bridalSlugs.includes(p.slug)), [products, bridalSlugs]);
  const showBridal = bridal.length > 0;
  const grid = tab === "bridal" ? bridal : others;

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.display}>
          <RichText text={f.title} />
        </h1>
        {showBridal && (
          <div className={styles.seg}>
            <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
              {t(f.all, { count: products?.length ?? 0 })}
            </button>
            <button type="button" aria-pressed={tab === "bridal"} onClick={() => setTab("bridal")}>
              {t(f.bridal, { count: bridal.length })}
            </button>
          </div>
        )}
      </div>

      {moved && (
        <p role="status" className={styles.moved}>
          <Icon name="check" size={16} />
          {t(f.moved, { code: moved })}
          <Link href={href("/cart")}>{f.seeCart}</Link>
        </p>
      )}

      {products === null ? (
        <p className={styles.muted}>{dict.common.loading}</p>
      ) : products.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>{f.empty}</p>
          <Link href={exploreHref} className={styles.btnOutline}>
            {f.explore}
          </Link>
        </div>
      ) : (
        <>
          {showBridal && <BridalBlock pieces={bridal} />}
          {showBridal && tab === "all" && companions}
          {grid.length > 0 && (
            <section>
              <h2 className={styles.subtitle}>{f.yours}</h2>
              <div className={styles.grid}>
                {grid.map((p) => (
                  <div key={p.id} className={styles.item}>
                    <ProductCard product={p} locale={locale} showPrice={showPrice} />
                    <MoveToCart product={p} onMoved={setMoved} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** EN: "Prove o conjunto": the bridal favourites and a fitting with them. PT: As peças de noiva e a prova com elas. */
function BridalBlock({ pieces }: { pieces: ProductDTO[] }) {
  const { locale, dict, href } = useI18n();
  const f = dict.favorites;
  const shown = pieces.slice(0, FITTING_MAX);
  return (
    <section data-theme="bridal" className={styles.bridal}>
      <div className={styles.bridalText}>
        <Image src="/images/brand/eterna-bridal-logo.svg" alt="Eterna Bridal" width={160} height={60} unoptimized className={styles.bridalLogo} />
        <h2 className={styles.script}>{f.bridalTitle}</h2>
        <p className={styles.muted}>{plural(f.bridalBody, pieces.length)}</p>
      </div>
      <Link href={`${href("/fitting")}?piece=${shown.map((p) => p.slug).join(",")}`} className={`${styles.btn} ${styles.bridalButton}`}>
        <Icon name="calendar" size={18} />
        {f.bookWithThese}
      </Link>
      <div className={styles.bridalPieces}>
        {shown.map((p) => (
          <Link key={p.id} href={productHref(p.slug, locale)} className={styles.bridalPiece}>
            <span className={styles.bridalImage}>
              {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="(min-width: 1024px) 230px, 30vw" />}
            </span>
            <span className={styles.code}>{p.code}</span>
            <span className={styles.small}>{[p.type?.name, p.collection?.name].filter(Boolean).join(" · ")}</span>
            <span className={styles.price}>{formatMZN(p.salePrice ?? p.price, locale)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * EN: "Mover para o carrinho": with one size in stock it goes to the bag and leaves the favourites; with several, the
 *     piece opens to choose the size.
 * PT: "Mover para o carrinho": com um só tamanho em stock vai para o carrinho e sai dos favoritos; com vários, abre a
 *     peça para escolher o tamanho.
 */
function MoveToCart({ product, onMoved }: { product: ProductDTO; onMoved: (code: string) => void }) {
  const { locale, dict } = useI18n();
  const f = dict.favorites;
  const { add } = useCart();
  const { toggle } = useFavorites();
  const inStock = product.variants.filter((v) => v.stock > 0);
  const label = (
    <>
      <Icon name="bag" size={16} />
      <span className={styles.long}>{f.moveToCart}</span>
      <span className={styles.short}>{f.moveToCartShort}</span>
    </>
  );

  if (!inStock.length)
    return (
      <button type="button" className={styles.move} disabled>
        {f.soldOut}
      </button>
    );
  if (inStock.length > 1)
    return (
      <Link href={productHref(product.slug, locale)} className={styles.move} aria-label={`${f.chooseSize} · ${product.code}`}>
        {label}
      </Link>
    );
  return (
    <button
      type="button"
      className={styles.move}
      onClick={() => {
        add({ slug: product.slug, variantId: inStock[0].id, quantity: 1 });
        toggle(product.slug);
        onMoved(product.code);
      }}
    >
      {label}
    </button>
  );
}
