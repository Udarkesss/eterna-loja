import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { earningsReport, periodRange, type Period } from "@/server/delivery";
import { can, currentStaff } from "@/server/staff/access";

/** GET /gestao/entregas/exportar?periodo=week — EN: earnings report CSV. PT: Relatório de ganhos em CSV. */
export async function GET(request: Request) {
  const staff = await currentStaff();
  if (!staff || !can(staff, "commissions.view") || staff.roleKey === "entregador") return new NextResponse("Sem acesso", { status: 403 });
  const p = new URL(request.url).searchParams.get("periodo");
  const period: Period = p === "month" || p === "lastMonth" ? p : "week";
  const rows = await earningsReport(period);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [
    ["Entregador", "Entregas", "Valor das entregas (MT)", "Comissão %", "A pagar (MT)", "Estado"].map(esc).join(";"),
    ...rows.map((r) => [r.name, r.count, r.value, r.pct, r.amount, r.paid ? "Pago" : "Pendente"].map(esc).join(";")),
  ].join("\r\n");
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Relatório de ganhos exportado", detail: periodRange(period).label });
  return new NextResponse(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eterna-ganhos-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
