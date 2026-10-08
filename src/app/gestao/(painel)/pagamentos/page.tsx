import { PaymentsEditor } from "@/components/admin/PaymentsEditor";
import { PageTop } from "@/components/admin/ui";
import { loadPaymentsPage } from "@/server/admin/settings";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Pagamentos e avisos" };

/** EN: "Gestão · 10 Pagamentos e avisos". PT: Métodos de pagamento e avisos de novas compras. */
export default async function PaymentsPage() {
  await requireStaffPage("payments.toggle");
  const d = await loadPaymentsPage();
  return (
    <>
      <PageTop
        eyebrow="Definições da loja"
        title={
          <>
            Pagamentos <em>e avisos</em>
          </>
        }
      />
      <PaymentsEditor
        methods={d.methods.map((m) => ({ method: m.method, enabled: m.enabled, environment: m.environment, note: m.note ?? "" }))}
        recipients={d.recipients.map((r) => ({ staffUserId: r.staffUserId, panel: r.panel, email: r.email, whatsapp: r.whatsapp, storeId: r.storeId }))}
        staff={d.staff}
        stores={d.stores}
        events={d.events}
        mpesaLive={process.env.PAYMENTS_MODE === "live" || (process.env.PAYMENTS_LIVE_METHODS ?? "").includes("mpesa")}
      />
    </>
  );
}
