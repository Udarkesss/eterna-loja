import { Parallax } from "@/components/home/Parallax";
import { HeroMedia, type HeroData } from "@/components/home/HeroMedia";
import {
  Bridal,
  Experience,
  Manifesto,
  NewArrivals,
  Occasions,
  PriveeBand,
  PriveeDivider,
  Secure,
  Social,
  Stores,
} from "@/components/home/HomeSections";
import { SiteFooter } from "@/components/layout/Footer";
import { resolveLocale } from "@/i18n/params";
import { listProducts } from "@/server/catalog";
import { getOccasionTiles, getPageSections, listStores } from "@/server/content";
import type { ReactNode } from "react";

/**
 * EN: Home page ("Início"). Sections are drawn in the order and visibility set in Gestão · 8 Conteúdo do site.
 * PT: Página inicial. As secções aparecem pela ordem e visibilidade definidas em Gestão · 8 Conteúdo do site.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const [sections, tiles, newProducts, stores] = await Promise.all([
    getPageSections("home", locale),
    getOccasionTiles(locale),
    listProducts({ isNew: undefined, limit: 4 }, locale),
    listStores(locale),
  ]);

  const hero = sections.find((s) => s.key === "hero")?.data as HeroData | undefined;

  // EN: key → component. "announcement" is drawn by the layout. PT: "announcement" é desenhada pelo layout.
  /* eslint-disable @typescript-eslint/no-explicit-any -- EN: section data comes from the content editor. PT: dados vindos do editor. */
  const render: Record<string, (data: any) => ReactNode> = {
    hero: (data) => <HeroMedia data={data} />,
    manifesto: (data) => <Manifesto data={data} locale={locale} />,
    occasions: (data) => <Occasions data={data} tiles={tiles} locale={locale} />,
    new_arrivals: (data) => <NewArrivals data={data} products={newProducts} locale={locale} />,
    privee_divider: (data) => <PriveeDivider data={data} />,
    bridal: (data) => <Bridal data={data} locale={locale} />,
    experience: (data) => <Experience data={data} />,
    privee_band: (data) => <PriveeBand data={data} locale={locale} />,
    secure: (data) => <Secure data={data} locale={locale} />,
    stores: (data) => <Stores data={data} stores={stores} locale={locale} />,
    social: (data) => <Social data={data} locale={locale} />,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      <Parallax enabled={hero?.parallax ?? true} intensity={hero?.parallaxIntensity ?? 0.25} />
      {sections.map((s) => (
        <div key={s.key}>{render[s.key]?.(s.data)}</div>
      ))}
      <SiteFooter locale={locale} />
    </>
  );
}
