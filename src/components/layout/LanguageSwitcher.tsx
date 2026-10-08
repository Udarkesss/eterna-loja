"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./LanguageSwitcher.module.css";

/**
 * EN: PT | EN switch. Keeps the visitor on the same page and remembers the choice in a cookie.
 * PT: Troca PT | EN. Mantém a visitante na mesma página e guarda a escolha num cookie.
 */
export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();

  function pathFor(target: Locale) {
    const parts = pathname.split("/");
    parts[1] = target;
    return parts.join("/");
  }

  function remember(target: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <nav aria-label={dict.nav.language}>
      <ul className={styles.list}>
        {LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={pathFor(l)}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              aria-label={LOCALE_NAMES[l]}
              className={styles.link}
              onClick={() => remember(l)}
            >
              {l.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
