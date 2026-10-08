"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCustomer } from "@/components/account/CustomerProvider";
import { api } from "@/lib/api-client";

/**
 * EN: Saved pieces (heart button). Without an account they stay in this browser. After sign-in the browser list
 *     is merged into the account (table `favorites`) and from then on they follow the customer to other devices.
 * PT: Peças guardadas (botão coração). Sem conta ficam neste browser. Ao entrar, a lista do browser junta-se à
 *     conta (tabela `favorites`) e a partir daí acompanha a cliente noutros aparelhos.
 */

const STORAGE_KEY = "eterna.favorites.v1";

interface FavoritesValue {
  slugs: string[];
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

function readLocal(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((s) => typeof s === "string") : [];
  } catch {
    return []; // EN: storage blocked. PT: armazenamento bloqueado.
  }
}

function writeLocal(slugs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // EN: private mode. PT: modo privado.
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer();
  const customerId = customer?.id ?? null;
  const [slugs, setSlugs] = useState<string[]>([]);
  const syncedFor = useRef<string | null | undefined>(undefined);

  // EN: Load from the browser, or merge into the account after sign-in. PT: Carregar ou juntar à conta.
  useEffect(() => {
    if (syncedFor.current === customerId) return;
    syncedFor.current = customerId;
    const local = readLocal();
    if (!customerId) {
      setSlugs(local);
      return;
    }
    (local.length ? api.addFavorites(local) : api.favorites())
      .then((server) => {
        setSlugs(server);
        writeLocal([]);
      })
      .catch(() => setSlugs(local));
  }, [customerId]);

  const toggle = useCallback(
    (slug: string) => {
      setSlugs((prev) => {
        const on = prev.includes(slug);
        const next = on ? prev.filter((s) => s !== slug) : [...prev, slug];
        if (customerId) {
          (on ? api.removeFavorite(slug) : api.addFavorites([slug])).catch(() => setSlugs(prev));
        } else {
          writeLocal(next);
        }
        return next;
      });
    },
    [customerId],
  );

  const value = useMemo(() => ({ slugs, isFavorite: (s: string) => slugs.includes(s), toggle }), [slugs, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return ctx;
}
