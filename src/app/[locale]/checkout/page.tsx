import type { Metadata } from "next";
import { CheckoutView, type ReserveInfo } from "@/components/checkout/CheckoutView";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { findProduct } from "@/server/catalog";
import { endOfDayIn, isBridalStore, longDate, reservationSettings } from "@/server/reservations";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ reservar?: string; v?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const dict = getDictionary(await resolveLocale(params));
  return { title: (await searchParams).reservar ? dict.checkout.reserve.eyebrow : dict.cart.checkout, robots: { index: false } };
}

/**
 * EN: Checkout of the cart, or "Reservar esta peça" with ?reservar=<slug>&v=<variant> (design V3-Checkout-Reserva).
 * PT: Checkout do carrinho, ou "Reservar esta peça" com ?reservar=<slug>&v=<variante> (V3-Checkout-Reserva).
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { reservar, v } = await searchParams;
  let reserve: ReserveInfo | undefined;
  if (reservar && v) {
    const product = await findProduct(reservar, locale);
    const variant = product?.variants.find((x) => x.id === v && x.stock > 0);
    if (product && variant) {
      const s = await reservationSettings();
      const days = isBridalStore(variant.store?.code) ? s.bridalDays : s.days;
      const end = endOfDayIn(days);
      const until = locale === "pt" ? longDate(end) : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" }).format(end);
      reserve = { product, variantId: variant.id, storeCode: variant.store?.code ?? "02", depositPct: s.depositPct, days, baseDays: s.days, bridalDays: s.bridalDays, until };
    }
  }
  return <CheckoutView reserve={reserve} />;
}
