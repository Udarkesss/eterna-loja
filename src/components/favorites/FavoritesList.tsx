"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import type { ProductDTO } from "@/types";
import card from "@/components/product/ProductCard.module.css";
import grid from "@/components/product/ProductGrid.module.css";
import { FavoriteButton } from "./FavoriteButton";
import { useFavorites } from "./FavoritesProvider";

/** EN: Loads the saved pieces through the API and shows them as product cards. PT: Carrega as peças guardadas. */
export function FavoritesList() {
  const { locale, dict, href } = useI18n();
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
        <div key={p.id} className={card.card}>
          <Link href={href(`/product/${p.slug}`)} className={card.link}>
            <span className={card.media}>
              {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="25vw" className={card.image} />}
            </span>
            <span className={card.row}>
              <span className={card.code}>{p.code}</span>
              <span className={card.price}>{formatMZN(p.salePrice ?? p.price, locale)}</span>
            </span>
          </Link>
          <FavoriteButton slug={p.slug} code={p.code} />
        </div>
      ))}
    </div>
  );
}
