/**
 * EN: Size labels of design V3. Stored as "6US/38EUR/S" (US/EU/letter); shown as the letter with "6 US · 38 EU" below,
 *     and sorted along the scale (00, 0, 2…22, then W sizes, letters, one size).
 * PT: Tamanhos do design V3. Guardados como "6US/38EUR/S"; mostrados como a letra com "6 US · 38 EU" por baixo, e
 *     ordenados pela escala (00, 0, 2…22, depois W, letras, tamanho único).
 */

export interface SizeParts {
  letter: string; // "S", "Único", "18W", "8.5"
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
  return { letter: size === "Tamanho único" ? "Único" : size, detail: null };
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
