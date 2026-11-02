"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addLine, cartCount, removeLine, setLineQuantity, toggleLater } from "@/lib/cart";
import type { CartLine } from "@/types";

/**
 * EN: Cart state for the browser, saved in localStorage so it survives a reload.
 *     The rules live in src/lib/cart.ts (shared with the future mobile app).
 * PT: Estado do carrinho no browser, guardado em localStorage para sobreviver a um recarregamento.
 *     As regras vivem em src/lib/cart.ts (partilhadas com a futura app móvel).
 */

// EN: Bump the version when the line shape changes. PT: Mudar a versão quando a forma da linha mudar.
const STORAGE_KEY = "eterna.cart.v2";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  /** EN: False until the saved cart is loaded. PT: Falso até o carrinho guardado ser carregado. */
  ready: boolean;
  /** EN: Adds and opens the quick cart (design V3). PT: Junta e abre o carrinho rápido. */
  add: (line: CartLine) => void;
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  toggleLater: (variantId: string) => void;
  /** EN: Removes what was bought; lines kept for later stay. PT: Tira o que foi comprado; o que é para depois fica. */
  clearBought: () => void;
  /** EN: Line just added, shown in the quick cart; null = closed. PT: Linha acabada de juntar; null = fechado. */
  justAdded: CartLine | null;
  closeQuick: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [justAdded, setJustAdded] = useState<CartLine | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setLines(saved);
    } catch {
      // EN: Storage blocked or corrupt: start empty. PT: Armazenamento bloqueado ou corrompido: começar vazio.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // EN: Private mode may block storage. PT: O modo privado pode bloquear o armazenamento.
    }
  }, [lines, ready]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => addLine(prev, line));
    setJustAdded(line);
  }, []);
  const remove = useCallback((variantId: string) => setLines((prev) => removeLine(prev, variantId)), []);
  const setQuantity = useCallback(
    (variantId: string, quantity: number) => setLines((prev) => setLineQuantity(prev, variantId, quantity)),
    [],
  );
  const toggle = useCallback((variantId: string) => setLines((prev) => toggleLater(prev, variantId)), []);
  const clearBought = useCallback(() => setLines((prev) => prev.filter((l) => l.later)), []);
  const closeQuick = useCallback(() => setJustAdded(null), []);

  const value = useMemo(
    () => ({ lines, count: cartCount(lines), ready, add, remove, setQuantity, toggleLater: toggle, clearBought, justAdded, closeQuick }),
    [lines, ready, add, remove, setQuantity, toggle, clearBought, justAdded, closeQuick],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
