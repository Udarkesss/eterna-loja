import type { Metadata } from "next";
import { InviteFlow } from "@/components/delivery/InviteFlow";
import s from "@/components/delivery/driver.module.css";
import { invitationView } from "@/server/admin/drivers";

export const metadata: Metadata = { title: "Convite · equipa de entregas" };

/**
 * EN: The driver's invitation of design V3-E-Convite and V3-E-Primeiro-Acesso (link sent by WhatsApp, valid 48 hours).
 * PT: O convite do entregador do V3 (link enviado por WhatsApp, válido 48 horas).
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await invitationView(token);
  return (
    <div className={s.page}>
      <header className={s.header}>
        <span />
        <span className={s.brand}>ETERNA</span>
        <span />
      </header>
      {view ? (
        <InviteFlow token={token} view={view} />
      ) : (
        <section className={s.section}>
          <p className={s.empty}>Este convite expirou ou já foi usado. Peça um novo à gestão da Eterna.</p>
        </section>
      )}
    </div>
  );
}
