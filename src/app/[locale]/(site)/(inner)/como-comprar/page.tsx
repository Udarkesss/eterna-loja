import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/help/Help.module.css";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { HOW_TO_BUY } from "@/data/help";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import { bridalSettings } from "@/server/fittings";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = getDictionary(await resolveLocale(params));
  return { title: dict.footer.howToBuy };
}

/**
 * EN: "Como comprar" of design V3 ("Loja · Como comprar"): an index on the left and one section per topic (buying,
 *     reserving, payment, collection, exchanges, loyalty and the Eterna Bridal fitting rules).
 * PT: "Como comprar" do V3: índice à esquerda e uma secção por tema (comprar, reservar, pagamento, levantamento,
 *     trocas, fidelidade e as regras da prova da Eterna Bridal).
 */
export default async function HowToBuyPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  // EN: The terms PDF uploaded in Gestão → Provas → Pacotes e regras (design V3: "Termos e condições (PDF)").
  // PT: O PDF dos termos carregado na gestão; sem PDF, abre a página dos termos.
  const pdf = (await bridalSettings()).termsUrl;
  return (
    <section className={`page-x ${styles.page}`}>
      <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
        <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
        <span aria-hidden="true">/</span>
        <span>{dict.help.eyebrow}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{dict.footer.howToBuy}</span>
      </nav>
      <div className={styles.head}>
        <span className="eyebrow">{dict.help.eyebrow}</span>
        <h1 className={styles.display}>
          <RichText text={dict.help.title} />
        </h1>
        <p className={styles.muted}>
          {dict.help.intro}{" "}
          {pdf ? (
            <a href={pdf} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {dict.help.termsLink} (PDF)
            </a>
          ) : (
            <Link href={localizePath(locale, "/info/termos")} className={styles.link}>
              {dict.help.termsLink}
            </Link>
          )}
          .
        </p>
      </div>
      <div className={styles.layout}>
        <nav aria-label={dict.help.onThisPage} className={styles.index}>
          {HOW_TO_BUY.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={styles.indexLink}>
              {s.title[locale]}
            </a>
          ))}
        </nav>
        <div className={styles.sections}>
          {HOW_TO_BUY.map((s) => (
            <section key={s.id} id={s.id} className={styles.section}>
              <span className={styles.iconCircle}>
                <Icon name={s.icon} size={22} />
              </span>
              <div className={styles.sectionBody}>
                <h2 className={styles.sectionTitle}>{s.title[locale]}</h2>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className={styles.muted}>
                    <RichText text={p[locale]} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
