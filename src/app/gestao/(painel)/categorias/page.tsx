import Link from "next/link";
import { CategorySettingsForm } from "@/components/admin/CategorySettingsForm";
import d3 from "@/components/admin/Dashboard.module.css";
import t from "@/components/admin/Types.module.css";
import c from "@/components/admin/AdminV3.module.css";
import { PageTop } from "@/components/admin/ui";
import { categoryNav, categorySettings } from "@/server/admin/categories";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Categorias e filtros" };

type Props = { searchParams: Promise<{ c?: string }> };

/**
 * EN: "Gestão · Categorias e filtros" of design V3-G-Categorias. PT: Categorias e filtros do V3.
 */
export default async function CategoriesPage({ searchParams }: Props) {
  await requireStaffPage("products.publish");
  const p = await searchParams;
  const nav = await categoryNav();
  const all = nav.flatMap((g) => g.items);
  const current = all.find((x) => x.slug === p.c) ?? all.find((x) => x.slug === "convidada") ?? all[0];
  const settings = current ? await categorySettings(current.slug) : null;

  return (
    <>
      <PageTop
        eyebrow="Catálogo"
        title={
          <>
            Categorias e <em>filtros</em>
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
        <nav className={`${d3.panel} ${t.groups}`} style={{ paddingBottom: 10 }} aria-label="Categorias">
          {nav.map((g) => (
            <div key={g.group}>
              <span className={c.label} style={{ display: "block", padding: "14px 14px 6px", color: "var(--muted)" }}>
                {g.group}
              </span>
              {g.items.map((x) => (
                <Link key={x.slug} href={`?c=${x.slug}`} aria-current={x.slug === current?.slug ? "page" : undefined}>
                  <span>{x.name}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {settings && (
          <CategorySettingsForm
            key={settings.slug}
            slug={settings.slug}
            name={settings.name}
            sort={settings.sort}
            featured={settings.featured}
            filters={settings.filters}
            siteHref={`/pt/category/${settings.slug}`}
          />
        )}
      </div>
    </>
  );
}
