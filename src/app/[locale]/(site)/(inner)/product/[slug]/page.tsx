import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail, ProductPanels } from "@/components/product/ProductDetail";
import detail from "@/components/product/ProductDetail.module.css";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Icon } from "@/components/ui/Icon";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { RichText } from "@/components/ui/RichText";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import { categoryHref } from "@/lib/links";
import { findCategory, findProduct, relatedProducts } from "@/server/catalog";
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
 * EN: Product page ("Produto · 8G1L7" in the design).
 * PT: Página de produto ("Produto · 8G1L7" no design).
 */
export default async function ProductPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const product = await findProduct((await params).slug, locale);
  if (!product) notFound();

  const dict = getDictionary(locale);
  const related = await relatedProducts(product, locale);
  const occasion = product.occasions[0];
  const occasionParent = occasion ? (await findCategory(occasion.slug, locale))?.parent : null;
  const storeCode = product.variants.find((v) => v.store)?.store?.code ?? "02";

  const panels = [
    { title: dict.product.panels.description, body: product.description },
    ...(product.composition ? [{ title: dict.product.panels.composition, body: product.composition }] : []),
    { title: dict.product.panels.shipping, body: t(dict.product.panels.shippingBody, { store: storeCode }) },
    { title: dict.product.panels.returns, body: dict.product.panels.returnsBody },
  ];

  return (
    <>
      <nav aria-label={dict.nav.breadcrumb} className={`page-x ${styles.breadcrumb}`}>
        <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
        {occasion && (
          <>
            <span aria-hidden="true">/</span>
            {occasionParent && (
              <>
                <Link href={categoryHref(occasionParent.slug, locale)}>{occasionParent.name}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <Link href={categoryHref(occasion.slug, locale)}>{occasion.name}</Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.code}</span>
      </nav>

      <ProductDetail product={product}>
        <ul className={detail.trust}>
          <li className={detail.trustItem}>
            <span className={detail.trustIcon}>
              <Icon name="lock" size={18} />
            </span>
            <span className={detail.grow}>{dict.product.securePayment}</span>
            <PaymentLogos label={dict.common.paymentLogos} small />
          </li>
          <li className={detail.trustItem}>
            <span className={detail.trustIcon}>
              <Icon name="store" size={18} />
            </span>
            {t(dict.product.pickupAt, { store: storeCode })}
          </li>
          <li className={detail.trustItem}>
            <span className={detail.trustIcon}>
              <Icon name="return" size={18} />
            </span>
            <Link href={localizePath(locale, "/info/trocas-devolucoes")}>{dict.product.exchanges}</Link>
          </li>
        </ul>
        <ProductPanels panels={panels} />
      </ProductDetail>

      {related.length > 0 && (
        <section className={`page-x ${styles.related}`}>
          <div className={styles.relatedHead}>
            <h2 className={styles.relatedTitle}>
              <RichText text={dict.product.related} />
            </h2>
            {occasion && (
              <Link href={categoryHref(occasion.slug, locale)} className="link-line">
                {t(dict.product.seeCategory, { name: occasion.name })}
              </Link>
            )}
          </div>
          <ProductGrid products={related} locale={locale} meta="none" />
        </section>
      )}
    </>
  );
}
