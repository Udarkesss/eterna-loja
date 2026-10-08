import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { PageTop } from "@/components/admin/ui";
import { listCategoriesByKind, listProductsAdmin } from "@/server/admin/products";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Colecções" };

/** EN: Collections with their product counts; each opens the filtered product list. PT: Colecções e nº de peças. */
export default async function CollectionsPage() {
  const staff = await requireStaffPage("products.publish");
  const [cats, { list }] = await Promise.all([listCategoriesByKind(), listProductsAdmin(staff, {})]);
  return (
    <>
      <PageTop eyebrow="Catálogo" title="Colecções" />
      <div className={s.stats}>
        {cats.collections.map((c) => {
          const items = list.filter((p) => p.collectionId === c.id);
          return (
            <Link key={c.id} href={`/gestao/produtos?colecao=${c.id}`} className={s.stat}>
              <span className={s.statLabel}>{c.name}</span>
              <span className={s.statValue}>{items.length}</span>
              <span className={s.statSub}>
                {items.filter((p) => p.status === "Publicado").length} publicadas · {items.filter((p) => p.status === "Esgotado").length} esgotadas
              </span>
            </Link>
          );
        })}
      </div>
      <p className={s.muted}>Para mudar peças de colecção, seleccione-as em Produtos e use “Mover para colecção”.</p>
    </>
  );
}
