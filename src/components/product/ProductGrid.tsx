import type { Locale, ProductDTO } from "@/types";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

/**
 * EN: Product grid: 4 columns on the home page, 3 next to the category filters, 2 on phones.
 * PT: Grelha de produtos: 4 colunas no Início, 3 ao lado dos filtros da categoria, 2 no telemóvel.
 */
export function ProductGrid({
  products,
  locale,
  columns = 4,
  meta = "short",
}: {
  products: ProductDTO[];
  locale: Locale;
  columns?: 3 | 4;
  meta?: "full" | "short" | "none";
}) {
  return (
    <div className={`${styles.grid} ${columns === 3 ? styles.three : styles.four}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} meta={meta} />
      ))}
    </div>
  );
}
