import type { ReactNode } from "react";
import { QuickCart } from "@/components/cart/QuickCart";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { BrandScrollbar } from "@/components/layout/Effects";
import { Header } from "@/components/layout/Header";
import { resolveLocale } from "@/i18n/params";
import { getSiteEffects } from "@/server/content";
import { framingCss } from "@/server/framing";

/**
 * EN: Store frame: announcement bar + the two-row header of design V3 and the brand scrollbar. The footer (the same
 *     everywhere) is added by the home page and by (inner).
 * PT: Moldura da loja: faixa de anúncio + cabeçalho de duas linhas do design V3 e a scrollbar da marca. O rodapé (igual
 *     em todo o lado) vem do Início e de (inner).
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const [effects, framing] = await Promise.all([getSiteEffects(), framingCss()]);
  return (
    <>
      {/* EN: Framing chosen in Gestão → Enquadrar. PT: Enquadramento escolhido na gestão. */}
      {framing && <style dangerouslySetInnerHTML={{ __html: framing }} />}
      <BrandScrollbar on={effects.scrollbar} />
      <AnnouncementBar locale={locale} />
      <Header locale={locale} />
      <main id="main">{children}</main>
      <QuickCart />
    </>
  );
}
