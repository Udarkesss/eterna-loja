/**
 * EN: Delivery price and timing rules shared by the checkout (browser) and the server (the real calculation).
 *     Modes from the design ("Gestão · 4 Entregas · Preço da entrega"): fixed · by zone · by distance from the store.
 * PT: Regras de preço e tempo da entrega, partilhadas pelo checkout (browser) e pelo servidor (o cálculo real).
 *     Modos do design: valor fixo · por zona · por distância a partir da loja.
 */

/** EN: Glória Mall, Maputo — where deliveries leave from. PT: Glória Mall — de onde saem as entregas. */
export const STORE_ORIGIN = { lat: -25.9655, lng: 32.5892 };

export interface DeliveryPricing {
  mode: "fixed" | "zone" | "distance";
  fixedFee: number | null;
  baseFee: number | null;
  perKm: number | null;
  maxFee: number | null;
}

export const DEFAULT_PRICING: DeliveryPricing = { mode: "zone", fixedFee: null, baseFee: null, perKm: null, maxFee: null };

/** EN: Straight-line distance in km (haversine). PT: Distância em linha recta, em km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * EN: Delivery fee in MT, or null when Eterna has not set the value yet ("[valor]" in the design).
 * PT: Preço da entrega em MT, ou null enquanto a Eterna não definir o valor ("[valor]" no design).
 */
export function deliveryFee(pricing: DeliveryPricing, zoneFee: number | null | undefined, point?: { lat: number; lng: number } | null): number | null {
  if (pricing.mode === "fixed") return pricing.fixedFee;
  if (pricing.mode === "distance") {
    if (pricing.baseFee == null || pricing.perKm == null || !point) return null;
    // EN: Roads are ~30% longer than a straight line. PT: As estradas são ~30% mais longas do que a linha recta.
    const km = distanceKm(STORE_ORIGIN, point) * 1.3;
    const fee = Math.round((pricing.baseFee + pricing.perKm * km) / 10) * 10;
    return pricing.maxFee != null ? Math.min(fee, pricing.maxFee) : fee;
  }
  return zoneFee ?? null;
}

/** EN: "30–45 min" → 45 (upper bound, for the expected arrival). PT: Limite superior, para a hora prevista. */
export function etaMinutes(eta: string | null | undefined, fallback = 45): number {
  const numbers = (eta ?? "").match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.max(...numbers) : fallback;
}
