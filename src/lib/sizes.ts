/**
 * EN: Size labels of design V3. Stored as "6US/38EUR/S" (US/EU/letter); shown as the letter with "6 US · 38 EU" below,
 *     and sorted along the scale (00, 0, 2…22, then waist sizes (26W), letters, one size).
 * PT: Tamanhos do design V3. Guardados como "6US/38EUR/S"; mostrados como a letra com "6 US · 38 EU" por baixo, e
 *     ordenados pela escala (00, 0, 2…22, depois cintura (26W), letras, tamanho único).
 */

export interface SizeParts {
  letter: string; // "S", "Único", "26W", "38 EU"
  detail: string | null; // "6 US · 38 EU" or null
}

/**
 * EN: Women's shoe sizes (US → EU, cm), from the Eterna size guide (Informações → Tamanhos); half sizes as usual.
 * PT: Tamanhos de sapatos de senhora (US → EU, cm), da tabela da Eterna (Informações → Tamanhos); meios números habituais.
 */
const SHOES: Record<string, [eu: number, cm: number]> = {
  "5": [35, 22],
  "5.5": [35.5, 22.5],
  "6": [36, 23],
  "6.5": [37, 23.5],
  "7": [37.5, 24],
  "7.5": [38, 24.5],
  "8": [38.5, 25],
  "8.5": [39, 25.5],
  "9": [40, 26],
  "9.5": [41, 26.5],
  "10": [42, 27],
  "10.5": [42.5, 27.5],
  "11": [43, 28],
};

/**
 * EN: Letter-only sizes (e.g. "XL"), from the Eterna size guide (Informações → Tamanhos); XXS from the catalogue scale.
 * PT: Tamanhos só com letra (ex. "XL"), da tabela da Eterna (Informações → Tamanhos); XXS da escala do catálogo.
 */
const LETTER_SIZES: Record<string, string> = {
  XXS: "00–0 US · 30–32 EU",
  XS: "2 US · 32–34 EU",
  S: "4–6 US · 36–38 EU",
  M: "8–10 US · 40–42 EU",
  L: "12–14 US · 44–46 EU",
  XL: "16–18 US · 48–50 EU",
  XXL: "20–22 US · 52–54 EU",
  XXXL: "24 US · 56 EU",
};

/**
 * EN: Trouser sizes "26W" = waist in inches (W = waist), not plus sizes: waist in cm and the usual EU size.
 * PT: Tamanhos de calças "26W" = cintura em polegadas (W = waist), não plus size: cintura em cm e o tamanho EU habitual.
 */
const WAIST: Record<string, [cm: number, eu: number]> = {
  "24W": [61, 32],
  "25W": [64, 33],
  "26W": [66, 34],
  "27W": [69, 35],
  "28W": [71, 36],
  "29W": [74, 37],
  "30W": [76, 38],
  "31W": [79, 39],
  "32W": [81, 40],
  "33W": [84, 41],
  "34W": [86, 42],
  "36W": [91, 44],
  "38W": [97, 46],
  "40W": [102, 48],
};

export function sizeParts(size: string): SizeParts {
  const parts = size.split("/");
  if (parts.length === 3) {
    const us = parts[0].replace(/US$/, " US").replace(/^(\d+)P$/, "$1 P");
    return { letter: parts[2], detail: `${us} · ${parts[1].replace(/EUR$/, " EU")}` };
  }
  // EN: Shoes ("7.5" = US): the EU size large, US and cm below, like clothes (owner 2026-11-22).
  // PT: Sapatos ("7.5" = US): o tamanho europeu em grande, US e cm por baixo, como na roupa (dona 22-11-2026).
  const shoe = SHOES[size];
  if (shoe) return { letter: `${shoe[0]} EU`, detail: `${size} US · ${shoe[1]} cm` };
  const waist = WAIST[size.toUpperCase()];
  if (waist) return { letter: size.toUpperCase(), detail: `${waist[0]} cm · ${waist[1]} EU` };
  return { letter: size === "Tamanho único" ? "Único" : size, detail: LETTER_SIZES[size.toUpperCase()] ?? null };
}

const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function sizeKey(size: string): number {
  const eu = size.match(/\/(\d+)EUR\//);
  if (eu) return Number(eu[1]);
  const w = size.match(/^(\d+)W$/);
  if (w) return 100 + Number(w[1]);
  const shoe = size.match(/^(\d+(?:\.\d)?)$/);
  if (shoe) return 150 + Number(shoe[1]);
  const letter = LETTERS.indexOf(size);
  if (letter >= 0) return 200 + letter;
  return size === "Único" ? 400 : 300;
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => sizeKey(a) - sizeKey(b));
}
