"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * EN: Category filters live in the URL (?size=…&color=…&price=…&sort=…&type=…), so a filtered page can be shared
 *     or reloaded and the server renders the right products.
 * PT: Os filtros da categoria vivem no endereço, para uma página filtrada poder ser partilhada ou recarregada.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const values = useCallback((key: string) => params.get(key)?.split(",").filter(Boolean) ?? [], [params]);

  const update = useCallback(
    (changes: Record<string, string[] | string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        const str = Array.isArray(value) ? value.join(",") : value;
        if (str) next.set(key, str);
        else next.delete(key);
      }
      next.delete("n"); // EN: back to the first page of results. PT: voltar à primeira página de resultados.
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const current = values(key);
      update({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
    },
    [update, values],
  );

  return { params, values, update, toggle };
}
