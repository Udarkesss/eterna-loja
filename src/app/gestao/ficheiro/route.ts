import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { orders } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { can, currentStaff } from "@/server/staff/access";
import { readPrivateUpload } from "@/server/uploads";

/**
 * GET /gestao/ficheiro?encomenda=<id>
 * EN: Shows the transfer proof of an order, only to staff who can validate transfers.
 * PT: Mostra o comprovativo de uma encomenda, só a quem pode validar transferências.
 */
export async function GET(request: Request) {
  const staff = await currentStaff();
  if (!staff || !can(staff, "transfers.validate")) return new NextResponse("Sem acesso", { status: 403 });
  const id = new URL(request.url).searchParams.get("encomenda") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const db = await getDb();
  const [order] = await db.select({ ref: orders.transferProofUrl }).from(orders).where(eq(orders.id, id));
  const file = order?.ref ? await readPrivateUpload(order.ref) : null;
  if (!file) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
