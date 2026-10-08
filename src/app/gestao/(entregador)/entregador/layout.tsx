import type { ReactNode } from "react";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { signOutStaff } from "@/app/gestao/actions/auth";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "As minhas entregas" };

/**
 * EN: Frame of the driver app: phone-sized, logo in the middle, sign-out on the right (design "Entregador").
 * PT: Moldura da app do entregador: tamanho de telemóvel, logótipo ao centro, sair à direita.
 */
export default async function DriverLayout({ children }: { children: ReactNode }) {
  await requireStaffPage(undefined, { allowDriver: true });
  return (
    <div className={s.page}>
      <header className={s.header}>
        <span />
        <span className={s.brand}>ETERNA</span>
        <form action={signOutStaff}>
          <button type="submit" aria-label="Sair" className={s.headerBtn}>
            <Icon name="logout" size={20} />
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
