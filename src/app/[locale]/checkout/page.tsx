import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).cart.checkout, robots: { index: false } };
}

export default async function CheckoutPage({ params }: Props) {
  await resolveLocale(params);
  return <CheckoutView />;
}
