import { asc } from "drizzle-orm";
import { StaffManager } from "@/components/admin/StaffManager";
import { DemoTag, PageTop, when } from "@/components/admin/ui";
import { maskMsisdn } from "@/lib/payments/msisdn";
import { CAN_CREATE, canManage, listStaffFor } from "@/server/admin/staff";
import { getDb } from "@/server/db";
import { stores } from "@/server/db/schema";
import { can, requireStaffPage } from "@/server/staff/access";
import { redirect } from "next/navigation";

export const metadata = { title: "Utilizadores internos" };

/** EN: "Gestão · A1 Utilizadores internos". PT: Equipa com acesso à gestão (só por convite). */
export default async function StaffPage() {
  const me = await requireStaffPage();
  if (!["users.staff", "users.managers", "users.admins"].some((a) => can(me, a))) redirect("/gestao/sem-acesso");
  const db = await getDb();
  const [list, storeRows] = await Promise.all([listStaffFor(me), db.select().from(stores).orderBy(asc(stores.position))]);

  return (
    <>
      <PageTop
        eyebrow="Equipa com acesso à gestão · só por convite"
        title={
          <>
            Utilizadores <em>internos</em>
          </>
        }
        actions={<span className="muted">A ver como <strong style={{ fontWeight: 500 }}>{me.roleName}</strong></span>}
      />
      <DemoTag show={list.some((u) => u.isDemo)} />
      <StaffManager
        me={{ id: me.id, roleKey: me.roleKey, storeCodes: me.storeCodes }}
        users={list.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          phone: u.phone ? `+258 ${maskMsisdn(u.phone)}` : "—",
          email: u.email ?? "",
          roleKey: u.roleKey,
          roleName: u.roleName,
          storeCodes: u.storeCodes,
          status: u.status,
          last: u.lastLoginAt ? when(u.lastLoginAt) : "Nunca entrou",
          locked: !!u.lockedUntil && u.lockedUntil > new Date(),
          can: canManage(me, u),
        }))}
        allowedRoles={CAN_CREATE[me.roleKey] ?? []}
        stores={storeRows.map((st) => ({ code: st.code, name: st.name }))}
      />
    </>
  );
}
