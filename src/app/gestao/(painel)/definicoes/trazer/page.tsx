import { redirect } from "next/navigation";
import d3 from "@/components/admin/Dashboard.module.css";
import { TransferImport } from "@/components/admin/TransferImport";
import { PageTop } from "@/components/admin/ui";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Trazer os dados do computador" };

/**
 * EN: Brings the catalogue, photos, site content, settings and imported customers made on the team's computer
 *     (file from `npm run transfer:export`). Super administrator only.
 * PT: Traz o catálogo, as fotos, o conteúdo do site, as definições e as clientes importadas feitos no computador da
 *     equipa (ficheiro de `npm run transfer:export`). Só o superadministrador.
 */
export default async function TransferPage() {
  const staff = await requireStaffPage("system");
  if (staff.roleKey !== "super") redirect("/gestao/sem-acesso");
  return (
    <>
      <PageTop eyebrow="Definições · só o Superadministrador" title="Trazer os dados do computador" />
      <section className={d3.panel}>
        <div className={d3.panelBody}>
          <TransferImport />
        </div>
      </section>
    </>
  );
}
