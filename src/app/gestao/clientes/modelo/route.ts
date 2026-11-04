import { NextResponse } from "next/server";
import { clientsTemplate } from "@/server/admin/customers";
import { can, currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/clientes/modelo
 * EN: "Modelo Excel" for the import of the old store's customers. PT: "Modelo Excel" para importar as clientes da loja antiga.
 */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || !can(staff, "customers")) return new NextResponse("Sem acesso", { status: 403 });
  return new NextResponse(new Uint8Array(clientsTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="eterna-modelo-clientes.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
