import Link from "next/link";
import c from "@/components/admin/AdminV3.module.css";
import { SystemEditor } from "@/components/admin/SystemEditor";
import { PageTop } from "@/components/admin/ui";
import { loadSystemSettings } from "@/server/admin/system";
import { canEdit, requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Definições" };

/** EN: "Gestão · Definições" of design V3-G-Definicoes. PT: Definições do V3 (só o Superadministrador altera). */
export default async function SystemPage() {
  const staff = await requireStaffPage("system");
  const settings = await loadSystemSettings();
  return (
    <>
      <PageTop
        eyebrow="Só o Superadministrador altera"
        title="Definições"
        actions={
          staff.roleKey === "super" && (
            <Link href="/gestao/definicoes/trazer" className={`${c.btn} ${c.sm}`}>
              Trazer os dados do computador
            </Link>
          )
        }
      />
      <SystemEditor settings={settings} editable={canEdit(staff, "system")} />
    </>
  );
}
