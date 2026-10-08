import { DemoControls } from "@/components/admin/DemoControls";
import { SystemEditor } from "@/components/admin/SystemEditor";
import { PageTop } from "@/components/admin/ui";
import { loadSystemSettings } from "@/server/admin/system";
import { demoStatus } from "@/server/demo";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Definições" };

/** EN: "Definições" (Superadministrador). PT: Lojas, horário das provas e dados de exemplo. */
export default async function SystemPage() {
  await requireStaffPage("system");
  const [d, demo] = await Promise.all([loadSystemSettings(), demoStatus()]);
  return (
    <>
      <PageTop eyebrow="Só o Superadministrador" title="Definições" />
      <SystemEditor stores={d.stores} schedule={d.schedule} />
      <DemoControls status={demo} />
    </>
  );
}
