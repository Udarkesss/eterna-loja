import type { Locale, ProductDTO } from "@/types";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

/**
 * EN: Product grid of design V3: 4 columns, 3 next to the category filters, 2–3 on tablets, 2 on phones.
 *     `showPrice` = "Preço nos cartões" (Gestão → Definições).
 * PT: Grelha de produtos do V3: 4 colunas, 3 ao lado dos filtros, 2–3 no tablet, 2 no telemóvel.
 */
export function ProductGrid({
  products,
  locale,
  columns = 4,
  showPrice = false,
}: {
  products: ProductDTO[];
  locale: Locale;
  columns?: 3 | 4;
  showPrice?: boolean;
}) {
  return (
    <div className={`${styles.grid} ${columns === 3 ? styles.three : styles.four}`}>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} locale={locale} showPrice={showPrice} priority={i < 4} />
      ))}
    </div>
  );
}
