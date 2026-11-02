import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/help/Help.module.css";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { LOYALTY_LEVELS, LOYALTY_RULES, LOYALTY_STEPS } from "@/data/help";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = getDictionary(await resolveLocale(params));
  return { title: dict.footer.loyalty };
}

/**
 * EN: "Programa de fidelidade" of design V3: the four levels (Rubi, Safira, Pérola, Diamante) with their icons, how it
 *     works in three steps, and the rules. The customer's own level is shown in the account.
 * PT: "Programa de fidelidade" do V3: os quatro níveis com os seus ícones, como funciona em três passos e as regras.
 *     O nível de cada cliente aparece na conta.
 */
export default async function LoyaltyPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const l = dict.loyalty;
  return (
    <>
      <section className={`page-x ${styles.hero}`}>
        <div className={styles.heroTitle}>
          <span className="eyebrow">{l.eyebrow}</span>
          <h1 className={styles.display}>
            <RichText text={l.title} />
          </h1>
        </div>
        <div className={styles.heroText}>
          <p className={styles.lead}>{l.lead}</p>
          <div className={styles.buttons}>
            <Link href={localizePath(locale, "/account")} className={styles.btn}>
              {l.seeLevel}
            </Link>
            <Link href={localizePath(locale, "/sign-in")} className={styles.btnOutline}>
              {l.createAccount}
            </Link>
          </div>
        </div>
      </section>

      <section className="page-x" aria-label={l.levels}>
        <div className={styles.levels}>
          {LOYALTY_LEVELS.map((level) => (
            <div key={level.key} className={styles.level}>
              <span style={{ color: level.color, display: "flex" }}>
                <Icon name={level.icon} size={36} />
              </span>
              <span className={styles.levelName}>{level.name[locale]}</span>
              <span className={styles.small}>
                {level.max == null ? t(l.from, { min: level.min }) : t(l.range, { min: level.min, max: level.max })}
              </span>
              <span className={styles.pct}>{level.pct}%</span>
              <span className={styles.discount}>{l.discount}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`page-x ${styles.steps}`}>
        {LOYALTY_STEPS.map((s) => (
          <div key={s.icon} className={styles.step}>
            <span className={styles.iconCircle}>
              <Icon name={s.icon} size={22} />
            </span>
            <span className={styles.stepTitle}>{s.title[locale]}</span>
            <p className={styles.muted}>{s.body[locale]}</p>
          </div>
        ))}
      </section>

      <section className="page-x" style={{ paddingBottom: 96 }}>
        <div className={styles.rules}>
          <h2 className={styles.rulesTitle}>
            <RichText text={l.rulesTitle} />
          </h2>
          <ul className={styles.rulesList}>
            {LOYALTY_RULES.map((r) => (
              <li key={r.pt}>
                <Icon name="check" size={18} />
                <span>{r[locale]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
