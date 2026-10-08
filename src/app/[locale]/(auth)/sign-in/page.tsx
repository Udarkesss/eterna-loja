import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/account/AuthPanel";
import { RichText } from "@/components/ui/RichText";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { currentCustomer } from "@/server/accounts";
import styles from "./sign-in.module.css";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).account.tabs.login, robots: { index: false } };
}

/**
 * EN: "Conta · Entrar ou criar conta" — full-page layout from the design (photo left, form right; photo hidden on phones).
 * PT: Página inteira do design (foto à esquerda, formulário à direita; sem foto no telemóvel).
 */
export default async function SignInPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const { next } = await searchParams;
  // EN: Only local paths, never another site. PT: Só caminhos locais, nunca outro site.
  const target = next && /^\/(pt|en)(\/|$)/.test(next) ? next : `/${locale}/account`;
  if (await currentCustomer()) redirect(target);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.photo}>
        <Image src="/images/content/white-collection.webp" alt={dict.account.imageAlt} fill priority sizes="50vw" className={styles.img} />
        <span className={styles.badge}>{dict.account.imageBadge}</span>
      </div>
      <div className={styles.side}>
        <Link href={`/${locale}`} className={styles.logo} aria-label={dict.nav.home}>
          ETERNA
        </Link>
        <div className={styles.head}>
          <span className="eyebrow">{dict.account.eyebrow}</span>
          <h1 className={styles.title}>
            <RichText text={dict.account.welcome} />
          </h1>
        </div>
        <AuthPanel next={target} />
      </div>
    </main>
  );
}
