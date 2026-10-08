import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { listCustomersFor } from "@/server/admin/customers";
import { accessOf, currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/clientes/exportar
 * EN: "Exportar CSV" — only Superadministrador and Administrador (matrix: customers.export). Logged in the audit.
 * PT: "Exportar CSV" — só Superadministrador e Administrador. Fica registado na auditoria.
 */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || accessOf(staff, "customers.export") === "—") return new NextResponse("Sem acesso", { status: 403 });
  const list = await listCustomersFor(staff);
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Nome", "Telefone", "E-mail", "Cliente desde", "Encomendas", "Total gasto (MT)", "Com conta"].map(esc).join(";"),
    ...list.map((c) =>
      [c.name, c.phone ? `+258${c.phone}` : "", c.email, c.since.toISOString().slice(0, 10), c.orders.length, c.totalPaid, c.hasAccount ? "Sim" : "Não"]
        .map(esc)
        .join(";"),
    ),
  ];
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Clientes exportados (CSV)", detail: `${list.length} clientes` });
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eterna-clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
