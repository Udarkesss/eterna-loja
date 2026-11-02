"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/data/site";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";

/**
 * EN: The main menu of design V3 (src/data/site.ts mainNav). No "Agendar prova" here: in V3 the fitting is booked from
 *     the Noivas section. The current section gets aria-current="page".
 * PT: O menu principal do design V3. Sem "Agendar prova": na V3 a prova marca-se na secção Noivas. A secção actual
 *     recebe aria-current="page".
 */
export function NavLinks({ linkClassName }: { linkClassName: string }) {
  const { locale } = useI18n();
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
    </>
  );
}
