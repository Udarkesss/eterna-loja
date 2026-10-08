import "server-only";
import { asc, eq } from "drizzle-orm";
import type { PaymentMethod } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { notificationRecipients, paymentMethodSettings, roles, staffUsers, stores } from "../db/schema";
import { getSetting, setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · 10 Pagamentos e avisos": which methods appear in the checkout, who is told about new purchases
 *     (panel / e-mail / WhatsApp) and on which events.
 * PT: Que métodos aparecem no checkout, quem é avisado das novas compras (painel / e-mail / WhatsApp) e quando.
 */

export const NOTIFY_EVENTS = {
  newPaidOrder: "Há uma nova compra paga",
  pendingOver10Min: "Um pagamento está pendente há mais de 10 minutos",
  transferProof: "Chega um comprovativo de transferência",
  cashOnDelivery: "Uma encomenda é paga na entrega",
  customerConfirmed: "A cliente confirma a recepção",
} as const;
export type NotifyEvents = Record<keyof typeof NOTIFY_EVENTS, boolean>;

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export async function loadPaymentsPage() {
  const db = await getDb();
  const [methods, recipients, staff, storeRows, events] = await Promise.all([
    db.select().from(paymentMethodSettings).orderBy(asc(paymentMethodSettings.position)),
    db.select().from(notificationRecipients),
    db
      .select({ id: staffUsers.id, name: staffUsers.name, role: roles.name, roleKey: roles.key })
      .from(staffUsers)
      .innerJoin(roles, eq(staffUsers.roleId, roles.id)),
    db.select().from(stores).orderBy(asc(stores.position)),
    getSetting<NotifyEvents>("notifications.events", { newPaidOrder: true, pendingOver10Min: true, transferProof: true, cashOnDelivery: true, customerConfirmed: false }),
  ]);
  return {
    methods,
    recipients: recipients.map((r) => ({ ...r, person: staff.find((st) => st.id === r.staffUserId) })),
    staff: staff.filter((st) => st.roleKey !== "entregador").map((st) => ({ id: st.id, name: st.name, role: st.role.pt })),
    stores: storeRows.map((st) => ({ id: st.id, code: st.code })),
    events,
  };
}

export interface PaymentsSave {
  methods: { method: PaymentMethod; enabled: boolean }[];
  recipients: { staffUserId: string; panel: boolean; email: boolean; whatsapp: boolean; storeId: string | null }[];
  events: NotifyEvents;
}

export async function savePaymentsPage(staff: StaffContext, input: PaymentsSave) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const m of input.methods) {
      await tx.update(paymentMethodSettings).set({ enabled: m.enabled, updatedAt: new Date() }).where(eq(paymentMethodSettings.method, m.method));
    }
    await tx.delete(notificationRecipients);
    if (input.recipients.length) await tx.insert(notificationRecipients).values(input.recipients);
  });
  await setSetting("notifications.events", input.events, staff.id);
  const on = input.methods.filter((m) => m.enabled).map((m) => m.method).join(", ");
  await audit({ actor: actor(staff), action: "Pagamentos e avisos alterados", detail: `Activos: ${on}` });
}
