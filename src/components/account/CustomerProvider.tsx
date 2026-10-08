"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { CustomerDTO } from "@/types";

/**
 * EN: The signed-in customer for client components. The server passes the first value (no flash on load);
 *     sign-in / sign-out update it without reloading.
 * PT: A cliente com sessão, para os componentes de cliente. O servidor passa o primeiro valor (sem piscar);
 *     entrar / sair actualizam-no sem recarregar.
 */

interface CustomerValue {
  customer: CustomerDTO | null;
  setCustomer: (c: CustomerDTO | null) => void;
  signOut: () => Promise<void>;
}

const CustomerContext = createContext<CustomerValue | null>(null);

export function CustomerProvider({ initial, children }: { initial: CustomerDTO | null; children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerDTO | null>(initial);
  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setCustomer(null);
  }, []);
  const value = useMemo(() => ({ customer, setCustomer, signOut }), [customer, signOut]);
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used inside <CustomerProvider>");
  return ctx;
}
