import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
// import { DesignHeader } from "@/components/layout/DesignHeader";
import { resolveLocale } from "@/i18n/params";

/**
 * EN: Store frame: announcement bar + navbar. Footers are added by the home page (full) and by (inner) (compact).
 *     NAVBAR CHOICE: <Header> is active. To use the design's own navbar, swap the two lines below.
 * PT: Moldura da loja: faixa de anúncio + barra de navegação. Os rodapés vêm do Início (completo) e de (inner).
 *     ESCOLHA DA BARRA: <Header> está activa. Para usar a barra do design, trocar as duas linhas abaixo.
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <>
      <AnnouncementBar locale={locale} />
      <Header locale={locale} />
      {/* <DesignHeader /> */}
      <main id="main">{children}</main>
    </>
  );
}
