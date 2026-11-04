import "server-only";
import { inSeason, SEASONS_DEFAULT, type Season } from "@/data/seasons";
import { todayMaputo } from "@/lib/time";
import type { Locale } from "@/types";
import { getSetting } from "./settings";

/**
 * EN: Times of the year (Gestão · Conteúdo do site → Épocas do ano), stored in the "seasons" setting.
 * PT: Épocas do ano, guardadas na definição "seasons".
 */
export const listSeasons = () => getSetting<Season[]>("seasons", SEASONS_DEFAULT);

export interface SeasonView {
  id: string;
  effect: Season["effect"];
  placement: Season["placement"];
  textSide: Season["textSide"];
  media: Season["media"];
  images: string[];
  video: string;
  badge: string;
  title: string;
  text: string;
  button: string;
  href: string;
  bar: string;
  codes: string[];
  colors: Season["colors"];
  from: string;
  to: string;
}

/** EN: The time of the year running today (the first switched on). PT: A época a decorrer hoje. */
export async function activeSeason(locale: Locale): Promise<SeasonView | null> {
  const today = todayMaputo().slice(5);
  const s = (await listSeasons()).find((x) => x.on && inSeason(x, today));
  if (!s) return null;
  const t = (v: { pt: string; en: string }) => v[locale] || v.pt;
  return {
    id: s.id,
    effect: s.effect,
    placement: s.placement,
    textSide: s.textSide,
    media: s.media,
    images: s.images,
    video: s.video,
    badge: t(s.badge),
    title: t(s.title),
    text: t(s.text),
    button: t(s.button),
    href: s.href,
    bar: t(s.bar),
    codes: s.codes,
    colors: s.colors,
    from: s.from,
    to: s.to,
  };
}
