"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import s from "./admin.module.css";

/**
 * EN: Side menu of design V3 in groups (Loja · Catálogo · Site · Sistema). The server already removed the items this
 *     role cannot see (design "O que cada papel vê"); an empty group is not shown.
 * PT: Menu lateral do V3 em grupos (Loja · Catálogo · Site · Sistema). O servidor já retirou os itens que este papel não
 *     vê; um grupo vazio não aparece.
 */
export interface NavItem {
  group: "Loja" | "Catálogo" | "Site" | "Sistema";
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const GROUPS: NavItem["group"][] = ["Loja", "Catálogo", "Site", "Sistema"];

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // EN: The most specific item wins ("Importar" inside "Produtos"). PT: Ganha o item mais específico.
  const current = items
    .filter((i) => (i.href === "/gestao" ? path === "/gestao" : path === i.href || path.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <>
      {GROUPS.map((group) => {
        const list = items.filter((i) => i.group === group);
        if (!list.length) return null;
        return (
          <div key={group} className={s.navGroup}>
            <span className={s.groupLabel}>{group}</span>
            <nav aria-label={group} className={s.nav}>
              {list.map((item) => (
                <Link key={item.href} href={item.href} aria-current={item.href === current ? "page" : undefined} className={s.navLink}>
                  <Icon name={item.icon} size={18} />
                  {item.label}
                  {!!item.badge && <span className={s.badge}>{item.badge}</span>}
                </Link>
              ))}
            </nav>
          </div>
        );
      })}
    </>
  );
}
