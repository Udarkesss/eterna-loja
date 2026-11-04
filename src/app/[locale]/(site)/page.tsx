import type { ReactNode } from "react";
import { HeroSlides, HeroV3, type HeroSlide, type HeroV3Data } from "@/components/home/HomeInteractive";
import { Acessorios, Colecao, Contactos, Entrada, Modeladores, Noivas, Novidades, Ocasioes, Sobre } from "@/components/home/HomeV3";
import { Parallax } from "@/components/home/Parallax";
import { ScrollEffects } from "@/components/layout/Effects";
import { SiteFooter } from "@/components/layout/Footer";
import { resolveLocale } from "@/i18n/params";
import { CampaignBand } from "@/components/campaign/CampaignBand";
import { SeasonBand } from "@/components/season/SeasonBand";
import { SeasonFx } from "@/components/season/SeasonFx";
import seasonStyles from "@/components/season/Season.module.css";
import { contactsView } from "@/server/contacts";
import { getFraming } from "@/server/framing";
import { activeSeason } from "@/server/seasons";
import { siteCampaign } from "@/server/campaigns";
import { activeCollection, findCategory, listProducts, seasonalSlugs } from "@/server/catalog";
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

  const [campaign, season, framing, contacts] = await Promise.all([siteCampaign(locale), activeSeason(locale), getFraming(), contactsView("contacts")]);
  // EN: Cover picked from a video frame in Gestão → Enquadrar. PT: Capa escolhida de um fotograma em Enquadrar.
  const posterOf = (video: string | undefined, fallback: string) => (video && framing[video]?.poster) || fallback;
  const [tiles, newProducts, stores, active, showPrice, seasonal, campaignProducts] = await Promise.all([
    getOccasionTiles(locale),
    listProducts({ sort: "newest", limit: Number(novidades?.count) || 8 }, locale),
    listStores(locale),
    activeCollection(locale),
    cardPriceVisible(),
    seasonalSlugs(),
    campaign && campaign.homePlacement !== "none" ? listProducts({ ids: campaign.productIds.slice(0, 40) }, locale) : Promise.resolve([]),
  ]);
  // EN: Time of the year (Gestão → Conteúdo → Épocas do ano): section before or after the collection and the effect.
  // PT: Época do ano: secção antes ou depois da colecção e o efeito.
  // EN: Without chosen pieces, the newest of the button's category. PT: Sem peças escolhidas, as mais novas da categoria do botão.
  const seasonCategory = season?.href.startsWith("category:") ? season.href.slice(9) : null;
  const seasonProducts = !season
    ? []
    : season.codes.length
      ? await listProducts({ slugs: season.codes.map((x) => x.toLowerCase()) }, locale)
      : seasonCategory
        ? await listProducts({ category: seasonCategory, limit: 12 }, locale)
        : [];
  const seasonBand = season && season.placement !== "none" && <SeasonBand season={{ ...season, images: season.media === "video" ? [posterOf(season.video, season.images[0] ?? ""), ...season.images.slice(1)] : season.images }} products={seasonProducts.filter((p) => p.stock > 0)} showPrice={showPrice} locale={locale} />;
  // EN: Campaign band before or after the collection (Gestão → Nova campanha → Onde aparece). PT: Faixa antes ou depois da colecção.
  const band = campaign && campaign.homePlacement !== "none" && (
    <CampaignBand campaign={campaign} products={campaign.productIds.map((id) => campaignProducts.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p && p.stock > 0)} showPrice locale={locale} />
  );
  // EN: The active collection (Gestão → Colecções); otherwise the one chosen in the content. PT: A colecção activa.
  const collection = active ?? (typeof colecao?.collection === "string" ? await findCategory(colecao.collection, locale) : null);
  // EN: Links to a seasonal collection follow the active one ("Comprar Essenza"). PT: Ligações a uma colecção seguem a activa.
  const shop = locale === "pt" ? "Comprar" : "Shop";
  const follow = <T extends { label: string; href: string } | undefined>(cta: T): T => {
    if (!cta || !active) return cta;
    const slug = cta.href.startsWith("category:") ? cta.href.slice(9).split("?")[0] : null;
    if (!slug || !seasonal.includes(slug) || slug === active.slug) return cta;
    const label = cta.label.startsWith(`${shop} `) ? `${shop} ${active.name}` : cta.label;
    return { ...cta, href: cta.href.replace(`category:${slug}`, `category:${active.slug}`), label } as T;
  };
  const hero = data("hero") as (HeroV3Data & { parallax?: boolean; parallaxIntensity?: number; progress?: boolean; reveal?: boolean }) | undefined;
  // EN: "Slides" or "Vídeo", chosen in Gestão; slides switched off are left out. PT: Slides desligados ficam de fora.
  const heroView = (d: HeroV3Data & { media?: string; slides?: HeroSlide[]; slidesAuto?: boolean }) => {
    const slides = (d.slides ?? []).filter((s) => s.on && s.image);
    return d.media === "slides" && slides.length ? <HeroSlides slides={slides} auto={!!d.slidesAuto} /> : <HeroV3 data={d} />;
  };

  /* eslint-disable @typescript-eslint/no-explicit-any -- EN: section data comes from the content editor. PT: dados vindos do editor. */
  const render: Record<string, (d: any) => ReactNode> = {
    hero: (d) => heroView({ ...d, poster: posterOf(d.videoDesktop, d.poster), cta: follow(d.cta) }),
    entrada: (d) =>
      active?.message ? (
        <Entrada
          data={{ ...d, body: active.message, cta: { label: active.buttonText ?? `${locale === "pt" ? "Descobrir" : "Discover"} ${active.name}`, href: active.buttonLink ?? `category:${active.slug}` } }}
          locale={locale}
        />
      ) : (
        <Entrada data={{ ...d, cta: follow(d.cta) }} locale={locale} />
      ),
    colecao: (d) => (
      <>
        {campaign?.homePlacement === "before" && band}
        {season?.placement === "before" && seasonBand}
        <Colecao data={d} collection={collection} locale={locale} />
        {season?.placement === "after" && seasonBand}
        {campaign?.homePlacement === "after" && band}
      </>
    ),
    ocasioes: (d) => <Ocasioes data={d} tiles={tiles} locale={locale} />,
    novidades: (d) => <Novidades data={d} products={newProducts} showPrice={showPrice} locale={locale} />,
    noivas: (d) => <Noivas data={{ ...d, poster: posterOf(d.video, d.poster) }} locale={locale} />,
    acessorios: (d) => <Acessorios data={d} />,
    modeladores: (d) => <Modeladores data={d} locale={locale} />,
    sobre: (d) => <Sobre data={d} social={contacts.social} />,
    contactos: (d) => <Contactos data={d} stores={stores} contacts={contacts} locale={locale} />,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      {season && <div className={seasonStyles.garland} aria-hidden="true" />}
      {season && season.effect !== "none" && <SeasonFx effect={season.effect} />}
      <Parallax enabled={hero?.parallax ?? true} intensity={hero?.parallaxIntensity ?? 0.25} />
      <ScrollEffects progress={hero?.progress !== false} reveal={hero?.reveal !== false} />
      {sections.map((s, i) => (
        <div key={s.key} data-reveal={i > 0 ? "" : undefined}>
          {render[s.key]?.(s.data)}
        </div>
      ))}
      <SiteFooter locale={locale} />
    </>
  );
}
