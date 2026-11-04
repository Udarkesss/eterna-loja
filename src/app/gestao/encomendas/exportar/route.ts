import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { FULFILLMENT_LABEL, listOrdersFor, METHOD_LABEL, PAYMENT_LABEL } from "@/server/admin/orders";
import { can, currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/encomendas/exportar
 * EN: "Exportar CSV" of the order list (design V3): the orders this person may see. Logged in the audit.
 * PT: "Exportar CSV" da lista de encomendas (V3): as encomendas que esta pessoa pode ver. Fica na auditoria.
 */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || !can(staff, "orders.view")) return new NextResponse("Sem acesso", { status: 403 });
  const rows = await listOrdersFor(staff);
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Encomenda", "Data", "Cliente", "Telefone", "Peças", "Total (MT)", "Pagamento", "Método", "Entrega", "Estado"].map(esc).join(";"),
    ...rows.map(({ order: o, lines: l }) =>
      [
        o.number,
        o.createdAt.toISOString().slice(0, 16).replace("T", " "),
        o.contact.name,
        o.contact.phone ? `+258${o.contact.phone}` : "",
        l.map((x) => x.code).join(", "),
        o.total,
        PAYMENT_LABEL[o.paymentStatus].label,
        METHOD_LABEL[o.paymentMethod],
        o.fulfillmentType === "pickup" ? "Levantamento" : "Entrega",
        FULFILLMENT_LABEL[o.fulfillmentStatus],
      ]
        .map(esc)
        .join(";"),
    ),
  ];
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Encomendas exportadas (CSV)", detail: `${rows.length} encomendas` });
  return new NextResponse(`\ufeff${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eterna-encomendas-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
