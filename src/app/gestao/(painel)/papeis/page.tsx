import { RolesMatrix } from "@/components/admin/RolesMatrix";
import { PageTop } from "@/components/admin/ui";
import { ACCESS_OPTIONS, loadMatrix } from "@/server/admin/roles";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Papéis e permissões" };

/** EN: "Gestão · A2 Papéis e permissões". PT: Matriz de acesso (só o Superadministrador altera). */
export default async function RolesPage() {
  const me = await requireStaffPage("roles");
  const m = await loadMatrix();
  return (
    <>
      <PageTop
        eyebrow="Só o Superadministrador pode alterar"
        title={
          <>
            Papéis <em>e permissões</em>
          </>
        }
      />
      <RolesMatrix roles={m.roles} rows={m.rows} options={ACCESS_OPTIONS} editable={me.roleKey === "super"} />
    </>
  );
}
