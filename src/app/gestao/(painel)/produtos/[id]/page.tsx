import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductEditor, type EditorProduct } from "@/components/admin/ProductEditor";
import { PageTop } from "@/components/admin/ui";
import { toMaputo } from "@/lib/time";
import { getProductForEdit, listCategoriesByKind } from "@/server/admin/products";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { accessOf, canEdit, requireStaffPage, storeScope } from "@/server/staff/access";

export const metadata = { title: "Editar produto" };

/** EN: "Gestão · 7 Editar produto" (also "Novo produto" at /gestao/produtos/novo). PT: Editar ou criar produto. */
export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  // EN: Creating needs "products.edit"; viewing needs "products.view". PT: Criar precisa de editar; ver basta ver.
  const staff = await requireStaffPage(isNew ? "products.edit" : "products.view");
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [cats, storeRows] = await Promise.all([listCategoriesByKind(), db.select().from(stores).orderBy(asc(stores.position))]);
  const scope = storeScope(staff, "products.edit");

  let product: EditorProduct;
  if (isNew) {
    product = {
      code: "",
      name: { pt: "", en: "" },
      description: { pt: "", en: "" },
      composition: { pt: "", en: "" },
      price: 0,
      salePrice: null,
      status: "draft",
      publishAt: null,
      isNew: true,
      seoTitle: "",
      typeId: null,
      collectionIds: cats.collections[0] ? [cats.collections[0].id] : [],
      occasionIds: [],
      fitting: false,
      colors: [],
      variants: [],
      images: [],
    };
  } else {
    const d = await getProductForEdit(id).catch(() => notFound());
    const p = d.product;
    product = {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      composition: p.composition ?? { pt: "", en: "" },
      price: p.price,
      salePrice: p.salePrice,
      status: p.status,
      publishAt: p.publishAt ? `${toMaputo(p.publishAt).date}T${toMaputo(p.publishAt).time}` : null,
      isNew: p.isNew,
      seoTitle: p.seoTitle ?? "",
      typeId: p.typeId,
      collectionIds: [...new Set([p.collectionId, ...d.categoryIds.filter((c) => cats.collections.some((o) => o.id === c))].filter((x): x is string => !!x))],
      occasionIds: d.categoryIds.filter((c) => cats.occasions.some((o) => o.id === c)),
      fitting: p.fitting,
      colors: p.colors.map((c) => ({ key: c.key, name: c.name, hex: c.hex, family: c.family })),
      variants: d.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, storeCode: storeRows.find((st) => st.id === v.storeId)?.code ?? storeRows[0].code, stock: v.stock })),
      images: d.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? { pt: p.code, en: p.code }, color: i.color })),
    };
  }

  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/produtos", label: "Produtos" }, { label: isNew ? "Novo produto" : product.code }]}
        title={
          <>
            {isNew ? "Novo" : "Editar"} <em>produto</em>
          </>
        }
      />
      <ProductEditor
        product={product}
        types={cats.types}
        collections={cats.collections}
        occasions={cats.occasions}
        stores={storeRows.map((st) => ({ code: st.code, name: st.name, editable: !scope || scope.includes(st.id) }))}
        canPublish={accessOf(staff, "products.publish") === "T"}
        canEdit={canEdit(staff, "products.edit")}
      />
    </>
  );
}
