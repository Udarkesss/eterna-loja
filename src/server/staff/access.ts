import "server-only";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { currentSubjectId } from "../auth/sessions";
import { getDb } from "../db";
import { rolePermissions, roles, staffUsers, staffUserStores, stores } from "../db/schema";
import { AppError } from "../errors";

/**
 * EN: Who is using the back-office and what they may do (Gestão · A2 "Papéis e permissões").
 *     Access letters: T total · L own stores · V view only · P own only · Pd ask approval · E delivery data · — none.
 *     Every page and every action checks here, on the server: hiding a menu item is never enough.
 * PT: Quem está na gestão e o que pode fazer. Cada página e cada acção verifica aqui, no servidor:
 *     esconder um item do menu nunca chega.
 */

export type Access = "T" | "L" | "V" | "P" | "Pd" | "E" | "—";

export interface StaffContext {
  id: string;
  name: string;
  username: string;
  status: "active" | "suspended" | "temp_password";
  roleKey: "super" | "admin" | "gestor" | "atendedor" | "entregador";
  roleName: string;
  level: number;
  storeIds: string[];
  storeCodes: string[];
  perms: Record<string, Access>;
}

export async function loadStaff(id: string): Promise<StaffContext | null> {
  const db = await getDb();
  const [row] = await db
    .select({ user: staffUsers, role: roles })
    .from(staffUsers)
    .innerJoin(roles, eq(staffUsers.roleId, roles.id))
    .where(eq(staffUsers.id, id));
  if (!row || row.user.status === "suspended") return null;
  const perms = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, row.role.id));
  const links = await db.select().from(staffUserStores).where(eq(staffUserStores.staffUserId, id));
  const storeRows = links.length
    ? await db.select().from(stores).where(inArray(stores.id, links.map((l) => l.storeId)))
    : [];
  return {
    id: row.user.id,
    name: row.user.name,
    username: row.user.username,
    status: row.user.status,
    roleKey: row.role.key as StaffContext["roleKey"],
    roleName: row.role.name.pt,
    level: row.role.level,
    storeIds: storeRows.map((s) => s.id),
    storeCodes: storeRows.map((s) => s.code).sort(),
    perms: Object.fromEntries(perms.map((p) => [p.area, p.access as Access])),
  };
}

export async function currentStaff(): Promise<StaffContext | null> {
  const id = await currentSubjectId("staff");
  return id ? loadStaff(id) : null;
}

export function accessOf(staff: StaffContext, area: string): Access {
  return staff.perms[area] ?? "—";
}

export function can(staff: StaffContext, area: string): boolean {
  return accessOf(staff, area) !== "—";
}

/** EN: Can change (not only view). PT: Pode alterar (não só ver). */
export function canEdit(staff: StaffContext, area: string): boolean {
  return ["T", "L", "P"].includes(accessOf(staff, area));
}

/**
 * EN: null = every store; otherwise only these store ids ("L" = só as suas lojas).
 * PT: null = todas as lojas; caso contrário só estas ("L" = só as suas lojas).
 */
export function storeScope(staff: StaffContext, area: string): string[] | null {
  return accessOf(staff, area) === "L" ? staff.storeIds : null;
}

/** EN: For pages: signed in or go to the sign-in page. PT: Para páginas: com sessão ou vai para entrar. */
export async function requireStaffPage(area?: string, opts: { allowDriver?: boolean } = {}): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff) redirect("/gestao/entrar");
  if (staff.status === "temp_password") redirect("/gestao/entrar?primeiro=1");
  if (staff.roleKey === "entregador" && !opts.allowDriver) redirect("/gestao/sem-acesso");
  if (area && !can(staff, area)) redirect("/gestao/sem-acesso");
  return staff;
}

/** EN: For server actions / API: throws instead of redirecting. PT: Para acções: lança erro em vez de redireccionar. */
export async function requireStaffAction(area: string, mode: "view" | "edit" = "edit"): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff || staff.status === "temp_password") throw new AppError("UNAUTHORIZED", "SIGN_IN_REQUIRED", 401);
  if (mode === "edit" ? !canEdit(staff, area) && accessOf(staff, area) !== "Pd" : !can(staff, area)) {
    throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  }
  return staff;
}

export function assertStoreAllowed(staff: StaffContext, area: string, storeId: string | null | undefined) {
  const scope = storeScope(staff, area);
  if (scope && (!storeId || !scope.includes(storeId))) throw new AppError("FORBIDDEN", "OTHER_STORE", 403);
}
