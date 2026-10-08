"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import s from "./admin.module.css";

/**
 * EN: Side menu. The server already removed the items this role cannot see (design "O que cada papel vê").
 * PT: Menu lateral. O servidor já retirou os itens que este papel não vê.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/gestao" ? path === "/gestao" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Administração" className={s.nav}>
      {items.map((item) => (
        <Link key={item.href + item.label} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={s.navLink}>
          <Icon name={item.icon} size={18} />
          {item.label}
          {!!item.badge && <span className={s.badge}>{item.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
