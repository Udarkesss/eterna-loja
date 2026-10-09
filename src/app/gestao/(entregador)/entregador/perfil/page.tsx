import Link from "next/link";
import { eq } from "drizzle-orm";
import { DriverProfile } from "@/components/delivery/DriverProfile";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { getDb } from "@/server/db";
import { staffUsers } from "@/server/db/schema";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "O meu perfil" };

/**
 * EN: Driver profile: the WhatsApp number where new deliveries arrive, e-mail, vehicle and password.
 * PT: Perfil do entregador: o WhatsApp onde chegam as entregas novas, e-mail, veículo e palavra-passe.
 */
export default async function DriverProfilePage() {
  const me = await requireStaffPage(undefined, { allowDriver: true });
  const db = await getDb();
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, me.id));

  return (
    <main className={s.body}>
      <Link href="/gestao/entregador" className={s.line} style={{ color: "var(--ink)", marginTop: -8 }}>
        <Icon name="arrowLeft" size={18} />
        As minhas entregas
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className={s.eyebrow}>{me.roleName}</span>
        <h1 className={s.h1}>O meu perfil</h1>
        <span className={s.muted}>
          {row.name.replace(/^\[[^\]]*\]\s*/, "")} · utilizador {row.username}
        </span>
      </div>
      <DriverProfile
        initial={{
          phone: row.phone ? formatMsisdn(row.phone) : "",
          email: row.email ?? "",
          vehicleType: row.vehicleType ?? "",
          vehiclePlate: row.vehiclePlate ?? "",
        }}
        isDriver={me.roleKey === "entregador"}
      />
    </main>
  );
}
