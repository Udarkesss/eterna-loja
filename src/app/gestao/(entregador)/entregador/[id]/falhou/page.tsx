import Link from "next/link";
import { notFound } from "next/navigation";
import { FailDeliveryForm } from "@/components/delivery/FailDeliveryForm";
import s from "@/components/delivery/driver.module.css";
import { Icon } from "@/components/ui/Icon";
import { driverDelivery, FAIL_REASONS } from "@/server/delivery";
import { AppError } from "@/server/errors";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Não entregue" };

/** EN: "Entrega não concluída" of design V3-E-Falhou. PT: Não foi possível entregar (V3). */
export default async function FailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaffPage(undefined, { allowDriver: true });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await driverDelivery(me, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  return (
    <main className={s.body}>
      <Link href={`/gestao/entregador/${id}`} className={s.line} style={{ color: "var(--ink)", marginTop: -8 }}>
        <Icon name="arrowLeft" size={18} />
        <span className={s.number} style={{ fontSize: 18 }}>
          {d.order.number}
        </span>
      </Link>
      <span className={s.eyebrow}>Entrega não concluída</span>
      <h1 className={s.title}>
        Não foi possível <em>entregar</em>
      </h1>
      <FailDeliveryForm orderId={id} reasons={[...FAIL_REASONS]} />
    </main>
  );
}
