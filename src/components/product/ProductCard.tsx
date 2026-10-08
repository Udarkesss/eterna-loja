import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { getDictionary } from "@/i18n";
import { formatMZN } from "@/lib/format";
import { productHref } from "@/lib/links";
import type { Locale, ProductDTO } from "@/types";
import styles from "./ProductCard.module.css";

/** EN: "6US/38EUR/S" → sizes of the product, joined. PT: Tamanhos do produto, juntos. */
function sizeSummary(product: ProductDTO): string {
  return [...new Set(product.variants.map((v) => v.size))].join(", ");
}

/**
 * EN: Product card from the design: 4:5 photo, code + price in Cormorant, a line of details, heart and "Novo".
 *     meta "full" (Início): "Vestido midi · Convidada · 6US/38EUR/S"; "short" (Categoria): "Vestido midi · 6US/38EUR/S";
 *     "none" ("Também pode gostar").
 * PT: Cartão de produto do design: foto 4:5, código + preço, linha de detalhes, coração e "Novo".
 */
export function ProductCard({
  product,
  locale,
  meta = "short",
  sizes = "(min-width: 1024px) 25vw, 50vw",
}: {
  product: ProductDTO;
  locale: Locale;
  meta?: "full" | "short" | "none";
  sizes?: string;
}) {
  const dict = getDictionary(locale);
  const image = product.images[0];
  const details =
    meta === "full"
      ? [product.type?.name, product.occasions[0]?.name, sizeSummary(product)]
      : [product.type?.name, sizeSummary(product)];

  return (
    <div className={styles.card}>
      <Link href={productHref(product.slug, locale)} className={styles.link}>
        <span className={styles.media}>
          {image && <Image src={image.url} alt={image.alt} fill sizes={sizes} className={styles.image} />}
        </span>
        <span className={styles.text}>
          <span className={styles.row}>
            <span className={meta === "none" ? styles.codeSmall : styles.code}>{product.code}</span>
            <span className={meta === "none" ? styles.priceSmall : styles.price}>
              {product.salePrice != null ? (
                <>
                  <s className={styles.old}>{formatMZN(product.price, locale)}</s> {formatMZN(product.salePrice, locale)}
                </>
              ) : (
                formatMZN(product.price, locale)
              )}
            </span>
          </span>
          {meta !== "none" && <span className={styles.meta}>{details.filter(Boolean).join(" · ")}</span>}
        </span>
      </Link>
      {meta !== "none" && <FavoriteButton slug={product.slug} code={product.code} />}
      {product.isNew && meta !== "none" && <span className={styles.badge}>{dict.product.new}</span>}
    </div>
  );
}
