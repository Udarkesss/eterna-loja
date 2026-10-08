import type { Metadata } from "next";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import styles from "@/components/home/Home.module.css";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { site, whatsappLink } from "@/data/site";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { listStores } from "@/server/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).pages.contact };
}

/** EN: "Contactos": the two stores, phones, e-mail and WhatsApp (data from the design). PT: Lojas e contactos. */
export default async function ContactPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const stores = await listStores(locale);

  return (
    <>
      <PageHead title={dict.pages.contact} />
      <PageBody>
        <div className={styles.storeList} style={{ maxWidth: 720 }}>
          {stores.map((s) => (
            <div key={s.code} className={styles.storeRow}>
              <div className={styles.storeName}>
                <span className={styles.storeTitle}>{s.name}</span>
                <span className={styles.storeLocation}>
                  {s.location}
                  {s.hours ? ` · ${s.hours}` : ""}
                </span>
              </div>
              <a href={`tel:${s.phone.replace(/\s/g, "")}`} className={styles.storePhone}>
                {s.phone}
              </a>
            </div>
          ))}
        </div>
        <p>
          <a href={`mailto:${site.email}`} className="underline">
            {site.email}
          </a>
        </p>
        <div>
          <ButtonLink href={whatsappLink()}>
            <Icon name="whatsapp" size={18} />
            {dict.common.whatsapp}
          </ButtonLink>
        </div>
      </PageBody>
    </>
  );
}
