import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { orderEvents, orders } from "@/server/db/schema";
import { and, eq, like } from "drizzle-orm";
import { can, currentStaff } from "@/server/staff/access";
import { readPrivateUpload } from "@/server/uploads";

/**
 * GET /gestao/ficheiro?encomenda=<id>
 * EN: Shows the transfer proof of an order, only to staff who can validate transfers.
 * PT: Mostra o comprovativo de uma encomenda, só a quem pode validar transferências.
 */
export async function GET(request: Request) {
  const staff = await currentStaff();
  const url = new URL(request.url);
  const id = url.searchParams.get("encomenda") ?? "";
  const photo = url.searchParams.get("foto");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (photo && !/^[0-9a-f-]{36}$/i.test(photo))) return new NextResponse("Não encontrado", { status: 404 });
  const db = await getDb();
  let ref: string | null = null;
  if (photo) {
    // EN: Door photo of a failed delivery (driver app), only if it belongs to this order. PT: Foto da porta desta encomenda.
    if (!staff || !can(staff, "orders.view")) return new NextResponse("Sem acesso", { status: 403 });
    const [ev] = await db
      .select({ id: orderEvents.id })
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, id), eq(orderEvents.type, "delivery_failed"), like(orderEvents.detail, `%file:${photo}%`)));
    ref = ev ? `file:${photo}` : null;
  } else {
    if (!staff || !can(staff, "transfers.validate")) return new NextResponse("Sem acesso", { status: 403 });
    const [order] = await db.select({ ref: orders.transferProofUrl }).from(orders).where(eq(orders.id, id));
    ref = order?.ref ?? null;
  }
  const file = ref ? await readPrivateUpload(ref) : null;
  if (!file) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
