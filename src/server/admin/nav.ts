import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import type { NavItem } from "@/components/admin/AdminNav";
import { addDays, todayMaputo } from "@/lib/time";
import { getDb } from "../db";
import { fittings } from "../db/schema";
import { can, storeScope, type StaffContext } from "../staff/access";
import { listOrdersFor } from "./orders";

/**
 * EN: The side menu per role (design "Gestão · A3 O que cada papel vê") with the counters in gold.
 * PT: O menu lateral por papel, com os contadores a dourado.
 */

const MENU: { href: string; label: string; icon: NavItem["icon"]; area: string }[] = [
  { href: "/gestao", label: "Painel", icon: "grid", area: "dashboard" },
  { href: "/gestao/encomendas", label: "Encomendas", icon: "receipt", area: "orders.view" },
  { href: "/gestao/entregas", label: "Entregas", icon: "truck", area: "deliveries.assign" },
  { href: "/gestao/provas", label: "Provas", icon: "calendar", area: "fittings" },
  { href: "/gestao/produtos", label: "Produtos", icon: "dress", area: "products.view" },
  { href: "/gestao/coleccoes", label: "Colecções", icon: "layers", area: "products.publish" },
  { href: "/gestao/conteudo", label: "Conteúdo do site", icon: "layout", area: "content" },
  { href: "/gestao/clientes", label: "Clientes", icon: "users", area: "customers" },
  { href: "/gestao/pagamentos", label: "Pagamentos e avisos", icon: "card", area: "payments.toggle" },
  { href: "/gestao/utilizadores", label: "Utilizadores internos", icon: "userPlus", area: "users.staff" },
  { href: "/gestao/papeis", label: "Papéis e permissões", icon: "shield", area: "roles" },
  { href: "/gestao/auditoria", label: "Auditoria", icon: "list", area: "audit" },
  { href: "/gestao/definicoes", label: "Definições", icon: "settings", area: "system" },
];

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
  const usersArea = ["users.staff", "users.managers", "users.admins"].some((a) => can(staff, a));
  return MENU.filter((m) => (m.area === "users.staff" ? usersArea : can(staff, m.area))).map((m) => ({ ...m, badge: badges[m.href] }));
}
