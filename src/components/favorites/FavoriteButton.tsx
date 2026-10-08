"use client";

import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { useFavorites } from "./FavoritesProvider";
import styles from "./FavoriteButton.module.css";

/**
 * EN: Heart button. "round" = over a product photo; "square" = next to "Marcar prova" on the product page.
 * PT: Botão coração. "round" = sobre a foto; "square" = ao lado de "Marcar prova" na página de produto.
 */
export function FavoriteButton({ slug, code, variant = "round" }: { slug: string; code: string; variant?: "round" | "square" }) {
  const { dict } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(slug);
  const label =
    variant === "round"
      ? t(on ? dict.product.favRemove : dict.product.favAdd, { code })
      : on
        ? dict.product.favRemoveShort
        : dict.product.favAddShort;

  return (
    <button type="button" className={styles[variant]} aria-label={label} aria-pressed={on} onClick={() => toggle(slug)}>
      <Icon name="heart" size={20} filled={on} />
    </button>
  );
}
