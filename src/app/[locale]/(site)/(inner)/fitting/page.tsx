import type { Metadata } from "next";
import { BridalBooking } from "@/components/fitting/BridalBooking";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { currentCustomer } from "@/server/accounts";
import { bridalAvailability, FITTING_METHODS } from "@/server/bridal";
import { listProducts } from "@/server/catalog";
import { enabledPaymentMethods } from "@/server/content";
import { bridalSettings } from "@/server/fittings";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ piece?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = getDictionary(await resolveLocale(params));
  return { title: dict.bridal.crumb, description: dict.bridal.lead };
}

/**
 * EN: "Agendar prova de noiva" of design V3: wedding dresses → package → day and time → details → payment. Packages,
 *     days, times and rules come from Gestão → Provas; the price is computed again on the server.
 * PT: "Agendar prova de noiva" do V3: vestidos → pacote → dia e hora → dados → pagamento. Pacotes, dias, horas e regras
 *     vêm de Gestão → Provas; o valor é calculado de novo no servidor.
 */
export default async function FittingPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { piece } = await searchParams;
  const settings = await bridalSettings();
  const [dresses, days, methods, customer] = await Promise.all([
    listProducts({ fitting: true }, locale),
    bridalAvailability(settings),
    enabledPaymentMethods(),
    currentCustomer(),
  ]);

  return (
    <BridalBooking
      settings={{
        enabled: settings.enabled,
        packages: settings.packages
          .filter((p) => p.status !== "off")
          .map((p) => ({ key: p.key, name: p.name, dresses: p.dresses, minutes: p.minutes, price: p.price, includes: p.includes[locale], soon: p.status === "soon" })),
        extraMax: settings.extraMax,
        extraPrice: settings.extraPrice,
        discountDays: settings.discountDays,
        advanceHours: settings.advanceHours,
        cancelHours: settings.cancelHours,
        companions: settings.companions,
        requireTerms: settings.requireTerms,
        termsUrl: settings.termsUrl,
      }}
      dresses={dresses.map((p) => ({ slug: p.slug, code: p.code, collection: p.collection?.name ?? "", image: p.images[0]?.url ?? null }))}
      days={days}
      methods={FITTING_METHODS.filter((m) => methods.includes(m))}
      initialPieces={(piece ?? "").split(",").filter(Boolean).slice(0, 12)}
      customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null}
    />
  );
}
