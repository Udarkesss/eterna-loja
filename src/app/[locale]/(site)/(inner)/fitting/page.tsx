import type { Metadata } from "next";
import { FittingBooking } from "@/components/fitting/FittingBooking";
import { PageHead } from "@/components/layout/PageHead";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { todayMaputo } from "@/lib/time";
import { currentCustomer } from "@/server/accounts";
import { listStores } from "@/server/content";
import { fittingSchedule } from "@/server/fittings";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ piece?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dict = getDictionary(await resolveLocale(params));
  return { title: dict.nav.bookFitting, description: dict.fitting.intro };
}

/**
 * EN: "Agendar prova". Signed-in customers only choose occasion, store and time (name and phone come from the account).
 * PT: "Agendar prova". Com sessão, a cliente só escolhe ocasião, loja e hora (nome e telefone vêm da conta).
 */
export default async function FittingPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const { piece } = await searchParams;
  const [stores, schedule, customer] = await Promise.all([listStores(locale), fittingSchedule(), currentCustomer()]);

  return (
    <>
      <PageHead eyebrow={dict.fitting.eyebrow} title={dict.fitting.title}>
        <p style={{ maxWidth: 560, color: "var(--ink-muted)", lineHeight: "24px" }}>{dict.fitting.intro}</p>
      </PageHead>
      <FittingBooking
        stores={stores.map((s) => ({ code: s.code, name: s.name, location: s.location }))}
        schedule={{ days: schedule.days, maxDaysAhead: Math.min(schedule.maxDaysAhead, 28), bridalMinutes: schedule.bridalMinutes, defaultMinutes: schedule.defaultMinutes }}
        today={todayMaputo()}
        customer={customer ? { name: customer.name, phone: customer.phone } : null}
        initialPiece={piece ?? null}
      />
    </>
  );
}
