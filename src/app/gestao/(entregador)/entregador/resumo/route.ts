import { NextResponse } from "next/server";
import { toMaputo } from "@/lib/time";
import { commissionOf, driverEarnings } from "@/server/delivery";
import { currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/entregador/resumo
 * EN: "Descarregar resumo" (design V3-E-Ganhos): the signed-in driver's deliveries of the last 60 days, as CSV.
 * PT: As entregas dos últimos 60 dias de quem tem sessão, em CSV.
 */
export async function GET() {
  const me = await currentStaff();
  if (!me || me.status === "temp_password") return new NextResponse("Sem acesso", { status: 403 });
  const e = await driverEarnings(me);
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Data", "Hora", "Encomenda", "Bairro", "Preço da entrega (MT)", "Comissão (MT)", "Dinheiro cobrado (MT)"].map(q).join(";"),
    ...e.rows.map((o) => {
      const t = toMaputo(o.deliveredAt!);
      return [t.date, t.time, o.number, o.deliveryNeighbourhood ?? "", o.shippingFee, commissionOf(o.shippingFee, e.pct), o.paymentMethod === "cod" ? o.total : 0].map(q).join(";");
    }),
  ];
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="eterna-ganhos.csv"`, "Cache-Control": "private, no-store" },
  });
}
