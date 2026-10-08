"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * EN: While a payment is pending, reloads the server data every 4 s ("Esta página actualiza sozinha").
 * PT: Enquanto o pagamento está pendente, recarrega os dados a cada 4 s ("Esta página actualiza sozinha").
 */
export function OrderAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
