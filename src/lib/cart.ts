import type { CartLine } from "@/types";

/**
 * EN: Pure cart functions (no React, no storage). They return new arrays and never mutate.
 *     A line is one variant (colour + size) of a product.
 * PT: Funções puras do carrinho (sem React, sem armazenamento). Devolvem arrays novos, nunca alteram.
 *     Uma linha é uma variante (cor + tamanho) de um produto.
 */

export const MAX_QUANTITY = 10;

export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (!existing) return [...lines, { ...line, quantity: Math.min(line.quantity, MAX_QUANTITY) }];
  return lines.map((l) =>
    l === existing ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QUANTITY) } : l,
  );
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export function setLineQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, variantId);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, MAX_QUANTITY) } : l));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * EN: `priceOf` returns the current unit price, or undefined if the product no longer exists.
 * PT: `priceOf` devolve o preço unitário actual, ou undefined se o produto já não existir.
 */
export function cartTotal(lines: CartLine[], priceOf: (slug: string) => number | undefined): number {
  return lines.reduce((sum, l) => sum + (priceOf(l.slug) ?? 0) * l.quantity, 0);
}
