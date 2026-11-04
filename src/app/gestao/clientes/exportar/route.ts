import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { clientsCsv, listClients, reviewForecast } from "@/server/admin/customers";
import { accessOf, currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/clientes/exportar[?revisao=1]
 * EN: "Exportar CSV" of Gestão · Clientes (matrix: customers.export); with `revisao=1`, only the customers whose level
 *     changes on 1 January ("Ver relatório"). Logged in the audit.
 * PT: "Exportar CSV" de Clientes; com `revisao=1`, só as clientes que mudam de nível a 1 de janeiro. Fica na auditoria.
 */
export async function GET(request: Request) {
  const staff = await currentStaff();
  if (!staff || accessOf(staff, "customers.export") === "—") return new NextResponse("Sem acesso", { status: 403 });
  const review = new URL(request.url).searchParams.get("revisao") === "1";
  let list = await listClients();
  if (review) {
    const f = reviewForecast(list);
    list = [...f.up, ...f.down];
  }
  await audit({
    actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName },
    action: review ? "Relatório da revisão anual exportado" : "Clientes exportadas (CSV)",
    detail: `${list.length} clientes`,
  });
  return new NextResponse(`﻿${clientsCsv(list)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eterna-clientes${review ? "-revisao" : ""}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
