import type { Locale } from "@/types";

/**
 * EN: Maputo time helpers. Mozambique is UTC+2 all year (no summer time), so a fixed offset is exact and the
 *     server and the browser always agree, whatever their own time zone.
 * PT: Horas de Maputo. Moçambique está em UTC+2 o ano todo (sem hora de verão), por isso um desvio fixo é exacto
 *     e o servidor e o browser dão sempre o mesmo, seja qual for o fuso deles.
 */

const OFFSET_MS = 2 * 3_600_000;

/** EN: Date → { date: "2026-10-02", time: "11:00", weekday: 5 } in Maputo. PT: Em hora de Maputo. */
export function toMaputo(value: Date | string) {
  const d = new Date(new Date(value).getTime() + OFFSET_MS);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), weekday: d.getUTCDay() };
}

/** EN: "2026-10-02" + "11:00" (Maputo) → Date. PT: Data e hora de Maputo → Date. */
export function fromMaputo(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time}:00+02:00`);
}

export function addDays(date: string, days: number): string {
  return toMaputo(new Date(fromMaputo(date).getTime() + days * 86_400_000)).date;
}

/** EN: Monday of the week of `date`. PT: Segunda-feira da semana de `date`. */
export function mondayOf(date: string): string {
  const { weekday } = toMaputo(fromMaputo(date, "12:00"));
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export const todayMaputo = () => toMaputo(new Date()).date;

export function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  pt: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS: Record<Locale, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** EN: "sexta, 2 de outubro" / "Friday, 2 October". PT: Data por extenso. */
export function formatLongDate(date: string, locale: Locale): string {
  const { weekday } = toMaputo(fromMaputo(date, "12:00"));
  const [, m, d] = date.split("-").map(Number);
  return locale === "pt"
    ? `${WEEKDAYS.pt[weekday]}, ${d} de ${MONTHS.pt[m - 1]}`
    : `${WEEKDAYS.en[weekday]}, ${d} ${MONTHS.en[m - 1]}`;
}

/** EN: Short weekday: "Seg", "Mon". PT: Dia da semana abreviado. */
export function shortWeekday(date: string, locale: Locale): string {
  const { weekday } = toMaputo(fromMaputo(date, "12:00"));
  const name = WEEKDAYS[locale][weekday];
  return name.charAt(0).toUpperCase() + name.slice(1, 3);
}

export function monthName(month: number, locale: Locale): string {
  return MONTHS[locale][month - 1];
}
