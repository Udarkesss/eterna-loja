import type { ColorFamily } from "@/types";

/**
 * EN: Colours and size systems of design V3, shared by "Editar produto" and the Excel import.
 * PT: Cores e sistemas de tamanhos do V3, partilhados por "Editar produto" e pela importação Excel.
 */

/** EN: The V3 palette (name, English, colour, filter family). PT: A paleta do V3. */
export const PALETTE: [string, string, string, ColorFamily | null][] = [
  ["Branco", "White", "#FFFFFF", "off_white"],
  ["Marfim", "Ivory", "#F4EFE3", "off_white"],
  ["Creme", "Cream", "#F1E6CF", "off_white"],
  ["Pérola", "Pearl", "#EAE4DA", "off_white"],
  ["Champanhe", "Champagne", "#E9D9B6", "beige"],
  ["Nude", "Nude", "#E3C6AE", "beige"],
  ["Bege", "Beige", "#D9C3A5", "beige"],
  ["Castanho", "Brown", "#6B4A35", "beige"],
  ["Mostarda", "Mustard", "#C9A13B", "gold"],
  ["Amarelo", "Yellow", "#E9C93F", "gold"],
  ["Laranja", "Orange", "#D9732F", "red"],
  ["Salmão", "Salmon", "#E9967A", "fuchsia"],
  ["Blush", "Blush", "#EEC9C3", "fuchsia"],
  ["Rosa", "Pink", "#E58FA8", "fuchsia"],
  ["Rosa-velho", "Dusty pink", "#C49092", "fuchsia"],
  ["Rosa-choque", "Hot pink", "#D6337A", "fuchsia"],
  ["Vermelho", "Red", "#B3202A", "red"],
  ["Vinho", "Wine", "#6E1F2F", "red"],
  ["Lilás", "Lilac", "#B9A2C9", "fuchsia"],
  ["Lavanda", "Lavender", "#C8BFE0", "blue"],
  ["Violeta", "Violet", "#6F4A8E", "blue"],
  ["Azul-claro", "Light blue", "#9CC3E4", "blue"],
  ["Azul", "Blue", "#2F5BB7", "blue"],
  ["Azul-marinho", "Navy", "#1F2A44", "blue"],
  ["Verde-menta", "Mint", "#A9DCC7", "green"],
  ["Verde-claro", "Light green", "#9CC9A0", "green"],
  ["Verde", "Green", "#2E7D4F", "green"],
  ["Verde-seco", "Olive", "#6E7B4C", "green"],
  ["Cinzento", "Grey", "#8D8D8D", "black"],
  ["Preto", "Black", "#111111", "black"],
  ["Dourado", "Gold", "#C8A24A", "gold"],
  ["Prateado", "Silver", "#C9CCD1", "off_white"],
  ["Rosegold", "Rose gold", "#D8A39A", "gold"],
  ["Multicolor", "Multicolour", "#B3202A", null],
];

/** EN: Size systems of the design. PT: Sistemas de tamanhos do design. */
export const SIZE_SYSTEMS: Record<string, { label: string; sizes: string[] }> = {
  clothing: { label: "Vestuário · US · EU · letra", sizes: ["2US/34EUR/XS", "4US/36EUR/S", "6US/38EUR/S", "8US/40EUR/M", "10US/42EUR/M", "12US/44EUR/L", "16US/48EUR/XL", "18US/50EUR/XXL", "20US/52EUR/XXXL"] },
  letters: { label: "Só letra", sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] },
  shoes: { label: "Calçado · US → EU", sizes: ["5", "6", "7", "7.5", "8", "8.5", "9", "10", "11"] },
  bras: { label: "Soutiens", sizes: ["32A", "32B", "34A", "34B", "34C", "36B", "36C", "36D", "38B", "38C", "38D"] },
  length: { label: "Comprimento", sizes: ["26W", "28W", "30W", "32W", "34W", "36W"] },
  one: { label: "Tamanho único", sizes: ["Tamanho único"] },
};
