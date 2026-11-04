import { asc } from "drizzle-orm";
import { ShopifyImport } from "@/components/admin/ShopifyImport";
import { PageTop } from "@/components/admin/ui";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { can, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Importar do Shopify" };

/** EN: Import the catalogue from a Shopify export. PT: Importar o catálogo a partir de uma exportação do Shopify. */
export default async function ImportPage() {
  const staff = await requireStaffPage("products.publish");
  const db = await getDb();
  const storeRows = await db.select({ code: stores.code, name: stores.name }).from(stores).orderBy(asc(stores.position));
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/produtos/importar", label: "Importar" }, { label: "Importar do Shopify" }]}
        eyebrow="Catálogo · ficheiro CSV"
        title={
          <>
            Importar do <em>Shopify</em>
          </>
        }
      />
      <ShopifyImport stores={storeRows} canPublish={can(staff, "products.publish")} />
    </>
  );
}
