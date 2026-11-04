import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservationConfirmation } from "@/components/checkout/ReservationConfirmation";
import { resolveLocale } from "@/i18n/params";
import { getDb } from "@/server/db";
import { reservations } from "@/server/db/schema";
import { reservationByToken } from "@/server/reservations";
import { eq } from "drizzle-orm";

type Props = { params: Promise<{ locale: string; token: string }> };

export const metadata: Metadata = { robots: { index: false } };

/**
 * EN: Confirmation of a reservation (design V3-Confirmacao, "reserva"). The address uses the reservation's private token.
 * PT: Confirmação de uma reserva (V3-Confirmacao, "reserva"). O endereço usa o código privado da reserva.
 */
export default async function ReservationPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const { token } = await params;
  const reservation = await reservationByToken(token);
  if (!reservation) notFound();
  const db = await getDb();
  const [row] = await db.select({ at: reservations.createdAt }).from(reservations).where(eq(reservations.token, token));
  const created = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" }).format(row.at);
  return <ReservationConfirmation initial={reservation} created={created} />;
}
