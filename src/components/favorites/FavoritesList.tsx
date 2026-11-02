"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import type { ProductDTO } from "@/types";
import grid from "@/components/product/ProductGrid.module.css";
import { useFavorites } from "./FavoritesProvider";

/** EN: Loads the saved pieces through the API and shows them as product cards. PT: Carrega as peças guardadas. */
export function FavoritesList({ showPrice = false }: { showPrice?: boolean }) {
  const { locale, dict } = useI18n();
  const { slugs } = useFavorites();
  const [products, setProducts] = useState<ProductDTO[] | null>(null);

  useEffect(() => {
    if (!slugs.length) return setProducts([]);
    let cancelled = false;
    api
      .listProducts({ locale, slugs })
      .then((list) => !cancelled && setProducts(list))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [locale, slugs]);

  if (products === null) return <p>{dict.common.loading}</p>;
  if (!products.length) return <p>{dict.favorites.empty}</p>;

  return (
    <div className={`${grid.grid} ${grid.four}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} showPrice={showPrice} />
      ))}
    </div>
  );
}
