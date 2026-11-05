import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { MobileTables, MobileTabs, MobileTop } from "@/components/admin/MobileChrome";
import s from "@/components/admin/admin.module.css";
import { TopSearch } from "@/components/admin/TopSearch";
import { Icon } from "@/components/ui/Icon";
import { navFor } from "@/server/admin/nav";
import { requireStaffPage } from "@/server/staff/access";
import { signOutStaff } from "../actions/auth";

/**
 * EN: Frame of every back-office page: black sidebar with the role's menu, the person and "Ver a loja · Sair".
 *     Signing in is checked here, and each page also checks its own area.
 * PT: Moldura de todas as páginas da gestão: barra lateral com o menu do papel, a pessoa e "Ver a loja · Sair".
 *     A sessão é verificada aqui e cada página verifica também a sua área.
 */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  // EN: Drivers may see the frame (for "Sem acesso"); every page checks its own area. PT: Cada página verifica a sua área.
  const staff = await requireStaffPage(undefined, { allowDriver: true });
  const items = await navFor(staff);
  const initials = staff.name
    .replace(/[[\]]/g, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const stores = staff.storeCodes.length ? ` · ${staff.storeCodes.map((c) => `Loja ${c}`).join(", ")}` : "";

  const notices = items.reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <div className={s.shell}>
      <aside className={s.aside}>
        <Link href="/gestao" className={s.brand}>
          <span className={s.brandName}>ETERNA</span>
          <span className={s.brandSub}>Gestão interna</span>
        </Link>
        <AdminNav items={items} />
        <div className={s.me}>
          <span className={s.avatar}>{initials}</span>
          <span className={s.meText}>
            <span>{staff.name}</span>
            <span className={s.meRole}>
              {staff.roleName}
              {staff.roleKey === "gestor" || staff.roleKey === "atendedor" ? stores : ""}
            </span>
          </span>
          <form action={signOutStaff} className={s.meOut}>
            <button type="submit" aria-label="Terminar sessão" title="Terminar sessão">
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className={s.mainCol}>
        <MobileTop notices={notices} />
        {/* EN: Top bar of design V3: search, notices, initials. PT: Barra de topo do V3: pesquisa, avisos, iniciais. */}
        <div className={s.topbar}>
          <Suspense fallback={<span className={s.topSearch} />}>
            <TopSearch />
          </Suspense>
          <span className={s.grow} />
          <Link href="/gestao" className={s.bell} aria-label={`Avisos, ${notices} por tratar`}>
            <Icon name="bell" size={22} />
            {notices > 0 && <span className={s.bellCount}>{notices}</span>}
          </Link>
          <span className={s.topAvatar} aria-hidden="true">
            {initials}
          </span>
        </div>
        <main id="main" className={s.main}>
          {children}
        </main>
        <MobileTables />
        <MobileTabs items={items} />
      </div>
    </div>
  );
}
