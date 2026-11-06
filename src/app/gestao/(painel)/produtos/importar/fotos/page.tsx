import { PhotoFolderImport } from "@/components/admin/PhotoFolderImport";
import { PageTop } from "@/components/admin/ui";
import { can, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Importar fotos" };

/**
 * EN: Replace product photos from Eterna's photo folder (src/server/import/photos.ts). PT: Fotos a partir da pasta da Eterna.
 */
export default async function PhotoImportPage() {
  const staff = await requireStaffPage("products.edit");
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/produtos/importar", label: "Importar" }, { label: "Fotos de uma pasta" }]}
        eyebrow="Catálogo · fotografias"
        title={
          <>
            Importar <em>fotos</em>
          </>
        }
      />
      <PhotoFolderImport canPublish={can(staff, "products.publish")} />
    </>
  );
}
