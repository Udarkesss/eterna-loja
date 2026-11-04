import "server-only";
import { randomInt } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { LOYALTY_LEVELS } from "@/data/help";
import { formatMZN } from "@/lib/format";
import { toMaputo } from "@/lib/time";
import { audit } from "../audit";
import { getDb } from "../db";
import { customers, discountCodes } from "../db/schema";
import { discountSettings, levelByKey, voucherState, voucherUses, type DiscountSettings, type VoucherRow, type VoucherState } from "../discounts";
import { AppError } from "../errors";
import { sendMessage } from "../messaging";
import { setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · Descontos e vouchers" of design V3: the four kinds of discount (each switched on and off), how the
 *     discount is shown to the customer, the vouchers list (Todos · Por usar · Usados · Expirados, "Reenviar") and
 *     "Novo voucher" (fixed value or percentage, minimum purchase, for one customer / a level / everyone, valid until,
 *     uses, code, joins the level's discount, sent by WhatsApp and/or e-mail; always in the customer's account).
 * PT: Descontos e vouchers do V3: os quatro tipos de desconto (cada um liga e desliga), como o desconto aparece à
 *     cliente, a lista de vouchers e "Novo voucher". Fica sempre na conta da cliente.
 */

export interface VoucherListRow {
  id: string;
  code: string;
  forLabel: string;
  value: string;
  minPurchase: string;
  validity: string;
  sentVia: string;
  state: VoucherState;
  stateLabel: string;
  uses: number;
  canResend: boolean;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const day = (d: Date) => {
  const [y, m, dd] = toMaputo(d).date.split("-");
  return `${Number(dd)} ${MONTHS[Number(m) - 1]} ${y}`;
};
const valueText = (v: Pick<VoucherRow, "kind" | "value">) => (v.kind === "percent" ? `${v.value} %` : formatMZN(v.value, "pt"));
const cleanName = (n: string) => n.replace(/\[[^\]]*\]\s*/g, "").trim();

export const VOUCHER_VIEWS = { todos: "Todos", "por-usar": "Por usar", usados: "Usados", expirados: "Expirados" } as const;
export type VoucherView = keyof typeof VOUCHER_VIEWS;

export async function listVouchers(filter: { q?: string; view?: VoucherView } = {}): Promise<VoucherListRow[]> {
  const db = await getDb();
  const rows = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
  const people = await db.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email }).from(customers);
  const uses = await voucherUses(rows.map((r) => r.code));
  const now = new Date();
  const q = (filter.q ?? "").toLowerCase().trim();
  return rows
    .map((v): VoucherListRow => {
      const n = uses.get(v.code) ?? 0;
      const state = voucherState(v, n, now);
      const person = v.customerId ? people.find((p) => p.id === v.customerId) : null;
      const forLabel = v.target === "customer" ? (person?.name ?? "Cliente apagada") : v.target === "level" ? `Nível ${levelByKey(v.levelKey)?.name.pt ?? "—"}` : "Todas as clientes";
      const validity = v.endsAt
        ? v.endsAt < now
          ? `terminou a ${day(v.endsAt)}`
          : v.startsAt && v.startsAt > now
            ? `${day(v.startsAt)} – ${day(v.endsAt)}`
            : `até ${day(v.endsAt)}`
        : "sem prazo";
      const stateLabel =
        state === "expired" ? "Expirado" : state === "off" ? "Desligado" : v.target !== "customer" && n > 0 ? `${n} ${n === 1 ? "usado" : "usados"}` : state === "used" ? "Usado" : "Por usar";
      return {
        id: v.id,
        code: v.code,
        forLabel,
        value: valueText(v),
        minPurchase: v.minPurchase ? formatMZN(v.minPurchase, "pt") : "—",
        validity,
        sentVia: v.sentVia.length ? v.sentVia.map((c) => (c === "whatsapp" ? "WhatsApp" : "e-mail")).join(" e ").replace(/^e-mail/, "E-mail") : "Só na conta",
        state,
        stateLabel,
        uses: n,
        canResend: state === "unused" && v.sentVia.length > 0,
      };
    })
    .filter((r) => !q || [r.code, r.forLabel].join(" ").toLowerCase().includes(q))
    .filter((r) => {
      switch (filter.view ?? "todos") {
        case "por-usar":
          return r.state === "unused";
        case "usados":
          return r.uses > 0 || r.state === "used";
        case "expirados":
          return r.state === "expired";
        default:
          return true;
      }
    });
}

/** EN: People for "Para · Uma cliente". PT: Pessoas para "Para · Uma cliente". */
export async function voucherRecipients() {
  const db = await getDb();
  return db.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email }).from(customers).orderBy(asc(customers.name));
}

/** EN: The message sent with a voucher (design V3). PT: A mensagem enviada com o voucher (V3). */
export function voucherMessage(v: Pick<VoucherRow, "code" | "kind" | "value" | "minPurchase" | "endsAt">, name: string | null) {
  const first = name ? cleanName(name).split(" ")[0] : null;
  const value = v.kind === "percent" ? `${v.value}% de desconto` : formatMZN(v.value, "pt");
  const until = v.endsAt ? `, válido até ${Number(toMaputo(v.endsAt).date.slice(8))} de ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(toMaputo(v.endsAt).date.slice(5, 7)) - 1]}` : "";
  const min = v.minPurchase ? `, para compras a partir de ${formatMZN(v.minPurchase, "pt")}` : "";
  return `Olá${first ? ` ${first}` : ""}, tem um voucher de ${value} na Eterna${min}${until}. Código: ${v.code}. Use-o no checkout em eterna.co.mz ou na loja.`;
}

/** EN: A code like the design's: ETERNA-ANA-1000, or a random one. PT: Um código como o do design, ou aleatório. */
export function suggestCode(name: string | null, kind: "fixed" | "percent", value: number, random = false) {
  const word = name
    ? cleanName(name)
        .split(" ")[0]
        .normalize("NFD")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase()
        .slice(0, 10)
    : "";
  const tail = random ? String(randomInt(1000, 9999)) : String(value);
  return ["ETERNA", word || null, tail].filter(Boolean).join("-");
}

export interface NewVoucher {
  kind: "fixed" | "percent";
  value: number;
  minPurchase: number | null;
  target: "customer" | "level" | "all";
  customerId: string | null;
  levelKey: string | null;
  endsAt: string | null; // EN: yyyy-mm-dd (Maputo). PT: aaaa-mm-dd (Maputo).
  maxUses: number | null;
  code: string;
  stacksWithLevel: boolean;
  send: ("whatsapp" | "email")[];
}

const staffActor = (staff: StaffContext) => ({ type: "staff" as const, id: staff.id, name: staff.name, role: staff.roleName });

async function sendVoucher(v: VoucherRow) {
  const db = await getDb();
  const [person] = v.customerId ? await db.select().from(customers).where(eq(customers.id, v.customerId)) : [];
  if (!person) return 0;
  const text = voucherMessage(v, person.name);
  let sent = 0;
  if (v.sentVia.includes("whatsapp") && person.phone) {
    await sendMessage("whatsapp", `+258${person.phone}`, text);
    sent++;
  }
  if (v.sentVia.includes("email") && person.email) {
    await sendMessage("email", person.email, text);
    sent++;
  }
  return sent;
}

export async function createVoucher(staff: StaffContext, input: NewVoucher) {
  const db = await getDb();
  const code = input.code.trim().toUpperCase();
  const [taken] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code));
  if (taken) throw new AppError("VALIDATION_ERROR", "Já existe um voucher com este código. Carregue em “Gerar outro”.", 400);
  if (input.target === "customer" && !input.customerId) throw new AppError("VALIDATION_ERROR", "Escolha a cliente.", 400);
  if (input.target === "level" && !levelByKey(input.levelKey)) throw new AppError("VALIDATION_ERROR", "Escolha o nível.", 400);
  const send = input.target === "customer" ? input.send : [];
  const [v] = await db
    .insert(discountCodes)
    .values({
      code,
      kind: input.kind,
      value: input.value,
      minPurchase: input.minPurchase,
      target: input.target,
      customerId: input.target === "customer" ? input.customerId : null,
      levelKey: input.target === "level" ? input.levelKey : null,
      endsAt: input.endsAt ? new Date(`${input.endsAt}T23:59:59+02:00`) : null,
      maxUses: input.maxUses,
      stacksWithLevel: input.stacksWithLevel,
      sentVia: send,
    })
    .returning();
  const sent = send.length ? await sendVoucher(v) : 0;
  await audit({ actor: staffActor(staff), action: "Voucher criado", detail: `${code} · ${valueText(v)}${sent ? ` · enviado (${send.join(", ")})` : ""}` });
  return { code, sent };
}

export async function resendVoucher(staff: StaffContext, id: string) {
  const db = await getDb();
  const [v] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
  if (!v) throw new AppError("NOT_FOUND", "Voucher não encontrado.", 404);
  const sent = await sendVoucher(v);
  if (!sent) throw new AppError("VALIDATION_ERROR", "Este voucher não tem para quem reenviar (sem telefone nem e-mail).", 400);
  await audit({ actor: staffActor(staff), action: "Voucher reenviado", detail: v.code });
  return sent;
}

export const KIND_LABELS: Record<keyof Omit<DiscountSettings, "display">, string> = {
  level: "Nível de fidelidade",
  campaigns: "Campanhas",
  sale: "Saldo numa peça",
  vouchers: "Vouchers",
};

export async function setDiscountKind(staff: StaffContext, kind: keyof Omit<DiscountSettings, "display">, on: boolean) {
  const current = await discountSettings();
  await setSetting("discounts", { ...current, [kind]: on });
  await audit({ actor: staffActor(staff), action: on ? "Desconto ligado" : "Desconto desligado", detail: KIND_LABELS[kind] });
}

export async function setDiscountDisplay(staff: StaffContext, display: DiscountSettings["display"]) {
  const current = await discountSettings();
  await setSetting("discounts", { ...current, display });
  await audit({ actor: staffActor(staff), action: "Forma de mostrar o desconto alterada", detail: display === "plain" ? "Sem o nome do nível" : "Com o nome do nível" });
}

export const levelOptions = () => LOYALTY_LEVELS.map((l) => ({ key: l.key, name: l.name.pt, pct: l.pct }));
