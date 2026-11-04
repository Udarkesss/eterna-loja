"use client";

import Link from "next/link";
import { mainNav } from "@/data/site";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";
import { useSectionNav } from "./useSectionNav";

/**
 * EN: The main menu of design V3 (src/data/site.ts mainNav): every item is a section of the home page; on the home page
 *     it scrolls there and the section in view is underlined (useSectionNav). The first item (the active collection) is
 *     gold.
 * PT: O menu principal do V3: cada item é uma secção do Início; no Início desliza até lá e a secção à vista fica
 *     sublinhada. O primeiro item (a colecção activa) é dourado.
 */
export function NavLinks({ linkClassName, collectionClassName, collection }: { linkClassName: string; collectionClassName?: string; collection?: string }) {
  const { locale } = useI18n();
  const { active, go } = useSectionNav();

  return (
    <>
      {mainNav.map((item, i) => {
        const id = item.href.replace(/^#/, "");
        const className = i === 0 && collectionClassName ? `${linkClassName} ${collectionClassName}` : linkClassName;
        return (
          <li key={item.href}>
            <Link
              href={resolveHref(item.href, locale)}
              className={className}
              aria-current={active === id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(id);
              }}
            >
              {i === 0 && collection ? collection : item.label[locale]}
            </Link>
          </li>
        );
      })}
    </>
  );
}

/** EN: The logo: on the home page it scrolls back to the top. PT: O logótipo: no Início volta ao topo. */
export function HomeLogoLink({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  const { locale } = useI18n();
  const { go, onHome } = useSectionNav();
  return (
    <Link
      href={`/${locale}`}
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!onHome) return;
        e.preventDefault();
        go("");
      }}
    >
      {children}
    </Link>
  );
}
