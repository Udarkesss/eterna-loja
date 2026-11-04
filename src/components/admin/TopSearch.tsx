"use client";

import { usePathname, useSearchParams } from "next/navigation";
import s from "@/components/admin/admin.module.css";
import { Icon } from "@/components/ui/Icon";

/**
 * EN: Search of the V3 top bar. Each screen searches its own list (design: "Procurar clientes", "Procurar vouchers ou
 *     clientes"); elsewhere it searches orders, pieces or customers.
 * PT: Pesquisa da barra de topo do V3. Cada ecrã procura na sua lista; nos outros procura encomendas.
 */
const SCOPES: { prefix: string; action: string; label: string }[] = [
  { prefix: "/gestao/clientes", action: "/gestao/clientes", label: "Procurar clientes" },
  { prefix: "/gestao/descontos", action: "/gestao/descontos", label: "Procurar vouchers ou clientes" },
];

export function TopSearch() {
  const path = usePathname();
  const params = useSearchParams();
  const scope = SCOPES.find((x) => path.startsWith(x.prefix)) ?? { action: "/gestao/encomendas", label: "Procurar encomendas, peças ou clientes" };
  const here = path.startsWith(scope.action);
  return (
    <form action={scope.action} className={s.topSearch} role="search" key={scope.action}>
      <Icon name="search" size={18} />
      <input name="q" placeholder={scope.label} aria-label={scope.label} defaultValue={here ? (params.get("q") ?? "") : ""} />
    </form>
  );
}
