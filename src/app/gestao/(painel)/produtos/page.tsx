import Link from "next/link";
import c from "@/components/admin/AdminV3.module.css";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import d3 from "@/components/admin/Dashboard.module.css";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { listCategoriesByKind, listProductsAdmin, PRODUCT_VIEWS, type ProductView } from "@/server/admin/products";
import { accessOf, canEdit, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Produtos" };

type Props = { searchParams: Promise<{ vista?: string; q?: string; tipo?: string; colecao?: string }> };

/**
 * EN: "Gestão · Produtos" of design V3-G-Produtos. PT: Produtos do V3.
 */
export default async function ProductsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("products.view");
  const p = await searchParams;
  const view: ProductView = p.vista && p.vista in PRODUCT_VIEWS ? (p.vista as ProductView) : "todos";
  const [{ list, counts }, cats] = await Promise.all([listProductsAdmin(staff, { view, q: p.q, type: p.tipo, collection: p.colecao }), listCategoriesByKind()]);
  const link = (vista: ProductView) =>
    `?${new URLSearchParams(Object.entries({ q: p.q, tipo: p.tipo, colecao: p.colecao, vista: vista === "todos" ? undefined : vista }).filter((e): e is [string, string] => !!e[1]))}`;
  const edit = canEdit(staff, "products.edit");
  const publish = accessOf(staff, "products.publish") === "T";

  return (
    <>
      <PageTop
        eyebrow="Catálogo"
        title="Produtos"
        actions={
          <>
            {publish && (
              <Link href="/gestao/produtos/importar" className={`${c.btn} ${c.sm}`}>
                <Icon name="upload" size={15} />
                Importar
              </Link>
            )}
            {edit && (
              <Link href="/gestao/produtos/novo" className={`${c.btnPrimary} ${c.sm}`}>
                <Icon name="plus" size={15} />
                Novo produto
              </Link>
            )}
          </>
        }
      />
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Produtos</h2>
        </div>
        <div className={d3.panelBody}>
          <nav className={d3.tabs} aria-label="Estado">
            {(Object.keys(PRODUCT_VIEWS) as ProductView[]).map((v) => (
              <Link key={v} href={link(v)} aria-current={v === view ? "page" : undefined}>
                {PRODUCT_VIEWS[v]}
                {(v === "todos" || v === "sem-foto") && counts[v] > 0 && <span className={d3.count}>{counts[v]}</span>}
              </Link>
            ))}
          </nav>
          <form className={d3.filterRow} role="search">
            {p.vista && <input type="hidden" name="vista" value={p.vista} />}
            <label className={d3.search}>
              <Icon name="search" size={16} />
              <input type="search" name="q" defaultValue={p.q} placeholder="Código, nome ou cor" aria-label="Procurar produtos" />
            </label>
            <AutoSubmitSelect className={c.select} name="tipo" defaultValue={p.tipo ?? ""} aria-label="Tipo" style={{ width: 180 }}>
              <option value="">Todos os tipos</option>
              {cats.types.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </AutoSubmitSelect>
            <AutoSubmitSelect className={c.select} name="colecao" defaultValue={p.colecao ?? ""} aria-label="Colecção" style={{ width: 180 }}>
              <option value="">Todas as colecções</option>
              {cats.collections.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
          {list.length === 0 ? (
            <p className={d3.empty}>{p.q ? "Nenhum produto encontrado." : `Nenhum produto em “${PRODUCT_VIEWS[view]}”.`}</p>
          ) : (
            <ProductsTable items={list.slice(0, 200)} collections={cats.collections} canPublish={publish} canEdit={edit} />
          )}
          {list.length > 200 && <span className={c.xsMuted}>A mostrar 200 de {list.length}. Use a pesquisa ou os filtros para encontrar o resto.</span>}
        </div>
      </section>
    </>
  );
}
