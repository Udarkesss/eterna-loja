import { NextResponse, type NextRequest } from "next/server";
import { storeWhatsappNumber } from "@/server/contacts";

/**
 * EN: Every "WhatsApp" button of the store goes through here, so the number follows Gestão → Contactos ("Botões").
 * PT: Todos os botões "WhatsApp" da loja passam por aqui, para o número seguir a gestão (lugar "Botões").
 */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.slice(0, 1500);
  const number = await storeWhatsappNumber();
  return NextResponse.redirect(text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`, 302);
}
