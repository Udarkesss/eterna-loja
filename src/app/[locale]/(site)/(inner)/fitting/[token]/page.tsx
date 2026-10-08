import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/layout/PageHead";
import { ButtonLink } from "@/components/ui/Button";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { formatLongDate, toMaputo } from "@/lib/time";
import { findFittingByToken, toFittingPublicDTO } from "@/server/fittings";
import styles from "./request.module.css";

type Props = { params: Promise<{ locale: string; token: string }> };

async function load(params: Props["params"]) {
  const locale = await resolveLocale(params);
  const { token } = await params;
  const row = await findFittingByToken(token);
  if (!row) notFound();
  return { locale, fitting: await toFittingPublicDTO(row, locale) };
}

/**
 * EN: The link in the WhatsApp message. The first piece's photo is the preview image (og:image), so the team sees
 *     it in the chat once the site is online. No phone or personal data here; the token is hard to guess.
 * PT: O link da mensagem de WhatsApp. A foto da primeira peça é a pré-visualização (og:image). Sem telefone nem
 *     dados pessoais; o código do endereço é difícil de adivinhar.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, fitting } = await load(params);
  const when = toMaputo(fitting.startsAt);
  const title = `${fitting.code} · ${FITTING_KIND_LABELS[fitting.kind][locale]}`;
  const description = `${formatLongDate(when.date, locale)}, ${when.time} · Loja ${fitting.store.code} · ${fitting.products.map((p) => p.code).join(", ")}`;
  const image = fitting.products.find((p) => p.imageUrl)?.imageUrl;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, ...(image ? { images: [{ url: image, width: 1200, height: 1500 }] } : {}) },
  };
}

export default async function FittingRequestPage({ params }: Props) {
  const { locale, fitting } = await load(params);
  const dict = getDictionary(locale);
  const f = dict.fitting;
  const when = toMaputo(fitting.startsAt);

  return (
    <>
      <PageHead eyebrow={`${f.requestEyebrow} · ${fitting.code}`} title={FITTING_KIND_LABELS[fitting.kind][locale]}>
        <span className={styles.status} data-tone={fitting.status}>
          {f.status[fitting.status]}
        </span>
      </PageHead>
      <div className={`page-x ${styles.body}`}>
        <dl className={styles.facts}>
          <div>
            <dt>{f.when}</dt>
            <dd>
              {formatLongDate(when.date, locale)}, {when.time}
            </dd>
          </div>
          <div>
            <dt>{f.where}</dt>
            <dd>{fitting.store.location}</dd>
          </div>
          <div>
            <dt>{f.kind}</dt>
            <dd>{FITTING_KIND_LABELS[fitting.kind][locale]}</dd>
          </div>
        </dl>

        <section className={styles.pieces}>
          <h2 className={styles.h2}>{f.piecesTitle}</h2>
          {fitting.products.length === 0 && <p className={styles.muted}>{f.noPiecesChosen}</p>}
          <div className={styles.grid}>
            {fitting.products.map((p) => (
              <Link key={p.slug} href={`/${locale}/product/${p.slug}`} className={styles.piece}>
                <span className={styles.media}>
                  {p.imageUrl && <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width: 600px) 50vw, 25vw" className={styles.img} />}
                </span>
                <span className={styles.code}>{p.code}</span>
                <span className={styles.muted}>{p.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className={styles.actions}>
          {(fitting.status === "requested" || fitting.status === "pending") && (
            <ButtonLink href={fitting.whatsappUrl}>{f.openWhatsapp}</ButtonLink>
          )}
          <ButtonLink href={`/${locale}/fitting`} variant="outline">
            {f.bookAnother}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
