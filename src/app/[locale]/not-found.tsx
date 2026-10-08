"use client";

import { PageBody, PageHead } from "@/components/layout/PageHead";
import { ButtonLink } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * EN: 404 inside a language (e.g. /en/product/unknown). Client component so it can read the current language.
 * PT: 404 dentro de um idioma (ex.: /pt/product/desconhecido). Componente de cliente para ler o idioma actual.
 */
export default function LocaleNotFound() {
  const { dict, href } = useI18n();
  return (
    <main id="main">
      <PageHead title={dict.notFound.title} />
      <PageBody>
        <p>{dict.notFound.text}</p>
        <div>
          <ButtonLink href={href("/")} variant="outline">
            {dict.common.backHome}
          </ButtonLink>
        </div>
      </PageBody>
    </main>
  );
}
