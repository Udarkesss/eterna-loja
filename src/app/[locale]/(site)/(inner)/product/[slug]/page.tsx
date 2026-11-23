import type { Metadata } from "next";
import { reservationSettings } from "@/server/reservations";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail, ProductPanels } from "@/components/product/ProductDetail";
import detail from "@/components/product/ProductDetail.module.css";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Icon } from "@/components/ui/Icon";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { RichText } from "@/components/ui/RichText";
import { getDictionary, t } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { categoryHref } from "@/lib/links";
import { findCategory, findProduct, relatedProducts } from "@/server/catalog";
import { cardPriceVisible } from "@/server/content";
import styles from "./product.module.css";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const product = await findProduct((await params).slug, locale);
  if (!product) return {};
  return {
    title: `${product.name} ${product.code}`,
    description: product.description,
    openGraph: product.images[0] ? { images: [product.images[0].url] } : undefined,
  };
}

/**
 * EN: Product page of design V3 ("Loja · Produto: cor, tamanho e reserva"):
 *     the interactive block, the information lines (secure payment, free collection, final sales), the panels and
 *     "Complete o look".
 * PT: Página da peça do V3: o bloco interactivo, as linhas de informação
 *     (pagamento seguro, levantamento grátis, vendas finais), os painéis e "Complete o look".
 */
export default async function ProductPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const product = await findProduct((await params).slug, locale);
  if (!product) notFound();

  const dict = getDictionary(locale);
  const [related, showPrice, typeCategory, rules] = await Promise.all([
    relatedProducts(product, locale),
    cardPriceVisible(),
    product.type ? findCategory(product.type.slug, locale) : Promise.resolve(null),
    reservationSettings(),
  ]);
  // EN: The line is the type's group (Roupa Executiva, Acessórios de Festa…). PT: A linha é o grupo do tipo.
  const line = typeCategory?.parent ?? null;
  const storeCode = product.variants.find((v) => v.store)?.store?.code ?? "02";
  const eyebrow = [product.collection?.name, product.type?.name].filter(Boolean).join(" · ");
  const badge = [product.isNew ? dict.product.new : null, product.collection?.name].filter(Boolean).join(" · ") || null;

  const panels = [
    { title: dict.product.panels.description, body: product.description },
    ...(product.composition ? [{ title: dict.product.panels.composition, body: product.composition }] : []),
    // EN: Collection and reservation in one panel, and the final-sale note in "Trocas e devoluções", so the whole column
    //     fits beside the photo (owner 2026-11-23). PT: Levantamento e reserva num só painel, e a nota de vendas finais
    //     em "Trocas e devoluções", para a coluna caber ao lado da foto (dona 23-11-2026).
    {
      title: dict.product.panels.pickup,
      body: `${t(dict.product.panels.pickupBody, { store: storeCode })}\n\n${t(dict.product.panels.reservationBody, { pct: rules.depositPct, days: rules.days, bridalDays: rules.bridalDays })}`,
    },
    { title: dict.product.panels.returns, body: `${dict.product.panels.returnsBody}\n\n${dict.product.tryInStore}` },
  ];

  return (
    <>

      <ProductDetail product={product} eyebrow={eyebrow} badge={badge} reserve={{ depositPct: rules.depositPct, days: rules.days, bridalDays: rules.bridalDays }}>
        <ul className={detail.trust}>
          <li className={detail.trustItem}>
            <span className={detail.trustIcon}>
              <Icon name="lock" size={18} />
            </span>
            <span className={detail.grow}>{dict.product.securePayment}</span>
            <PaymentLogos label={dict.common.paymentLogos} small />
          </li>
        </ul>
        <ProductPanels panels={panels} />
      </ProductDetail>

      {related.length > 0 && (
        <section className={`page-x ${styles.related}`}>
          <div className={styles.relatedHead}>
            <div className={styles.relatedTitles}>
              {eyebrow && <span className="eyebrow">{[product.collection?.name, line?.name].filter(Boolean).join(" · ")}</span>}
              <h2 className={styles.relatedTitle}>
                <RichText text={dict.product.completeLook} />
              </h2>
            </div>
            {line && (
              <Link href={categoryHref(line.slug, locale)} className="link-line">
                {t(dict.product.seeCategory, { name: line.name })}
              </Link>
            )}
          </div>
          <ProductGrid products={related.slice(0, 4)} locale={locale} showPrice={showPrice} />
        </section>
      )}
    </>
  );
}
