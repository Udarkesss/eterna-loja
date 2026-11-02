import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { resolveLocale } from "@/i18n/params";

/**
 * EN: Store frame: announcement bar + the two-row header of design V3. Footers are added by the home page (full) and
 *     by (inner) (compact).
 * PT: Moldura da loja: faixa de anúncio + cabeçalho de duas linhas do design V3. Os rodapés vêm do Início (completo) e
 *     de (inner).
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <>
      <AnnouncementBar locale={locale} />
      <Header locale={locale} />
      <main id="main">{children}</main>
    </>
  );
}
