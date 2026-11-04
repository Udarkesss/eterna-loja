import Link from "next/link";
import d3 from "@/components/admin/Dashboard.module.css";
import c from "@/components/admin/AdminV3.module.css";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { menuForAccess } from "@/server/admin/nav";
import { loadMatrix } from "@/server/admin/roles";
import { deliveryEnabled } from "@/server/content";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "O que cada papel vê" };

const ROLE_NOTE: Record<string, string> = {
  super: "Tudo, incluindo chaves e definições",
  admin: "Loja inteira, sem chaves nem papéis",
  gestor: "Só a(s) sua(s) loja(s)",
  atendedor: "Atendimento do dia a dia",
};

/**
 * EN: "Gestão · O que cada papel vê" (design V3-Admin-Menu-Papeis): the side menu of each role, read from the access
 *     matrix, so it always matches what each person really sees. The driver has no gestão menu.
 * PT: "O que cada papel vê" (V3): o menu lateral de cada papel, lido da matriz de acesso, para corresponder sempre ao que
 *     cada pessoa vê. O entregador não tem menu de gestão.
 */
export default async function RoleMenusPage() {
  await requireStaffPage("roles");
  const [m, delivery] = await Promise.all([loadMatrix(), deliveryEnabled()]);
  const cellsOf = (key: string) => Object.fromEntries(m.rows.map((r) => [r.area, r.cells[key]]));
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/papeis", label: "Papéis e permissões" }, { label: "O que cada papel vê" }]}
        eyebrow="Menu lateral por papel"
        title={
          <>
            O que cada <em>papel vê</em>
          </>
        }
      />
      <div className={d3.kpis} style={{ gridTemplateColumns: `repeat(${m.roles.length}, minmax(0, 1fr))` }}>
        {m.roles.map((r) => {
          const items = r.key === "entregador" ? [] : menuForAccess(cellsOf(r.key), delivery);
          return (
            <section key={r.key} className={d3.panel}>
              <div className={d3.panelHead} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <h2>{r.name}</h2>
                <span className={c.xsMuted}>{r.key === "entregador" ? "Sem menu de gestão" : (ROLE_NOTE[r.key] ?? `${items.length} entradas`)}</span>
              </div>
              <div className={d3.panelBody} style={{ gap: 10 }}>
                {r.key === "entregador" ? (
                  <>
                    <span className={c.small}>
                      Depois do login único vai directo para <b>As minhas entregas</b> (área do entregador, no telemóvel).
                    </span>
                    <span className={c.small}>Vê só as entregas atribuídas a si: morada, contacto da cliente, valor a cobrar, rota e GPS.</span>
                    <span className={c.small}>Confirma a entrega com o código da cliente e vê os seus ganhos.</span>
                    <Link href="/gestao/entregador" className={d3.ulink} style={{ alignSelf: "flex-start" }}>
                      Ver área do entregador →
                    </Link>
                  </>
                ) : (
                  items.map((item) => (
                    <span key={item.href} className={c.row} style={{ fontSize: 14 }}>
                      <Icon name={item.icon} size={16} />
                      {item.label}
                    </span>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      <div className={c.note}>
        <Icon name="shield" size={18} />
        <span>Cada item escondido também está protegido no servidor: abrir o endereço directamente mostra a página &quot;Sem acesso&quot;.</span>
      </div>
    </>
  );
}
