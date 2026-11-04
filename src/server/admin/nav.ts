import "server-only";
import { and, count, eq, inArray, lt } from "drizzle-orm";
import type { NavItem } from "@/components/admin/AdminNav";
import { addDays, todayMaputo } from "@/lib/time";
import { getDb } from "../db";
import { fittings, reservations } from "../db/schema";
import { reservationSettings } from "../reservations";
import { deliveryEnabled } from "../content";
import { can, storeScope, type StaffContext } from "../staff/access";
import { listOrdersFor } from "./orders";

/**
 * EN: The side menu per role of design V3, in its four groups (Loja · Catálogo · Site · Sistema), with the counters in
 *     gold (design "Gestão · O que cada papel vê").
 * PT: O menu lateral por papel do V3, nos seus quatro grupos (Loja · Catálogo · Site · Sistema), com os contadores a
 *     dourado.
 */

export const MENU: { group: NavItem["group"]; href: string; label: string; icon: NavItem["icon"]; area: string }[] = [
  { group: "Loja", href: "/gestao", label: "Painel", icon: "grid", area: "dashboard" },
  { group: "Loja", href: "/gestao/encomendas", label: "Encomendas", icon: "bag", area: "orders.view" },
  { group: "Loja", href: "/gestao/entregas", label: "Entregas", icon: "truck", area: "deliveries.assign" },
  { group: "Loja", href: "/gestao/reservas", label: "Reservas", icon: "hourglass", area: "reservations" },
  { group: "Loja", href: "/gestao/provas", label: "Provas · Bridal", icon: "dress", area: "fittings" },
  { group: "Loja", href: "/gestao/clientes", label: "Clientes", icon: "users", area: "customers" },
  { group: "Loja", href: "/gestao/descontos", label: "Descontos e vouchers", icon: "ticket", area: "discounts" },
  { group: "Catálogo", href: "/gestao/produtos", label: "Produtos", icon: "tag", area: "products.view" },
  { group: "Catálogo", href: "/gestao/tipos", label: "Tipos de peça", icon: "grid", area: "products.publish" },
  { group: "Catálogo", href: "/gestao/coleccoes", label: "Colecções", icon: "layers", area: "products.publish" },
  { group: "Catálogo", href: "/gestao/categorias", label: "Categorias e filtros", icon: "filter", area: "products.publish" },
  { group: "Catálogo", href: "/gestao/produtos/importar", label: "Importar", icon: "upload", area: "products.publish" },
  { group: "Site", href: "/gestao/conteudo", label: "Conteúdo do site", icon: "monitor", area: "content" },
  { group: "Site", href: "/gestao/contactos", label: "Contactos e redes sociais", icon: "phone", area: "content" },
  { group: "Sistema", href: "/gestao/pagamentos", label: "Pagamentos e avisos", icon: "card", area: "payments.toggle" },
  { group: "Sistema", href: "/gestao/definicoes", label: "Definições", icon: "sliders", area: "system" },
  { group: "Sistema", href: "/gestao/utilizadores", label: "Utilizadores internos", icon: "user", area: "users.staff" },
  { group: "Sistema", href: "/gestao/papeis", label: "Papéis e permissões", icon: "shield", area: "roles" },
  { group: "Sistema", href: "/gestao/auditoria", label: "Auditoria", icon: "list", area: "audit" },
];

/**
 * EN: "O que cada papel vê" (design V3): each role's side menu, from the access matrix (the same rule as navFor).
 * PT: "O que cada papel vê" (V3): o menu lateral de cada papel, a partir da matriz de acesso (a mesma regra do navFor).
 */
export function menuForAccess(cells: Record<string, string>, delivery: boolean) {
  const has = (area: string) => (cells[area] ?? "—") !== "—";
  return MENU.filter((m) => (m.href === "/gestao/entregas" ? delivery : true)).filter((m) =>
    m.area === "users.staff" ? ["users.staff", "users.managers", "users.admins"].some(has) : has(m.area),
  );
}

export async function navFor(staff: StaffContext): Promise<NavItem[]> {
  const badges: Record<string, number> = {};
  if (can(staff, "orders.view")) {
    const recent = await listOrdersFor(staff, { from: addDays(todayMaputo(), -60) });
    // EN: Paid and not yet handled, or a transfer proof waiting. PT: Pagas por tratar, ou comprovativo à espera.
    badges["/gestao/encomendas"] = recent.filter(
      ({ order: o }) =>
        (o.paymentStatus === "paid" && o.fulfillmentStatus === "pending") ||
        (o.paymentStatus === "pending" && o.paymentMethod === "transfer" && !!o.transferProofUrl),
    ).length;
    badges["/gestao/entregas"] = recent.filter(
      ({ order: o }) => o.fulfillmentType === "delivery" && o.fulfillmentStatus === "pending" && !o.driverId && (o.paymentStatus === "paid" || o.paymentMethod === "cod"),
    ).length;
  }
  if (can(staff, "fittings")) {
    const db = await getDb();
    const scope = storeScope(staff, "fittings");
    const [requests] = await db
      .select({ n: count() })
      .from(fittings)
      .where(and(eq(fittings.status, "requested"), scope ? inArray(fittings.storeId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : undefined));
    badges["/gestao/provas"] = requests.n;
  }
  if (can(staff, "reservations")) {
    // EN: Reservations ending soon (Definições → avisar antes do fim). PT: Reservas a terminar.
    const db = await getDb();
    const s = await reservationSettings();
    const scope = storeScope(staff, "reservations");
    const [ending] = await db
      .select({ n: count() })
      .from(reservations)
      .where(
        and(
          eq(reservations.status, "active"),
          lt(reservations.expiresAt, new Date(Date.now() + s.remindDays * 86_400_000)),
          scope ? inArray(reservations.storeId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : undefined,
        ),
      );
    badges["/gestao/reservas"] = ending.n;
  }
  const usersArea = ["users.staff", "users.managers", "users.admins"].some((a) => can(staff, a));
  // EN: "Entregas" only with the delivery module on. PT: "Entregas" só com o módulo de entregas ligado.
  const delivery = await deliveryEnabled();
  return MENU.filter((m) => (m.href === "/gestao/entregas" ? delivery : true))
    .filter((m) => (m.area === "users.staff" ? usersArea : can(staff, m.area)))
    .map((m) => ({ ...m, badge: badges[m.href] }));
}
