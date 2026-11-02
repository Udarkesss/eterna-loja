import type { ReactNode } from "react";
import { HeroV3, type HeroV3Data } from "@/components/home/HomeInteractive";
import { Acessorios, Colecao, Contactos, Entrada, Modeladores, Noivas, Novidades, Ocasioes, Sobre } from "@/components/home/HomeV3";
import { Parallax } from "@/components/home/Parallax";
import { SiteFooter } from "@/components/layout/Footer";
import { resolveLocale } from "@/i18n/params";
import { findCategory, listProducts } from "@/server/catalog";
import { cardPriceVisible, getOccasionTiles, getPageSections, listStores } from "@/server/content";

/**
 * EN: Home page of design V3 (Início 1/2 and 2/2). Sections are drawn in the order and visibility set in
 *     Gestão → Conteúdo do site; "announcement" is drawn by the layout.
 * PT: Página inicial do design V3. As secções aparecem pela ordem e visibilidade definidas em Gestão → Conteúdo do
 *     site; "announcement" é desenhada pelo layout.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const sections = await getPageSections("home", locale);
  const data = (key: string) => sections.find((s) => s.key === key)?.data as Record<string, unknown> | undefined;
  const novidades = data("novidades");
  const colecao = data("colecao");

  const [tiles, newProducts, stores, collection, showPrice] = await Promise.all([
    getOccasionTiles(locale),
    listProducts({ sort: "newest", limit: Number(novidades?.count) || 8 }, locale),
    listStores(locale),
    typeof colecao?.collection === "string" ? findCategory(colecao.collection, locale) : Promise.resolve(null),
    cardPriceVisible(),
  ]);
  const hero = data("hero") as (HeroV3Data & { parallax?: boolean; parallaxIntensity?: number }) | undefined;

  /* eslint-disable @typescript-eslint/no-explicit-any -- EN: section data comes from the content editor. PT: dados vindos do editor. */
  const render: Record<string, (d: any) => ReactNode> = {
    hero: (d) => <HeroV3 data={d} />,
    entrada: (d) => <Entrada data={d} locale={locale} />,
    colecao: (d) => <Colecao data={d} collection={collection} locale={locale} />,
    ocasioes: (d) => <Ocasioes data={d} tiles={tiles} locale={locale} />,
    novidades: (d) => <Novidades data={d} products={newProducts} showPrice={showPrice} locale={locale} />,
    noivas: (d) => <Noivas data={d} locale={locale} />,
    acessorios: (d) => <Acessorios data={d} />,
    modeladores: (d) => <Modeladores data={d} locale={locale} />,
    sobre: (d) => <Sobre data={d} />,
    contactos: (d) => <Contactos data={d} stores={stores} locale={locale} />,
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
