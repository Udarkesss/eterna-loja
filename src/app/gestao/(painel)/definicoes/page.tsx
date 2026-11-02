import { SystemEditor } from "@/components/admin/SystemEditor";
import { PageTop } from "@/components/admin/ui";
import { loadSystemSettings } from "@/server/admin/system";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Definições" };

/** EN: "Definições" (Superadministrador). PT: Módulo de entregas, lojas e horário das provas. */
export default async function SystemPage() {
  await requireStaffPage("system");
  const d = await loadSystemSettings();
  return (
    <>
      <PageTop eyebrow="Só o Superadministrador" title="Definições" />
      <SystemEditor stores={d.stores} schedule={d.schedule} delivery={d.delivery} />
    </>
  );
}
