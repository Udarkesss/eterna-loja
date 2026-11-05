import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Icon } from "@/components/ui/Icon";
import { navFor } from "@/server/admin/nav";
import { requireStaffPage } from "@/server/staff/access";
import { signOutStaff } from "../../actions/auth";

export const metadata = { title: "Menu" };

const GROUPS = ["Loja", "Catálogo", "Site", "Sistema"] as const;
const SUB: Record<string, string> = {
  super: "Tudo, incluindo chaves e definições",
  admin: "Loja inteira, sem chaves nem papéis",
  gestor: "Só a(s) sua(s) loja(s)",
  atendedor: "Atendimento do dia a dia",
};

/**
 * EN: "Gestão · Menu (telemóvel)" of design V3-M-G-Menu: the whole menu of the role, the person, "Ver a loja" and
 *     "Terminar sessão". Hidden items are also protected on the server.
 * PT: Menu do telemóvel do V3: o menu inteiro do papel, a pessoa, "Ver a loja" e "Terminar sessão".
 */
export default async function MenuPage() {
  const staff = await requireStaffPage();
  const items = await navFor(staff);
  const initials = staff.name
    .replace(/[[\]]/g, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sub = staff.roleKey === "gestor" || staff.roleKey === "atendedor" ? staff.storeCodes.map((c) => `Loja ${c}`).join(", ") : SUB[staff.roleKey];

  return (
    <div className={s.mMenu}>
      <header className={s.mMenuTop}>
        <Link href="/gestao" className={s.mIco} aria-label="Fechar menu">
          <Icon name="close" size={22} />
        </Link>
        <span className={s.mWord}>
          <b>ETERNA</b>
          <span>Gestão interna</span>
        </span>
        <span />
      </header>
      <div className={s.mMenuMe}>
        <span className={s.avatar} style={{ background: "var(--accent)" }}>
          {initials}
        </span>
        <span style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span>{staff.name}</span>
          <span style={{ fontSize: 12, color: "var(--accent)" }}>
            {staff.roleName}
            {sub ? ` · ${sub}` : ""}
          </span>
        </span>
        <Link href="/" aria-label="Ver a loja">
          <Icon name="eye" size={18} />
        </Link>
      </div>
      <nav aria-label="Menu da gestão" className={s.mMenuNav}>
        {GROUPS.map((g) => {
          const list = items.filter((i) => i.group === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <div className={s.mMenuGroup}>{g}</div>
              {list.map((i) => (
                <Link key={i.href} href={i.href} className={s.mMenuItem}>
                  <Icon name={i.icon} size={19} />
                  <span style={{ flex: 1 }}>{i.label}</span>
                  {!!i.badge && <span className={s.badge}>{i.badge}</span>}
                  <Icon name="chevronRight" size={14} />
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className={s.mMenuFoot}>
        <span style={{ fontSize: 12, lineHeight: "18px", color: "var(--accent)" }}>Cada item escondido também está protegido no servidor: abrir o endereço directamente mostra «Sem acesso».</span>
        <form action={signOutStaff}>
          <button type="submit" className={s.mMenuOut}>
            <Icon name="logout" size={16} />
            Terminar sessão
          </button>
        </form>
      </div>
    </div>
  );
}
