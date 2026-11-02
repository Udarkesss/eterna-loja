import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/Footer";
import { resolveLocale } from "@/i18n/params";

/** EN: Inner pages (category, product, bag…) share the V3 footer. PT: Páginas interiores com o rodapé do V3. */
export default async function InnerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <>
      {children}
      <SiteFooter locale={locale} />
    </>
  );
}
