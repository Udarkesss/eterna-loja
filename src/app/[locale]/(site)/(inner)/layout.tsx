import type { ReactNode } from "react";
import { CompactFooter } from "@/components/layout/Footer";
import { resolveLocale } from "@/i18n/params";

/** EN: Inner pages (category, product, bag…) use the design's compact footer. PT: Páginas interiores: rodapé compacto. */
export default async function InnerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <>
      {children}
      <CompactFooter locale={locale} />
    </>
  );
}
