"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useI18n } from "@/i18n/I18nProvider";
import type { CartLine, ProductDTO } from "@/types";
import { useCart } from "./CartProvider";

/**
 * EN: Loads current product data (name, price, stock) for the items in the cart, through the API.
 * PT: Carrega os dados actuais dos produtos (nome, preço, stock) das peças no carrinho, através da API.
 */
export function useCartProducts() {
  const { locale } = useI18n();
  const { lines, ready } = useCart();
  const [products, setProducts] = useState<Record<string, ProductDTO>>({});
  const [loading, setLoading] = useState(true);

  // EN: Only refetch when the set of products changes, not the quantities.
  // PT: Só voltar a pedir quando mudam os produtos, não as quantidades.
  const slugKey = useMemo(() => [...new Set(lines.map((l) => l.slug))].sort().join(","), [lines]);

  useEffect(() => {
    if (!ready) return;
    if (!slugKey) {
      setProducts({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .listProducts({ locale, slugs: slugKey.split(",") })
      .then((list) => {
        if (!cancelled) setProducts(Object.fromEntries(list.map((p) => [p.slug, p])));
      })
      .catch(() => {
        if (!cancelled) setProducts({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, slugKey, ready]);

  return { lines, products, loading: loading || !ready };
}

/**
 * EN: Everything needed to show one cart line: product, chosen variant, colour name and best photo.
 * PT: Tudo o que é preciso para mostrar uma linha: produto, variante escolhida, nome da cor e melhor foto.
 */
export function describeLine(line: CartLine, products: Record<string, ProductDTO>) {
  const product = products[line.slug];
  const variant = product?.variants.find((v) => v.id === line.variantId);
  const colorName = product?.colors.find((c) => c.key === variant?.color)?.name ?? null;
  const image = product?.images.find((i) => i.color === variant?.color) ?? product?.images[0];
  return { line, product, variant, colorName, image };
}
