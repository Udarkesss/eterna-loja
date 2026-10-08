import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).cart.title, robots: { index: false } };
}

export default async function CartPage({ params }: Props) {
  const dict = getDictionary(await resolveLocale(params));
  return (
    <>
      <PageHead title={dict.cart.title} />
      <PageBody>
        <CartView />
      </PageBody>
    </>
  );
}
