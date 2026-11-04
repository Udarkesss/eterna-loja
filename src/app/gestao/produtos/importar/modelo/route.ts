import { NextResponse } from "next/server";
import { importTemplate } from "@/server/import/excel";
import { can, currentStaff } from "@/server/staff/access";

/**
 * GET /gestao/produtos/importar/modelo
 * EN: "Descarregar modelo (.xlsx)" with pick lists (types, colours, sizes, stores). PT: Modelo com listas de escolha.
 */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || !can(staff, "products.publish")) return new NextResponse("Sem acesso", { status: 403 });
  return new NextResponse(new Uint8Array(await importTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="eterna-modelo-produtos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
