import "server-only";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { addDays, fromMaputo, mondayOf, todayMaputo } from "@/lib/time";
import type { FittingKind, PaymentMethod, PaymentStatus, FulfillmentStatus } from "@/types";
import { hashPassword, randomToken } from "./auth/crypto";
import { getDb } from "./db";
import {
  auditLogs,
  customerIdentities,
  customers,
  fittings,
  orderEvents,
  orderLines,
  orders,
  privateFiles,
  products,
  productImages,
  productVariants,
  roles,
  sessions,
  settings,
  staffUserStores,
  staffUsers,
  stores,
} from "./db/schema";

/**
 * EN: Demo data to see the whole system working: team members of every role, customers (two with an account),
 *     orders in every state, this week's fittings and requests, and audit entries. Every row is marked is_demo
 *     and is removed by clearDemoData() — real data is never touched. Loaded from Gestão · Definições.
 *     Demo team password: DEMO_PASSWORD in .env.local (see .env.example).
 * PT: Dados de exemplo para ver o sistema a funcionar. Todas as linhas ficam marcadas is_demo e são apagadas por
 *     clearDemoData() — os dados reais nunca são tocados. Carregam-se em Gestão · Definições.
 */

const DEMO_PASSWORD = () => process.env.DEMO_PASSWORD || "demo-eterna-2026";

export async function demoStatus() {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.isDemo, true));
  const [st] = await db.select({ n: sql<number>`count(*)::int` }).from(staffUsers).where(eq(staffUsers.isDemo, true));
  return { orders: row.n, staff: st.n };
}

export async function clearDemoData() {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const demoStaff = await tx.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.isDemo, true));
    const demoCustomers = await tx.select({ id: customers.id }).from(customers).where(eq(customers.isDemo, true));
    await tx.delete(orders).where(eq(orders.isDemo, true));
    await tx.delete(fittings).where(eq(fittings.isDemo, true));
    await tx.delete(auditLogs).where(eq(auditLogs.isDemo, true));
    await tx.delete(privateFiles).where(like(privateFiles.name, "demo-%"));
    if (demoStaff.length) {
      await tx.delete(sessions).where(and(eq(sessions.subjectType, "staff"), inArray(sessions.subjectId, demoStaff.map((s) => s.id))));
      await tx.update(orders).set({ driverId: null }).where(inArray(orders.driverId, demoStaff.map((s) => s.id)));
      await tx.delete(staffUsers).where(eq(staffUsers.isDemo, true));
    }
    if (demoCustomers.length) {
      await tx.delete(sessions).where(and(eq(sessions.subjectType, "customer"), inArray(sessions.subjectId, demoCustomers.map((c) => c.id))));
      await tx.delete(customers).where(eq(customers.isDemo, true));
    }
  });
}

const PEOPLE = [
  { name: "[Cliente 1] Ana Machava", phone: "841230012", email: "ana.demo@exemplo.co.mz", account: true },
  { name: "[Cliente 2] Célia Nhantumbo", phone: "861230040", email: null, account: false },
  { name: "[Cliente 3] Rosa Cossa", phone: "821230007", email: null, account: false },
  { name: "[Cliente 4] Marta Sitoe", phone: "841230063", email: "marta.demo@exemplo.co.mz", account: true },
  { name: "[Cliente 5] Luísa Mondlane", phone: "871230090", email: null, account: false },
  { name: "[Cliente 6] Joana Tembe", phone: "851230028", email: null, account: false },
];

export async function loadDemoData() {
  await clearDemoData();
  const db = await getDb();
  const password = await hashPassword(DEMO_PASSWORD());
  const storeRows = await db.select().from(stores);
  const s02 = storeRows.find((s) => s.code === "02")!;
  const s22 = storeRows.find((s) => s.code === "22")!;
  const roleRows = await db.select().from(roles);
  const role = (k: string) => roleRows.find((r) => r.key === k)!.id;

  // ── Team / Equipa ──
  const team = [
    { name: "[Superadministrador de exemplo]", username: "demo.super", phone: "840000001", role: "super", stores: [s02, s22] },
    { name: "[Administradora] Helena Chissano", username: "demo.admin", phone: "840000002", role: "admin", stores: [s02, s22] },
    { name: "[Gestora da Loja 02] Sara Macuácua", username: "demo.gestora02", phone: "820000003", role: "gestor", stores: [s02] },
    { name: "[Gestora da Loja 22] Inês Langa", username: "demo.gestora22", phone: "850000004", role: "gestor", stores: [s22] },
    { name: "[Atendedora] Paula Mabunda", username: "demo.atend02", phone: "860000005", role: "atendedor", stores: [s02] },
    { name: "[Entregador] João Muianga", username: "demo.entregador", phone: "840000021", role: "entregador", stores: [s02, s22] },
  ];
  const staffIds: Record<string, string> = {};
  for (const t of team) {
    const [row] = await db
      .insert(staffUsers)
      .values({ name: t.name, username: t.username, phone: t.phone, roleId: role(t.role), status: "active", passwordHash: password, isDemo: true, vehicleType: t.role === "entregador" ? "Mota" : null, vehiclePlate: t.role === "entregador" ? "AFM 123 MC" : null })
      .returning({ id: staffUsers.id });
    staffIds[t.username] = row.id;
    await db.insert(staffUserStores).values(t.stores.map((s) => ({ staffUserId: row.id, storeId: s.id })));
  }

  // ── Customers / Clientes ──
  const customerIds: (string | null)[] = [];
  for (const p of PEOPLE) {
    if (!p.account) {
      customerIds.push(null);
      continue;
    }
    const [c] = await db
      .insert(customers)
      .values({ name: p.name, phone: p.phone, phoneVerifiedAt: new Date(), email: p.email, passwordHash: password, isDemo: true, createdAt: new Date(Date.now() - 400 * 86_400_000) })
      .returning({ id: customers.id });
    await db.insert(customerIdentities).values({ customerId: c.id, provider: "whatsapp", providerUserId: p.phone, label: `+258 ${p.phone.slice(0, 2)} ${p.phone.slice(2, 5)} ${p.phone.slice(5)}` });
    customerIds.push(c.id);
  }

  // ── Orders / Encomendas ──
  const vs = await db
    .select({ v: productVariants, code: products.code, slug: products.slug, name: products.name, price: products.price, salePrice: products.salePrice, productId: products.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id));
  const imgs = await db.select().from(productImages);
  const pick = (code: string) => vs.find((x) => x.code === code) ?? vs[0];
  const ago = (min: number) => new Date(Date.now() - min * 60_000);

  const plan: {
    who: number;
    codes: string[];
    method: PaymentMethod;
    pay: PaymentStatus;
    type: "pickup" | "delivery";
    store?: typeof s02;
    ful: FulfillmentStatus;
    at: Date;
    driver?: boolean;
    proof?: boolean;
  }[] = [
    { who: 0, codes: ["8G1L7", "8G106"], method: "mpesa", pay: "paid", type: "pickup", store: s02, ful: "pending", at: ago(40) },
    { who: 1, codes: ["7G272"], method: "emola", pay: "pending", type: "delivery", ful: "pending", at: ago(22) },
    { who: 2, codes: ["M164"], method: "mpesa", pay: "failed", type: "pickup", store: s02, ful: "cancelled", at: ago(95) },
    { who: 3, codes: ["9J253"], method: "transfer", pay: "pending", type: "delivery", ful: "pending", at: ago(180), proof: true },
    { who: 4, codes: ["4G158"], method: "mpesa", pay: "expired", type: "pickup", store: s02, ful: "cancelled", at: ago(300) },
    { who: 5, codes: ["8G106"], method: "cod", pay: "pending", type: "delivery", ful: "in_transit", at: ago(150), driver: true },
    { who: 0, codes: ["9J253"], method: "card", pay: "paid", type: "pickup", store: s22, ful: "collected", at: ago(60 * 24 * 40) },
    { who: 3, codes: ["7G272"], method: "mpesa", pay: "paid", type: "delivery", ful: "delivered", at: ago(60 * 24 * 12), driver: true },
    { who: 1, codes: ["M164"], method: "mkesh", pay: "paid", type: "pickup", store: s02, ful: "ready", at: ago(60 * 26) },
  ];
  // EN: A small sample PDF as the demo transfer proof. PT: Um PDF pequeno como comprovativo de exemplo.
  const pdf = Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
      "4 0 obj<</Length 74>>stream",
      "BT /F1 16 Tf 30 110 Td (Comprovativo de exemplo - Eterna) Tj ET",
      "endstream endobj",
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
      "trailer<</Root 1 0 R>>",
      "%%EOF",
    ].join("\n"),
  );
  const [proof] = await db
    .insert(privateFiles)
    .values({ name: "demo-comprovativo.pdf", contentType: "application/pdf", size: pdf.length, data: pdf })
    .returning({ id: privateFiles.id });
  const year = new Date().getFullYear();
  for (const o of plan) {
    const person = PEOPLE[o.who];
    const lines = o.codes.map((code) => pick(code));
    const subtotal = lines.reduce((n, l) => n + (l.salePrice ?? l.price), 0);
    const [seq] = await db
      .insert(settings)
      .values({ key: `orders.sequence.${year}`, value: 1 })
      .onConflictDoUpdate({ target: settings.key, set: { value: sql`to_jsonb((${settings.value})::text::int + 1)` } })
      .returning({ value: settings.value });
    const mobile = ["mpesa", "emola", "mkesh"].includes(o.method);
    const [order] = await db
      .insert(orders)
      .values({
        number: `ET-${year}-${String(seq.value).padStart(4, "0")}`,
        customerId: customerIds[o.who],
        locale: "pt",
        contact: { name: person.name, phone: person.phone, ...(person.email ? { email: person.email } : {}) },
        subtotal,
        shippingFee: 0,
        total: subtotal,
        paymentMethod: o.method,
        paymentStatus: o.pay,
        paymentReference: mobile || o.method === "card" ? `DEMO-${randomToken(6)}` : null,
        paymentResponseCode: o.pay === "paid" && mobile ? "INS-0" : o.pay === "failed" ? "INS-2006" : null,
        msisdn: mobile ? person.phone : null,
        transferProofUrl: o.proof ? `file:${proof.id}` : null,
        paymentExpiresAt: o.pay === "pending" && mobile ? new Date(Date.now() + 60 * 60_000) : null,
        fulfillmentType: o.type,
        fulfillmentStatus: o.ful,
        pickupStoreId: o.store?.id ?? null,
        deliveryCity: o.type === "delivery" ? "Maputo" : null,
        deliveryNeighbourhood: o.type === "delivery" ? "Sommerschield" : null,
        deliveryAddress: o.type === "delivery" ? "Av. Julius Nyerere, 1234" : null,
        deliveryCode: o.type === "delivery" ? "4821" : null,
        driverId: o.driver ? staffIds["demo.entregador"] : null,
        isDemo: true,
        createdAt: o.at,
      })
      .returning({ id: orders.id });
    await db.insert(orderLines).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        variantId: l.v.id,
        storeId: l.v.storeId,
        slug: l.slug,
        code: l.code,
        name: l.name.pt,
        color: l.v.color,
        size: l.v.size,
        imageUrl: imgs.find((i) => i.productId === l.productId)?.url ?? null,
        unitPrice: l.salePrice ?? l.price,
        quantity: 1,
      })),
    );
    const events = ["created", ...(o.method !== "transfer" && o.method !== "cod" ? ["payment_requested"] : []), ...(o.proof ? ["transfer_proof"] : []), ...(o.pay !== "pending" ? [`payment_${o.pay}`] : [])];
    if (o.ful === "ready" || o.ful === "collected") events.push("ready");
    if (o.ful === "collected") events.push("collected");
    if (o.driver) events.push("assigned", "in_transit");
    if (o.ful === "delivered") events.push("delivered");
    await db.insert(orderEvents).values(events.map((type, i) => ({ orderId: order.id, type, at: new Date(o.at.getTime() + i * 60_000) })));
  }

  // ── Fittings / Provas ──
  const monday = mondayOf(todayMaputo());
  const productId = (code: string) => pick(code).productId;
  const fittingPlan: { d: number; time: string; who: string; phone: string; kind: FittingKind; store: typeof s02; status: "confirmed" | "pending" | "requested" | "done"; pieces?: string[] }[] = [
    { d: 0, time: "10:00", who: "[Cliente 10] Filipa Nhaca", phone: "841110010", kind: "bride_white", store: s22, status: "done", pieces: ["9J253"] },
    { d: 1, time: "11:30", who: "[Cliente 11] Teresa Zandamela", phone: "841110011", kind: "bride_privee", store: s22, status: "confirmed" },
    { d: 1, time: "15:00", who: "[Cliente 12] Rute Magaia", phone: "861110012", kind: "bridesmaid_mother", store: s02, status: "confirmed", pieces: ["8G106"] },
    { d: 2, time: "09:30", who: "[Cliente 13] Nádia Bila", phone: "821110013", kind: "gala", store: s02, status: "pending", pieces: ["7G272"] },
    { d: 3, time: "14:00", who: "[Cliente 15] Sónia Chirindza", phone: "841110015", kind: "engagement_lobolo", store: s02, status: "confirmed" },
    { d: 4, time: "16:00", who: "[Cliente 14] Vera Muchanga", phone: "851110014", kind: "bride_second", store: s22, status: "confirmed" },
    { d: 5, time: "10:00", who: "[Cliente 18] Carla Simango", phone: "871110018", kind: "bride_privee", store: s22, status: "confirmed" },
    { d: 9, time: "11:00", who: "[Cliente 20] Diana Matsinhe", phone: "841110020", kind: "bride_white", store: s22, status: "requested", pieces: ["9J253"] },
    { d: 12, time: "15:00", who: "[Cliente 21] Elsa Nhamussua", phone: "861110021", kind: "guest", store: s02, status: "requested", pieces: ["8G1L7", "4G158"] },
  ];
  const [counter] = await db.select().from(settings).where(eq(settings.key, "fittings.sequence"));
  let n = Number(counter?.value ?? 0);
  for (const f of fittingPlan) {
    n += 1;
    await db.insert(fittings).values({
      code: `PR-${String(n).padStart(4, "0")}`,
      publicToken: randomToken(18),
      clientName: f.who,
      phone: f.phone,
      storeId: f.store.id,
      startsAt: fromMaputo(addDays(monday, f.d), f.time),
      durationMinutes: ["bride_white", "bride_privee", "bride_second"].includes(f.kind) ? 90 : 60,
      kind: f.kind,
      status: f.status,
      source: f.status === "requested" ? "site" : "whatsapp",
      productIds: (f.pieces ?? []).map(productId),
      internalNotes: f.d === 1 ? "Tamanho habitual 38. Vem com a mãe." : null,
      isDemo: true,
    });
  }
  await db.insert(settings).values({ key: "fittings.sequence", value: n }).onConflictDoUpdate({ target: settings.key, set: { value: n } });

  // ── Audit / Auditoria ──
  const entries: [number, string, string, string, string | null, string, "success" | "warning" | "blocked"][] = [
    [5, "[Entregador] João Muianga", "Entregador", "Entrega confirmada com código", "Encomenda de exemplo", "Telemóvel · 84.xxx", "success"],
    [20, "[Administradora] Helena Chissano", "Administrador", "Permissões alteradas", "Atendedor · Encomendas: cancelar → —", "Computador · 197.xxx", "success"],
    [45, "[Gestora da Loja 02] Sara Macuácua", "Gestor de loja", "Entregador atribuído", "→ [Entregador] João Muianga", "Computador · Loja 02", "success"],
    [95, "demo.atend22", "—", "Login falhado (3.ª tentativa)", "Palavra-passe errada", "Telemóvel · 41.xxx", "warning"],
    [100, "demo.atend22", "—", "Conta bloqueada 15 min", "5 tentativas falhadas", "Telemóvel · 41.xxx", "blocked"],
    [180, "[Administradora] Helena Chissano", "Administrador", "Entrada na gestão", null, "Computador · 197.xxx", "success"],
  ];
  await db.insert(auditLogs).values(
    entries.map(([min, name, roleName, action, detail, origin, result]) => ({ at: ago(min), actorType: "staff" as const, actorName: name, actorRole: roleName, action, detail, origin, result, isDemo: true })),
  );
}
