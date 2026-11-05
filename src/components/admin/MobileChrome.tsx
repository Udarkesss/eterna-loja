"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { NavItem } from "./AdminNav";
import s from "./admin.module.css";
import { TopSearch } from "./TopSearch";

/**
 * EN: Phone frame of design V3-M-G-*: black top bar (menu · ETERNA Gestão · search · notices) and the bottom tab bar
 *     (Painel · Encomendas · Reservas · Provas · Menu). Tabs the role cannot see are left out (server already filtered).
 * PT: Moldura do telemóvel do V3: barra preta no topo e barra de separadores em baixo. Os separadores que o papel não vê
 *     não aparecem (o servidor já os filtrou).
 */
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/gestao", label: "Painel", icon: "grid" },
  { href: "/gestao/encomendas", label: "Encomendas", icon: "bag" },
  { href: "/gestao/reservas", label: "Reservas", icon: "hourglass" },
  { href: "/gestao/provas", label: "Provas", icon: "dress" },
];

export function MobileTop({ notices }: { notices: number }) {
  const [search, setSearch] = useState(false);
  return (
    <>
      <header className={s.mtop}>
        <span>
          <Link href="/gestao/menu" className={s.mIco} aria-label="Abrir menu">
            <Icon name="menu" size={22} />
          </Link>
        </span>
        <Link href="/gestao" className={s.mWord}>
          <b>ETERNA</b>
          <span>Gestão</span>
        </Link>
        <span className={s.mRight}>
          <button type="button" className={s.mIco} aria-label="Procurar" aria-expanded={search} onClick={() => setSearch((v) => !v)}>
            <Icon name="search" size={20} />
          </button>
          <Link href="/gestao" className={s.mIco} aria-label={`Avisos, ${notices} por tratar`}>
            <Icon name="bell" size={20} />
            {notices > 0 && <span className={s.mCount}>{notices}</span>}
          </Link>
        </span>
      </header>
      {search && (
        <div className={s.mSearch}>
          <Suspense fallback={null}>
            <TopSearch />
          </Suspense>
        </div>
      )}
    </>
  );
}

export function MobileTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const allowed = new Map(items.map((i) => [i.href, i]));
  const tabs = TABS.filter((t) => allowed.has(t.href));
  const active = path === "/gestao/menu" ? "menu" : tabs.filter((t) => (t.href === "/gestao" ? path === "/gestao" : path.startsWith(t.href))).at(-1)?.href;
  return (
    <nav className={s.mnav} aria-label="Gestão" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)` }}>
      {tabs.map((t) => {
        const badge = allowed.get(t.href)?.badge;
        return (
          <Link key={t.href} href={t.href} aria-current={active === t.href ? "page" : undefined}>
            <Icon name={t.icon} size={20} />
            {t.label}
            {!!badge && <span className={s.mN}>{badge}</span>}
          </Link>
        );
      })}
      <Link href="/gestao/menu" aria-current={active === "menu" ? "page" : undefined}>
        <Icon name="menu" size={20} />
        Menu
      </Link>
    </nav>
  );
}

/**
 * EN: Phone lists (V3-M-G-*): tables become card lists by CSS (admin.module.css); this copies each column title onto its
 *     cells as data-label so a card row reads "Total · 3 000,00 MT". Re-runs when client boards redraw. Tables with
 *     data-keep (e.g. the size matrix) stay as tables.
 * PT: Listas do telemóvel: as tabelas passam a cartões por CSS; aqui cada título de coluna vai para as células (data-label).
 *     Repete quando os quadros de cliente se redesenham. Tabelas com data-keep (ex.: matriz de tamanhos) ficam tabelas.
 */
export function MobileTables() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const label = () => {
      main.querySelectorAll("table").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent?.trim() ?? "");
        t.querySelectorAll("tbody tr").forEach((tr) => {
          [...tr.children].forEach((c, i) => {
            const v = i > 0 ? (heads[i] ?? "") : "";
            if (c.getAttribute("data-label") !== v) c.setAttribute("data-label", v);
          });
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(main, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
