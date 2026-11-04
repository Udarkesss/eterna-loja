import "server-only";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { LOYALTY_LEVELS, type LoyaltyLevel } from "@/data/help";
import { levelFor, MT_PER_POINT } from "@/lib/loyalty";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { audit } from "../audit";
import { getDb } from "../db";
import { customers, loyaltyEntries, orders, stores } from "../db/schema";
import { AppError } from "../errors";
import { currentYear, levelInYear, loyaltyYears, type YearPoints } from "../loyalty";
import { sendMessage } from "../messaging";
import type { StaffContext } from "../staff/access";
import { readXlsx, writeXlsx } from "../xlsx";

/**
 * EN: "Gestão · Clientes" of design V3: the loyalty programme (Rubi, Safira, Pérola, Diamante). Level of this year
 *     (editable, with a reason), points of this year (online · store), origin, last purchase; the customer's card with
 *     the yearly history, "Registar compra na loja", "Ajustar pontos"; the yearly review on 1 January; and the import of
 *     the old store's customers (Excel). Every change goes to the audit log.
 * PT: Clientes do V3: nível deste ano (editável, com motivo), pontos deste ano (online · loja), origem, última compra;
 *     a ficha com o histórico por ano, "Registar compra na loja", "Ajustar pontos"; a revisão anual a 1 de janeiro; e a
 *     importação das clientes da loja antiga (Excel). Cada alteração fica no registo de auditoria.
 */

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  since: Date;
  origin: "site" | "import";
  level: LoyaltyLevel; // EN: this year. PT: deste ano.
  levelSetByHand: boolean;
  levelReason: string | null;
  year: YearPoints;
  nextLevel: LoyaltyLevel; // EN: next year's level with today's points. PT: nível do próximo ano com os pontos de hoje.
  lastPurchase: Date | null;
  isDemo: boolean;
}

const emptyYear = (): YearPoints => ({ onlineSpent: 0, storeSpent: 0, online: 0, store: 0, other: 0, points: 0 });
const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s/g, "");

/** EN: Every customer with this year's level and points. PT: Todas as clientes com o nível e os pontos deste ano. */
export async function listClients(filter: { q?: string; level?: string } = {}): Promise<ClientRow[]> {
  const db = await getDb();
  const rows = await db.select().from(customers).orderBy(asc(customers.name));
  const ids = rows.map((r) => r.id);
  const [years, lastOrders, lastStore] = await Promise.all([
    loyaltyYears(ids),
    ids.length
      ? db
          .select({ id: orders.customerId, at: max(orders.createdAt) })
          .from(orders)
          .where(and(inArray(orders.customerId, ids), eq(orders.paymentStatus, "paid")))
          .groupBy(orders.customerId)
      : [],
    ids.length
      ? db
          .select({ id: loyaltyEntries.customerId, at: max(loyaltyEntries.createdAt) })
          .from(loyaltyEntries)
          .where(and(inArray(loyaltyEntries.customerId, ids), eq(loyaltyEntries.kind, "store")))
          .groupBy(loyaltyEntries.customerId)
      : [],
  ]);
  const year = currentYear();
  const latest = new Map<string, Date>();
  for (const r of [...lastOrders, ...lastStore]) {
    if (!r.id || !r.at) continue;
    const at = new Date(r.at);
    if (!latest.has(r.id) || latest.get(r.id)! < at) latest.set(r.id, at);
  }
  const q = fold(filter.q ?? "");
  return rows
    .map((c): ClientRow => {
      const y = years.get(c.id)?.get(year) ?? emptyYear();
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        since: c.createdAt,
        origin: c.origin,
        level: levelInYear(c, years.get(c.id), year),
        levelSetByHand: c.levelOverrideYear === year && !!c.levelOverride,
        levelReason: c.levelOverrideYear === year ? c.levelReason : null,
        year: y,
        nextLevel: levelFor(y.points),
        lastPurchase: latest.get(c.id) ?? null,
        isDemo: c.isDemo,
      };
    })
    .filter((c) => !q || fold([c.name, c.phone ?? "", c.email ?? ""].join("")).includes(q))
    .filter((c) => !filter.level || c.level.key === filter.level)
    .sort((a, b) => (b.lastPurchase?.getTime() ?? 0) - (a.lastPurchase?.getTime() ?? 0) || a.name.localeCompare(b.name, "pt"));
}

/** EN: "Origem" column: "32 online · 14 loja", or imported. PT: Coluna "Origem". */
export function originText(c: ClientRow): string {
  if (c.origin === "import") return "Importada da loja antiga";
  const parts = [c.year.online ? `${c.year.online} online` : null, c.year.store ? `${c.year.store} loja` : null].filter(Boolean);
  return parts.join(" · ") || "Sem compras este ano";
}

/** EN: The card's yearly history (newest first). PT: Histórico por ano da ficha (mais recente primeiro). */
export async function clientHistory(c: ClientRow) {
  const years = (await loyaltyYears([c.id])).get(c.id);
  const db = await getDb();
  const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
  const now = currentYear();
  const first = Math.min(Number(c.since.toISOString().slice(0, 4)), ...[...(years?.keys() ?? [])]);
  const out: { year: number; points: number; next: LoyaltyLevel; current: boolean }[] = [];
  for (let y = now; y >= first && out.length < 6; y--) {
    out.push({ year: y, points: years?.get(y)?.points ?? 0, next: levelInYear(row, years, y + 1), current: y === now });
  }
  return out;
}

/** EN: Forecast of the review on 1 January. PT: Previsão da revisão a 1 de janeiro. */
export function reviewForecast(list: ClientRow[]) {
  const rank = (l: LoyaltyLevel) => LOYALTY_LEVELS.findIndex((x) => x.key === l.key);
  const up = list.filter((c) => rank(c.nextLevel) > rank(c.level));
  const down = list.filter((c) => rank(c.nextLevel) < rank(c.level));
  return { up, keep: list.length - up.length - down.length, down };
}

const staffActor = (staff: StaffContext) => ({ type: "staff" as const, id: staff.id, name: staff.name, role: staff.roleName });
const levelByKey = (key: string) => {
  const l = LOYALTY_LEVELS.find((x) => x.key === key);
  if (!l) throw new AppError("VALIDATION_ERROR", "Nível desconhecido.", 400);
  return l;
};

async function clientOrThrow(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) throw new AppError("NOT_FOUND", "Cliente não encontrada.", 404);
  return c;
}

/** EN: "Guardar nível": this year's level by hand, with a reason. PT: Nível deste ano à mão, com motivo. */
export async function setClientLevel(staff: StaffContext, id: string, levelKey: string, reason: string) {
  const c = await clientOrThrow(id);
  const level = levelByKey(levelKey);
  const db = await getDb();
  await db.update(customers).set({ levelOverride: level.key, levelOverrideYear: currentYear(), levelReason: reason, updatedAt: new Date() }).where(eq(customers.id, id));
  await audit({ actor: staffActor(staff), action: "Nível de cliente alterado", detail: `${c.name} → ${level.name.pt} (${level.pct}%) · ${reason}` });
}

/** EN: "Registar compra na loja": 1 000 MT = 1 point. PT: 1 000 MT = 1 ponto. */
export async function registerStorePurchase(staff: StaffContext, id: string, amount: number, storeCode: string) {
  const c = await clientOrThrow(id);
  const db = await getDb();
  const [store] = await db.select().from(stores).where(eq(stores.code, storeCode));
  if (!store) throw new AppError("VALIDATION_ERROR", "Loja desconhecida.", 400);
  const points = Math.floor(amount / MT_PER_POINT);
  await db.insert(loyaltyEntries).values({ customerId: id, year: currentYear(), kind: "store", points, amount, storeId: store.id, actorName: staff.name });
  await audit({ actor: staffActor(staff), action: "Compra na loja associada", detail: `${c.name} · ${amount} MT · ${store.name} · +${points} pontos` });
  return points;
}

/** EN: "Guardar ajuste": + or − points with a reason. PT: Mais ou menos pontos, com motivo. */
export async function adjustPoints(staff: StaffContext, id: string, points: number, reason: string) {
  const c = await clientOrThrow(id);
  const db = await getDb();
  await db.insert(loyaltyEntries).values({ customerId: id, year: currentYear(), kind: "adjust", points, reason, actorName: staff.name });
  await audit({ actor: staffActor(staff), action: "Pontos ajustados", detail: `${c.name} · ${points > 0 ? "+" : ""}${points} pontos · ${reason}` });
}

/** EN: "Avisar quem sobe": a WhatsApp to each customer going up on 1 January. PT: WhatsApp a cada cliente que sobe. */
export async function notifyLevelUps(staff: StaffContext) {
  const { up } = reviewForecast(await listClients());
  const next = currentYear() + 1;
  let sent = 0;
  for (const c of up) {
    if (!c.phone) continue;
    const first = c.name.replace(/\[[^\]]*\]\s*/g, "").split(" ")[0];
    await sendMessage(
      "whatsapp",
      `+258${c.phone}`,
      `Olá ${first}! Com as suas compras de ${next - 1}, a partir de 1 de janeiro de ${next} passa a ${c.nextLevel.name.pt}: ${c.nextLevel.pct}% de desconto em todas as compras e reservas. Obrigada por escolher a Eterna.`,
    );
    sent++;
  }
  await audit({ actor: staffActor(staff), action: "Clientes avisadas da subida de nível", detail: `${sent} mensagens por WhatsApp` });
  return sent;
}

// ── Excel ───────────────────────────────────────────────────────────────

const TEMPLATE_HEAD = ["Nome", "Telefone", "E-mail", "Nível", "Pontos do ano"];

/** EN: "Modelo Excel" with the level pick list. PT: "Modelo Excel" com a lista de níveis. */
export function clientsTemplate(): Buffer {
  return writeXlsx("Clientes", [TEMPLATE_HEAD], {
    lists: { 3: LOYALTY_LEVELS.map((l) => l.name.pt) },
    widths: [28, 16, 28, 14, 14],
  });
}

/** EN: "Exportar CSV" as Excel-friendly CSV. PT: "Exportar CSV". */
export function clientsCsv(list: ClientRow[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const y = currentYear();
  return [
    ["Nome", "Telefone", "E-mail", `Nível ${y}`, `Pontos ${y}`, "Pontos online", "Pontos loja", "Outros pontos", "Origem", "Última compra", "Cliente desde"].map(esc).join(";"),
    ...list.map((c) =>
      [
        c.name,
        c.phone ? `+258${c.phone}` : "",
        c.email,
        c.level.name.pt,
        c.year.points,
        c.year.online,
        c.year.store,
        c.year.other,
        c.origin === "import" ? "Loja antiga" : "Site",
        c.lastPurchase?.toISOString().slice(0, 10) ?? "",
        c.since.toISOString().slice(0, 10),
      ]
        .map(esc)
        .join(";"),
    ),
  ].join("\r\n");
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

/**
 * EN: "Importar clientes": Excel with name, phone, e-mail, level and points of the year. A repeated phone (or e-mail)
 *     joins the same card; importing again replaces the imported points of the year, it never adds them twice.
 * PT: "Importar clientes": Excel com nome, telefone, e-mail, nível e pontos do ano. Telefone (ou e-mail) repetido junta-se
 *     à mesma ficha; importar de novo substitui os pontos importados do ano, nunca os soma duas vezes.
 */
export async function importClients(staff: StaffContext, file: Buffer): Promise<ImportResult> {
  let rows: string[][];
  try {
    rows = readXlsx(file);
  } catch {
    throw new AppError("VALIDATION_ERROR", "O ficheiro não é um Excel (.xlsx) válido.", 400);
  }
  const head = (rows[0] ?? []).map(fold);
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.startsWith(fold(n))));
  const cName = col("nome");
  const cPhone = col("telefone", "telemovel", "whatsapp");
  const cEmail = col("e-mail", "email");
  const cLevel = col("nivel");
  const cPoints = col("pontos");
  if (cName < 0 || (cPhone < 0 && cEmail < 0)) throw new AppError("VALIDATION_ERROR", "O Excel precisa das colunas Nome e Telefone (ou E-mail). Use o modelo.", 400);

  const db = await getDb();
  const year = currentYear();
  const result: ImportResult = { created: 0, updated: 0, skipped: [] };
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = (r[cName] ?? "").trim();
    const rawPhone = cPhone >= 0 ? (r[cPhone] ?? "").trim() : "";
    const phone = rawPhone ? normalizeMsisdn(rawPhone) : null;
    const email = cEmail >= 0 ? (r[cEmail] ?? "").trim().toLowerCase() || null : null;
    if (!name && !rawPhone && !email) continue;
    if (!name) {
      result.skipped.push({ row: i + 1, reason: "Sem nome" });
      continue;
    }
    if (rawPhone && !phone) {
      result.skipped.push({ row: i + 1, reason: `Telefone inválido (${rawPhone})` });
      continue;
    }
    if (!phone && !email) {
      result.skipped.push({ row: i + 1, reason: "Sem telefone nem e-mail" });
      continue;
    }
    const levelText = cLevel >= 0 ? fold(r[cLevel] ?? "") : "";
    const level = levelText ? LOYALTY_LEVELS.find((l) => fold(l.name.pt) === levelText || fold(l.name.en) === levelText || l.key === levelText) : undefined;
    if (levelText && !level) {
      result.skipped.push({ row: i + 1, reason: `Nível desconhecido (${r[cLevel]})` });
      continue;
    }
    const pointsText = cPoints >= 0 ? (r[cPoints] ?? "").replace(/\s/g, "").replace(",", ".") : "";
    const points = pointsText ? Math.round(Number(pointsText)) : 0;
    if (!Number.isFinite(points) || points < 0) {
      result.skipped.push({ row: i + 1, reason: `Pontos inválidos (${r[cPoints]})` });
      continue;
    }

    const [byPhone] = phone ? await db.select().from(customers).where(eq(customers.phone, phone)) : [];
    const [byEmail] = !byPhone && email ? await db.select().from(customers).where(eq(customers.email, email)) : [];
    let id = (byPhone ?? byEmail)?.id;
    const levelPatch = level ? { levelOverride: level.key, levelOverrideYear: year, levelReason: "Nível da loja antiga" } : {};
    if (id) {
      const existing = byPhone ?? byEmail!;
      await db
        .update(customers)
        .set({ ...levelPatch, phone: existing.phone ?? phone, email: existing.email ?? (email ? await freeEmail(email) : null), updatedAt: new Date() })
        .where(eq(customers.id, id));
      result.updated++;
    } else {
      const [created] = await db
        .insert(customers)
        .values({ name, phone, email: email ? await freeEmail(email) : null, origin: "import", ...levelPatch })
        .returning({ id: customers.id });
      id = created.id;
      result.created++;
    }
    await db.delete(loyaltyEntries).where(and(eq(loyaltyEntries.customerId, id), eq(loyaltyEntries.year, year), eq(loyaltyEntries.kind, "import")));
    if (points > 0) await db.insert(loyaltyEntries).values({ customerId: id, year, kind: "import", points, reason: "Pontos da loja antiga", actorName: staff.name });
  }
  await audit({
    actor: staffActor(staff),
    action: "Clientes importadas da loja antiga",
    detail: `${result.created} novas · ${result.updated} actualizadas · ${result.skipped.length} ignoradas`,
    result: result.skipped.length ? "warning" : "success",
  });
  return result;
}

/** EN: An e-mail already used by another card is left out (it stays unique). PT: E-mail já usado noutra ficha fica de fora. */
async function freeEmail(email: string): Promise<string | null> {
  const db = await getDb();
  const [taken] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email));
  return taken ? null : email;
}
