"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/data/site";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";

/**
 * EN: The design's main menu — Noivas · Ocasiões · Beyond Time · Acessórios · Modeladores — used by BOTH navbars.
 *     The current section gets aria-current="page".
 * PT: O menu principal do design, usado pelas DUAS barras. A secção actual recebe aria-current="page".
 */
export function NavLinks({ linkClassName, withFitting, fittingClassName }: {
  linkClassName: string;
  withFitting?: boolean;
  fittingClassName?: string;
}) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();

  return (
    <>
      {mainNav.map((item) => {
        const href = resolveHref(item.href, locale);
        const current = !item.href.startsWith("#") && pathname.startsWith(href);
        return (
          <li key={item.href}>
            <Link href={href} className={linkClassName} aria-current={current ? "page" : undefined}>
              {item.label[locale]}
            </Link>
          </li>
        );
      })}
      {withFitting && (
        <li>
          <Link href={resolveHref("#prova", locale)} className={fittingClassName}>
            {dict.nav.bookFitting}
          </Link>
        </li>
      )}
    </>
  );
}
