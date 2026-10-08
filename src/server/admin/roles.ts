import "server-only";
import { asc } from "drizzle-orm";
import { audit } from "../audit";
import { getDb } from "../db";
import { rolePermissions, roles } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · A2 Papéis e permissões": the access matrix. Only the Superadministrador changes it; the
 *     Superadministrador column is locked. Every change goes to the audit log, cell by cell.
 * PT: A matriz de acesso. Só o Superadministrador altera; a coluna do Superadministrador está bloqueada.
 */

export const AREA_LABELS: Record<string, string> = {
  dashboard: "Painel (resumo)",
  "orders.view": "Encomendas: ver",
  "orders.edit": "Encomendas: editar / marcar pronta",
  "orders.cancel": "Encomendas: cancelar",
  refunds: "Reembolsos",
  "transfers.validate": "Validar comprovativos de transferência",
  customers: "Clientes e encomendas por cliente",
  "customers.export": "Exportar clientes (CSV)",
  "deliveries.assign": "Entregas: atribuir e avisar entregador",
  "deliveries.run": "Entregas: iniciar, GPS, confirmar com código",
  "deliveries.pricing": "Preços de entrega e zonas",
  "commissions.view": "Comissões e relatório de ganhos",
  "commissions.pay": "Marcar comissões como pagas",
  fittings: "Provas: ver, marcar, aceitar pedidos do site",
  "products.view": "Produtos e stock: ver",
  "products.edit": "Produtos: editar, stock, preço de saldo",
  "products.publish": "Produtos: publicar / apagar",
  content: "Conteúdo do site (páginas, hero, vídeo, parallax, ocasiões)",
  "payments.toggle": "Métodos de pagamento: ligar / desligar",
  api_keys: "Chaves de API (M-Pesa, e-Mola, mKesh, banco, WhatsApp, mapas)",
  notifications: "Avisos de novas compras",
  "users.admins": "Utilizadores: Administradores",
  "users.managers": "Utilizadores: Gestores de loja",
  "users.staff": "Utilizadores: Atendedores e Entregadores",
  roles: "Papéis e permissões",
  stores: "Lojas (dados, horários)",
  audit: "Registo de auditoria",
  system: "Definições do sistema",
};

export const ACCESS_OPTIONS: Record<string, string> = {
  T: "Total",
  L: "Só as suas lojas",
  V: "Só ver",
  P: "Só as próprias",
  Pd: "Pedir aprovação",
  E: "Só dados da entrega",
  "—": "Sem acesso",
};

export async function loadMatrix() {
  const db = await getDb();
  const roleRows = await db.select().from(roles).orderBy(asc(roles.level));
  const perms = await db.select().from(rolePermissions);
  const ordered = [...roleRows].reverse(); // EN: super first. PT: super primeiro.
  return {
    roles: ordered.map((r) => ({ key: r.key, name: r.name.pt })),
    rows: Object.keys(AREA_LABELS).map((area) => ({
      area,
      label: AREA_LABELS[area],
      cells: Object.fromEntries(ordered.map((r) => [r.key, perms.find((p) => p.roleId === r.id && p.area === area)?.access ?? "—"])),
    })),
  };
}

/** EN: matrix[area][roleKey] = access. PT: matriz[área][papel] = acesso. */
export async function saveMatrix(staff: StaffContext, matrix: Record<string, Record<string, string>>) {
  if (staff.roleKey !== "super") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const db = await getDb();
  const roleRows = await db.select().from(roles);
  const current = await loadMatrix();
  const changes: string[] = [];
  await db.transaction(async (tx) => {
    for (const [area, byRole] of Object.entries(matrix)) {
      if (!AREA_LABELS[area]) continue;
      for (const [roleKey, access] of Object.entries(byRole)) {
        if (roleKey === "super" || !ACCESS_OPTIONS[access]) continue;
        const role = roleRows.find((r) => r.key === roleKey);
        const before = current.rows.find((r) => r.area === area)?.cells[roleKey];
        if (!role || before === access) continue;
        await tx
          .insert(rolePermissions)
          .values({ roleId: role.id, area, access })
          .onConflictDoUpdate({ target: [rolePermissions.roleId, rolePermissions.area], set: { access } });
        changes.push(`${role.name.pt} · ${AREA_LABELS[area]}: ${before} → ${access}`);
      }
    }
  });
  for (const c of changes) {
    await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Permissões alteradas", detail: c });
  }
}

