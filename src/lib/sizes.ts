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

export function sizeParts(size: string): SizeParts {
  const parts = size.split("/");
  if (parts.length === 3) {
    const us = parts[0].replace(/US$/, " US").replace(/^(\d+)P$/, "$1 P");
    return { letter: parts[2], detail: `${us} · ${parts[1].replace(/EUR$/, " EU")}` };
  }
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
