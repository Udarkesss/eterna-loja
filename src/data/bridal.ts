import type { Localized } from "@/types";

/**
 * EN: Eterna Bridal fittings of design V3 (terms and conditions of Eterna Bridal): packages, extra dresses, days, start
 *     times and rules. These are the starting values; they are edited in Gestão → Provas · Bridal (setting
 *     "fittings.bridal").
 * PT: Provas da Eterna Bridal do V3 (termos e condições da Eterna Bridal): pacotes, vestidos extra, dias, horas de
 *     início e regras. São os valores iniciais; editam-se em Gestão → Provas · Bridal.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });

export type PackageStatus = "active" | "soon" | "off";

export interface BridalPackage {
  key: string;
  name: string;
  dresses: number;
  minutes: number;
  price: number; // MT
  includes: Localized;
  status: PackageStatus; // EN: "soon" shows it without booking. PT: "brevemente" mostra sem deixar marcar.
}

export interface BridalSettings {
  enabled: boolean;
  packages: BridalPackage[];
  extraMax: number;
  extraPrice: number;
  discountDays: number; // EN: the fee is deducted from the dress bought within these days. PT: desconta no vestido.
  days: number[]; // EN: 1 = Monday … 7 = Sunday. PT: 1 = segunda … 7 = domingo.
  hours: string[]; // "12:00"
  advanceHours: number;
  cancelHours: number;
  companions: number;
  noShowFee: boolean;
  requireTerms: boolean;
  termsUrl: string | null; // EN: PDF of the terms. PT: PDF dos termos.
}

export const BRIDAL_DEFAULT: BridalSettings = {
  enabled: true,
  packages: [
    { key: "satin", name: "Satin", dresses: 3, minutes: 60, price: 3000, includes: L("Ambiente exclusivo · noiva e até 2 acompanhantes", "Private room · bride and up to 2 companions"), status: "active" },
    { key: "silk", name: "Silk", dresses: 5, minutes: 120, price: 5000, includes: L("Ambiente exclusivo · noiva e até 2 acompanhantes", "Private room · bride and up to 2 companions"), status: "active" },
    {
      key: "cashmere",
      name: "Cashmere",
      dresses: 6,
      minutes: 180,
      price: 7500,
      includes: L("Bebidas do menu especial (à parte) · fotografias autorizadas", "Drinks from the special menu (paid separately) · photos allowed"),
      status: "soon",
    },
  ],
  extraMax: 3,
  extraPrice: 1000,
  discountDays: 30,
  days: [2, 4, 5, 6],
  hours: ["12:00", "14:00", "15:00", "16:00"],
  advanceHours: 48,
  cancelHours: 24,
  companions: 2,
  noShowFee: true,
  requireTerms: true,
  termsUrl: null,
};

/** EN: Price of a fitting: package + extra dresses. PT: Valor da prova: pacote + vestidos extra. */
export function fittingPrice(settings: BridalSettings, packageKey: string, extras: number): number | null {
  const pkg = settings.packages.find((p) => p.key === packageKey && p.status === "active");
  if (!pkg || extras < 0 || extras > settings.extraMax) return null;
  return pkg.price + extras * settings.extraPrice;
}
