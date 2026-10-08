import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Icon } from "@/components/ui/Icon";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Sem acesso" };

/**
 * EN: "Gestão · A5 Sem acesso": shown whenever someone opens an address their role cannot use.
 *     Drivers land here until their own area (phase 5) exists.
 * PT: Aparece sempre que alguém abre um endereço que o seu papel não pode usar.
 *     Os entregadores vêm para aqui até existir a sua área (fase 5).
 */
export default async function NoAccessPage() {
  const staff = await requireStaffPage(undefined, { allowDriver: true });
  const who = staff ? `${staff.roleName}${staff.storeCodes.length ? ` da ${staff.storeCodes.map((c) => `Loja ${c}`).join(" e ")}` : ""}` : "";
  const driver = staff?.roleKey === "entregador";
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <span className={s.chip} data-tone="warn">
        <Icon name="lock" size={14} /> Sem acesso
      </span>
      <h1 className={s.h1}>
        Esta área não está disponível <em>para o seu papel</em>
      </h1>
      <p className={s.muted} style={{ fontSize: 15, lineHeight: "24px" }}>
        {driver
          ? "A área do entregador (As minhas entregas, GPS e código de entrega) chega na fase 5. Até lá, a gestora da loja partilha as entregas consigo."
          : `Está a entrar como ${who}. Se precisa deste acesso para o seu trabalho, peça à gestora da sua loja.`}
      </p>
      {!driver && (
        <Link href="/gestao" className={s.btn}>
          Voltar ao painel
        </Link>
      )}
    </div>
  );
}
