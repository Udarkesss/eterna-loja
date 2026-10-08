import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { infoPages, legalPages } from "@/data/site";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { getSection } from "@/server/content";

type Props = { params: Promise<{ locale: string; slug: string }> };
type InfoSlug = (typeof infoPages)[number] | (typeof legalPages)[number];

const ALL = [...infoPages, ...legalPages] as readonly string[];
const isInfo = (s: string): s is InfoSlug => ALL.includes(s);

function titleOf(slug: InfoSlug, dict: ReturnType<typeof getDictionary>): string {
  if (slug === "termos") return dict.checkout.termsLink;
  if (slug === "privacidade") return dict.checkout.privacy;
  return dict.footer.infoPages[slug];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  return isInfo(slug) ? { title: titleOf(slug, getDictionary(locale)) } : {};
}

/**
 * EN: "Informações" pages from the footer (Tamanhos, Trocas & Devoluções, …). Their text is edited in
 *     Gestão · 8 (page "Informações"); until then the design's [placeholder] is shown.
 * PT: Páginas "Informações" do rodapé. O texto é editado em Gestão · 8; até lá aparece o [marcador] do design.
 */
export default async function InfoPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  if (!isInfo(slug)) notFound();
  const dict = getDictionary(locale);
  const content = await getSection<{ body?: string }>("info", slug, locale);

  return (
    <>
      <PageHead eyebrow={dict.footer.info} title={titleOf(slug, dict)} />
      <PageBody>
        {(content?.body ?? dict.pages.toWrite).split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </PageBody>
    </>
  );
}
