import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { listAudit } from "@/server/admin/audit";
import { can, currentStaff } from "@/server/staff/access";

/** GET /gestao/auditoria/exportar — EN: audit log as CSV. PT: Registo de auditoria em CSV. */
export async function GET(request: Request) {
  const staff = await currentStaff();
  if (!staff || !can(staff, "audit")) return new NextResponse("Sem acesso", { status: 403 });
  const p = new URL(request.url).searchParams;
  const rows = await listAudit({ q: p.get("q") ?? undefined, group: p.get("accao") ?? undefined, from: p.get("de") ?? undefined, to: p.get("ate") ?? undefined, limit: 5000 });
  const esc = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = [
    ["Quando", "Pessoa", "Papel", "Acção", "Detalhe", "Origem", "Resultado"].map(esc).join(";"),
    ...rows.map((r) => [r.at.toISOString(), r.actorName, r.actorRole, r.action, r.detail, r.origin, r.result].map(esc).join(";")),
  ].join("\r\n");
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Auditoria exportada", detail: `${rows.length} registos` });
  return new NextResponse(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eterna-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
