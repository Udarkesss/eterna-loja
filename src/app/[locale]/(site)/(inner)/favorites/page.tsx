import type { Metadata } from "next";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).nav.favorites, robots: { index: false } };
}

/** EN: Pieces saved with the heart button. PT: Peças guardadas com o coração. */
export default async function FavoritesPage({ params }: Props) {
  const dict = getDictionary(await resolveLocale(params));
  return (
    <>
      <PageHead title={dict.favorites.title} />
      <PageBody>
        <FavoritesList />
      </PageBody>
    </>
  );
}
