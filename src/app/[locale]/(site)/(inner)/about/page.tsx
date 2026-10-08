import type { Metadata } from "next";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { site } from "@/data/site";
import { getDictionary, t } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { getSection } from "@/server/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).pages.about };
}

/** EN: "Sobre nós" (content page in Gestão · 8). PT: "Sobre nós" (página de conteúdo em Gestão · 8). */
export default async function AboutPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const content = await getSection<{ body?: string }>("about", "body", locale);

  return (
    <>
      <PageHead title={dict.pages.about} />
      <PageBody>
        <p>{t(dict.footer.tagline, { year: site.foundedYear })}</p>
        {(content?.body ?? dict.pages.toWrite).split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </PageBody>
    </>
  );
}
