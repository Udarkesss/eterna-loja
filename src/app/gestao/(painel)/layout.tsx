import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import s from "@/components/admin/admin.module.css";
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
        </div>
        <div className={s.bottom}>
          <Link href="/pt" target="_blank">
            <Icon name="eye" size={16} />
            Ver a loja
          </Link>
          <form action={signOutStaff}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <main id="main" className={s.main}>
        {children}
      </main>
    </div>
  );
}
