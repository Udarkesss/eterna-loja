import type { FittingKind, FittingStatus, Localized } from "@/types";

/**
 * EN: Fitting kinds and statuses as shown to customers and to the team (design: "Gestão · 5 Provas").
 * PT: Tipos e estados de prova como aparecem à cliente e à equipa.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });

export const FITTING_KIND_LABELS: Record<FittingKind, Localized> = {
  bride_white: L("Noiva · The White Collection", "Bride · The White Collection"),
  bride_privee: L("Noiva · Eterna Privée", "Bride · Eterna Privée"),
  bride_second: L("Noiva · 2.ª prova", "Bride · 2nd fitting"),
  bridesmaid_mother: L("Madrinha & Mãe da Noiva", "Bridesmaid & Mother of the Bride"),
  engagement_lobolo: L("Noivado & Lobolo", "Engagement & Lobolo"),
  gala: L("Gala", "Gala"),
  guest: L("Convidada", "Wedding guest"),
  graduation: L("Formatura", "Graduation"),
  corporate: L("Evento Corporativo", "Corporate event"),
  other: L("Outra ocasião", "Other occasion"),
};

/** EN: Team labels (PT, as in the design). PT: Rótulos da equipa, como no design. */
export const FITTING_STATUS_LABELS: Record<FittingStatus, string> = {
  requested: "Pedido pelo site",
  pending: "Por confirmar",
  confirmed: "Confirmada",
  done: "Realizada",
  no_show: "Faltou",
  cancelled: "Cancelada",
};

/**
 * EN: Default schedule until Eterna gives the real one (editable in Gestão · Definições).
 *     days: 1 = Monday … 6 = Saturday. Times are Maputo time (UTC+2).
 * PT: Horário provisório até a Eterna dar o verdadeiro (editável em Gestão · Definições).
 */
export const FITTING_SETTINGS_DEFAULT = {
  days: [1, 2, 3, 4, 5, 6],
  open: "09:00",
  close: "18:00",
  stepMinutes: 30,
  bridalMinutes: 90,
  defaultMinutes: 60,
  leadHours: 2, // EN: earliest booking from now. PT: antecedência mínima.
  maxDaysAhead: 90,
};
export type FittingSettings = typeof FITTING_SETTINGS_DEFAULT;
