import Link from "next/link";
import d3 from "@/components/admin/Dashboard.module.css";
import c from "@/components/admin/AdminV3.module.css";
import t from "@/components/admin/Types.module.css";
import { BridalAccessories, NewTypeForm, TypesTable } from "@/components/admin/TypesBoard";
import { PageTop } from "@/components/admin/ui";
import { typesOverview } from "@/server/admin/types";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Tipos de peça" };

type Props = { searchParams: Promise<{ grupo?: string }> };

/**
 * EN: "Gestão · Tipos de peça" of design V3-G-Tipos. PT: Tipos de peça do V3.
 */
export default async function TypesPage({ searchParams }: Props) {
  await requireStaffPage("products.publish");
  const p = await searchParams;
  const { groups } = await typesOverview();
  const current = groups.find((g) => g.slug === p.grupo) ?? groups.find((g) => g.slug === "roupa-executiva") ?? groups[0];
  const bridal = groups.flatMap((g) => g.types).filter((x) => x.bridalAccessory);

  return (
    <>
      <PageTop
        eyebrow="Catálogo"
        title={
          <>
            Tipos de <em>peça</em>
          </>
        }
      />
      <div className={t.cols}>
        <nav className={`${d3.panel} ${t.groups}`} aria-label="Grupos">
          {groups.map((g) => (
            <Link key={g.id} href={`?grupo=${g.slug}`} aria-current={g.id === current?.id ? "page" : undefined}>
              <span>{g.name}</span>
              <span className={c.badge}>{g.types.length}</span>
            </Link>
          ))}
        </nav>
        <div className={t.mid}>
          {current && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>{current.name} · ordem na barra de tipos</h2>
                <span className={c.xsMuted}>Arraste para ordenar</span>
              </div>
              <div className={t.body}>
                <TypesTable key={current.id} types={current.types} disabled={false} />
              </div>
            </section>
          )}
          {bridal.length > 0 && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Acessórios de noiva · onde aparecem</h2>
              </div>
              <div className={t.body}>
                <BridalAccessories types={bridal} disabled={false} />
              </div>
            </section>
          )}
        </div>
        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Novo tipo de peça</h2>
          </div>
          <NewTypeForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} defaultGroup={current?.id ?? groups[0]?.id ?? ""} disabled={false} />
        </section>
      </div>
    </>
  );
}
