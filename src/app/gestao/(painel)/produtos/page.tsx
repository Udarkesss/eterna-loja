import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { listCategoriesByKind, listProductsAdmin } from "@/server/admin/products";
import { accessOf, canEdit, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Produtos" };

type Props = { searchParams: Promise<{ tab?: string; q?: string; colecao?: string; ocasiao?: string }> };
const TABS = ["Todos", "Publicados", "Rascunhos", "Esgotados"] as const;

/** EN: "Gestão · 6 Produtos". PT: Lista de produtos com separadores, pesquisa, filtros e acções em massa. */
export default async function ProductsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("products.view");
  const p = await searchParams;
  const tab = TABS.includes(p.tab as (typeof TABS)[number]) ? p.tab! : "Todos";
  const [{ list, counts }, cats] = await Promise.all([
    listProductsAdmin(staff, { tab, q: p.q, collection: p.colecao, occasion: p.ocasiao }),
    listCategoriesByKind(),
  ]);
  const link = (t: string) => `?${new URLSearchParams({ tab: t, ...(p.q ? { q: p.q } : {}), ...(p.colecao ? { colecao: p.colecao } : {}), ...(p.ocasiao ? { ocasiao: p.ocasiao } : {}) })}`;

  return (
    <>
      <PageTop
        eyebrow={`Catálogo · ${counts.Todos} ${counts.Todos === 1 ? "peça" : "peças"}`}
        title="Produtos"
        actions={
          canEdit(staff, "products.edit") && (
            <Link href="/gestao/produtos/novo" className={s.btn}>
              <Icon name="plus" size={16} />
              Novo produto
            </Link>
          )
        }
      />
      <div role="tablist" aria-label="Estado" className={s.tabs}>
        {TABS.map((t) => (
          <Link key={t} href={link(t)} role="tab" aria-selected={tab === t}>
            {t} ({counts[t]})
          </Link>
        ))}
      </div>
      <form className={s.filters}>
        <input type="hidden" name="tab" value={tab} />
        <label className={s.label} style={{ flex: "1 1 260px" }}>
          Procurar produtos
          <input className={s.input} type="search" name="q" defaultValue={p.q} placeholder="Procurar por código ou nome" />
        </label>
        <label className={s.label}>
          Colecção
          <select className={s.select} name="colecao" defaultValue={p.colecao ?? ""}>
            <option value="">Todas as colecções</option>
            {cats.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={s.label}>
          Ocasião
          <select className={s.select} name="ocasiao" defaultValue={p.ocasiao ?? ""}>
            <option value="">Todas as ocasiões</option>
            {cats.occasions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={s.btn}>
          Filtrar
        </button>
      </form>
      <ProductsTable
        items={list}
        collections={cats.collections}
        canPublish={accessOf(staff, "products.publish") === "T"}
        canEdit={canEdit(staff, "products.edit")}
      />
    </>
  );
}
