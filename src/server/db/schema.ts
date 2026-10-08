import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  CATEGORY_KINDS,
  FULFILLMENT_STATUSES,
  FULFILLMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_STATUSES,
  type Customer,
  type Locale,
  type Localized,
  type ProductColor,
} from "@/types";

/**
 * EN: Database schema (PostgreSQL), modelled on the design canvas "Eterna — Loja Online de Luxo".
 *     Sections follow the build plan (docs/PLANO.md). After changing it run `npm run db:generate`.
 *     Customer-facing texts are stored as { pt, en } (jsonb) so a new language needs no new columns.
 * PT: Esquema da base de dados (PostgreSQL), feito a partir do canvas "Eterna — Loja Online de Luxo".
 *     As secções seguem o plano (docs/PLANO.md). Depois de o alterar, correr `npm run db:generate`.
 *     Os textos para a cliente ficam como { pt, en } (jsonb), por isso um novo idioma não precisa de colunas novas.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ── Enums ─────────────────────────────────────────────────────────────
export const categoryKind = pgEnum("category_kind", CATEGORY_KINDS);
export const productStatus = pgEnum("product_status", PRODUCT_STATUSES);
export const paymentMethod = pgEnum("payment_method", PAYMENT_METHODS);
export const paymentStatus = pgEnum("payment_status", PAYMENT_STATUSES);
export const fulfillmentType = pgEnum("fulfillment_type", FULFILLMENT_TYPES);
export const fulfillmentStatus = pgEnum("fulfillment_status", FULFILLMENT_STATUSES);
export const paymentEnvironment = pgEnum("payment_environment", ["production", "test", "unconfigured"]);
export const identityProvider = pgEnum("identity_provider", ["email", "whatsapp", "google", "facebook"]);
export const staffStatus = pgEnum("staff_status", ["active", "suspended", "temp_password"]);
export const fittingStatus = pgEnum("fitting_status", ["requested", "pending", "confirmed", "done", "no_show", "cancelled"]);
export const auditResult = pgEnum("audit_result", ["success", "warning", "blocked", "failure"]);
export const refundStatus = pgEnum("refund_status", ["requested", "approved", "rejected"]);
export const payoutStatus = pgEnum("payout_status", ["pending", "paid"]);
export const tileSize = pgEnum("tile_size", ["large", "tall", "normal"]);

// ══ Stores / Lojas ═════════════════════════════════════════════════════
// EN: Glória Mall — Loja 02 (Eterna & Beyond Time) and Loja 22 (Eterna Bridal).

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // "02", "22"
  name: text("name").notNull(),
  location: text("location").notNull(),
  phone: text("phone").notNull(),
  hours: jsonb("hours").$type<Localized>(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

// ══ Catalog / Catálogo ═════════════════════════════════════════════════

/**
 * EN: One taxonomy tree. `kind` says what a node is: a menu department (Noivas, Ocasiões…), an occasion
 *     (Convidada, Gala…), a garment type (Vestidos longos…) or a collection (Beyond Time, Eterna Privée…).
 * PT: Uma só árvore. `kind` diz o que é: departamento do menu, ocasião, tipo de peça ou colecção.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    kind: categoryKind("kind").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    name: jsonb("name").$type<Localized>().notNull(), // "Vestidos longos"
    singular: jsonb("singular").$type<Localized>(), // EN: for types: "Vestido longo". PT: para tipos.
    description: jsonb("description").$type<Localized>(),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(), // EN: lower-case code. PT: código em minúsculas.
    code: text("code").notNull().unique(), // e.g. "8G1L7"
    name: jsonb("name").$type<Localized>().notNull(), // e.g. "Vestido midi off-white com mangas de penas"
    description: jsonb("description").$type<Localized>().notNull(),
    composition: jsonb("composition").$type<Localized>(), // EN: fabric and care. PT: composição e cuidados.
    price: integer("price").notNull(), // MT
    salePrice: integer("sale_price"),
    colors: jsonb("colors").$type<ProductColor[]>().notNull().default([]),
    typeId: uuid("type_id").references(() => categories.id, { onDelete: "set null" }), // "Vestido midi"
    collectionId: uuid("collection_id").references(() => categories.id, { onDelete: "set null" }), // "Beyond Time"
    status: productStatus("status").notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }), // EN: for "scheduled". PT: para "agendado".
    isNew: boolean("is_new").notNull().default(false), // EN: "Novo" badge. PT: selo "Novo".
    seoTitle: text("seo_title"),
    sourceId: text("source_id").unique(), // EN: import origin. PT: origem da importação.
    ...timestamps,
  },
  (t) => [index("products_status_idx").on(t.status)],
);

/** EN: Occasions (and any extra category) a product appears in. PT: Ocasiões (e outras categorias) do produto. */
export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index("product_categories_category_idx").on(t.categoryId)],
);

/** EN: Size + colour + store, with its own stock. PT: Tamanho + cor + loja, com stock próprio. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    color: text("color"), // EN: key into products.colors. PT: chave em products.colors.
    size: text("size").notNull(), // e.g. "6US/38EUR/S"
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    stock: integer("stock").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    color: text("color"),
    alt: jsonb("alt").$type<Localized>(),
    position: integer("position").notNull().default(0), // EN: 0 = main photo. PT: 0 = fotografia principal.
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

// ══ Site content / Conteúdo do site ════════════════════════════════════

/**
 * EN: Editable sections of each page (Gestão · 8 Conteúdo do site): order, visibility and fields.
 *     `data` holds the section fields; texts inside are { pt, en }.
 * PT: Secções editáveis de cada página: ordem, visibilidade e campos. `data` guarda os campos.
 */
export const contentSections = pgTable(
  "content_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    page: text("page").notNull(), // "home", "noivas", …
    key: text("key").notNull(), // "announcement", "hero", "manifesto", …
    position: integer("position").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("content_sections_page_key_idx").on(t.page, t.key)],
);

/** EN: "Ocasiões especiais" mosaic on the home page (Gestão · 9). PT: Mosaico de ocasiões do Início. */
export const occasionTiles = pgTable("occasion_tiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").$type<Localized>().notNull(),
  phrase: jsonb("phrase").$type<Localized>().notNull(),
  imageUrl: text("image_url").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  size: tileSize("size").notNull().default("normal"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  locale: text("locale").$type<Locale>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ══ Customers / Clientes (fase 2) ══════════════════════════════════════

/** EN: One person = one customer, with several ways to sign in. PT: Uma pessoa = um cliente, com várias formas de entrar. */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  phone: text("phone").unique(), // EN: 9 digits (WhatsApp). PT: 9 dígitos (WhatsApp).
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  locale: text("locale").$type<Locale>().notNull().default("pt"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // EN: Demo rows (npm run db:demo) — removed with npm run db:demo -- --clear. PT: Dados de demonstração.
  isDemo: boolean("is_demo").notNull().default(false),
  ...timestamps,
});

export const customerIdentities = pgTable(
  "customer_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    provider: identityProvider("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(), // EN: e-mail, phone or OAuth id. PT: e-mail, número ou id OAuth.
    label: text("label"), // e.g. "ana@gmail.com"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("customer_identities_provider_idx").on(t.provider, t.providerUserId)],
);

export const favorites = pgTable(
  "favorites",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.productId] })],
);

// ══ Staff, roles, audit / Equipa, papéis, auditoria (fase 3) ═══════════

/** EN: The 5 base roles: super, admin, gestor, atendedor, entregador. PT: Os 5 papéis base. */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: jsonb("name").$type<Localized>().notNull(),
  level: integer("level").notNull(), // EN: higher manages lower. PT: o maior gere o menor.
  isBase: boolean("is_base").notNull().default(true),
});

/**
 * EN: Access matrix (Gestão · A2). `access`: T total, L own stores, V view only, P own only,
 *     Pd ask approval, E delivery data only, — none.
 * PT: Matriz de acesso. `access`: T total, L só as suas lojas, V só ver, P só as próprias,
 *     Pd pedir aprovação, E só dados da entrega, — sem acesso.
 */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    area: text("area").notNull(),
    access: text("access").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.area] })],
);

export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  status: staffStatus("status").notNull().default("temp_password"),
  passwordHash: text("password_hash"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // EN: Driver fields. PT: Dados do entregador.
  photoUrl: text("photo_url"),
  vehicleType: text("vehicle_type"), // "Mota", "Carro", "Bicicleta"
  vehiclePlate: text("vehicle_plate"),
  commissionPct: integer("commission_pct"), // EN: null = general value. PT: null = valor geral.
  createdById: uuid("created_by_id").references((): AnyPgColumn => staffUsers.id, { onDelete: "set null" }),
  isDemo: boolean("is_demo").notNull().default(false),
  ...timestamps,
});

export const staffUserStores = pgTable(
  "staff_user_stores",
  {
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffUserId, t.storeId] })],
);

/** EN: Sessions for customers and staff (token stored hashed). PT: Sessões de clientes e equipa (token com hash). */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: text("subject_type").$type<"customer" | "staff">().notNull(),
    subjectId: uuid("subject_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_subject_idx").on(t.subjectType, t.subjectId)],
);

/** EN: One-time codes/links: WhatsApp sign-up, password reset (30 min, single use). PT: Códigos de uso único. */
export const oneTimeCodes = pgTable("one_time_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").$type<"customer" | "staff">().notNull(),
  subjectId: uuid("subject_id"),
  purpose: text("purpose").$type<"whatsapp_signup" | "password_reset" | "email_verify">().notNull(),
  channel: text("channel").$type<"whatsapp" | "email">().notNull(),
  target: text("target").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** EN: Append-only audit log (Gestão · A4). Never updated or deleted. PT: Registo só de acrescentar. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    actorType: text("actor_type").$type<"staff" | "customer" | "system">().notNull(),
    actorId: uuid("actor_id"),
    actorName: text("actor_name").notNull(), // EN: snapshot. PT: cópia.
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    detail: text("detail"),
    origin: text("origin"), // e.g. "Computador · 197.xxx"
    result: auditResult("result").notNull().default("success"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("audit_logs_at_idx").on(t.at)],
);

// ══ Orders / Encomendas ════════════════════════════════════════════════

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(), // "ET-2026-0148"
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    locale: text("locale").$type<Locale>().notNull(),
    contact: jsonb("contact").$type<Customer>().notNull(),
    // EN: Totals in MT, always computed on the server. PT: Totais em MT, sempre calculados no servidor.
    subtotal: integer("subtotal").notNull(),
    discountCode: text("discount_code"),
    discount: integer("discount").notNull().default(0),
    shippingFee: integer("shipping_fee").notNull().default(0),
    total: integer("total").notNull(),
    // EN: Payment. PT: Pagamento.
    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    paymentReference: text("payment_reference").unique(),
    paymentResponseCode: text("payment_response_code"), // e.g. "INS-0"
    msisdn: text("msisdn"),
    transferProofUrl: text("transfer_proof_url"),
    cashChangeFor: text("cash_change_for"),
    idempotencyKey: text("idempotency_key").unique(),
    paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),
    // EN: Fulfilment. PT: Entrega ou levantamento.
    fulfillmentType: fulfillmentType("fulfillment_type").notNull(),
    fulfillmentStatus: fulfillmentStatus("fulfillment_status").notNull().default("pending"),
    pickupStoreId: uuid("pickup_store_id").references(() => stores.id, { onDelete: "set null" }),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id, { onDelete: "set null" }),
    deliveryCity: text("delivery_city"),
    deliveryNeighbourhood: text("delivery_neighbourhood"),
    deliveryAddress: text("delivery_address"),
    deliveryReference: text("delivery_reference"),
    deliveryLat: doublePrecision("delivery_lat"),
    deliveryLng: doublePrecision("delivery_lng"),
    deliveryCode: text("delivery_code"), // EN: 4 digits for the driver. PT: 4 dígitos para o entregador.
    driverId: uuid("driver_id").references(() => staffUsers.id, { onDelete: "set null" }),
    internalNotes: text("internal_notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("orders_payment_status_idx").on(t.paymentStatus),
    index("orders_customer_idx").on(t.customerId),
    index("orders_driver_idx").on(t.driverId),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    size: text("size").notNull(),
    imageUrl: text("image_url"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId)],
);

/** EN: Order timeline (Gestão · 3 "Cronologia"). PT: Cronologia da encomenda. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    type: text("type").notNull(), // "created", "payment_requested", "paid", "ready", "collected", "assigned"…
    detail: text("detail"),
    actorName: text("actor_name"),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  status: refundStatus("status").notNull().default("requested"),
  requestedById: uuid("requested_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
  approvedById: uuid("approved_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
  ...timestamps,
});

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  kind: text("kind").$type<"percent" | "fixed">().notNull(),
  value: integer("value").notNull(),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  ...timestamps,
});

// ══ Payments & notices / Pagamentos e avisos (Gestão · 10) ═════════════

export const paymentMethodSettings = pgTable("payment_method_settings", {
  method: paymentMethod("method").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  environment: paymentEnvironment("environment").notNull().default("unconfigured"),
  note: text("note"),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationRecipients = pgTable("notification_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffUserId: uuid("staff_user_id")
    .notNull()
    .references(() => staffUsers.id, { onDelete: "cascade" }),
  panel: boolean("panel").notNull().default(true),
  email: boolean("email").notNull().default(false),
  whatsapp: boolean("whatsapp").notNull().default(false),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }), // EN: null = all. PT: null = todas.
});

/** EN: Key/value settings (delivery pricing mode, commission %, notification events…). PT: Definições chave/valor. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedById: uuid("updated_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
});

// ══ Delivery / Entregas (fase 5) ═══════════════════════════════════════

export const deliveryZones = pgTable("delivery_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Baixa, Polana, Sommerschield"
  neighbourhoods: jsonb("neighbourhoods").$type<string[]>().notNull().default([]),
  fee: integer("fee"), // EN: null = to be set. PT: null = por definir.
  eta: jsonb("eta").$type<Localized>().notNull(), // "30–45 min"
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** EN: Live driver position while "in transit". PT: Posição do entregador enquanto "em trânsito". */
export const driverLocations = pgTable(
  "driver_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("driver_locations_order_idx").on(t.orderId, t.at)],
);

export const driverPayouts = pgTable("driver_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id")
    .notNull()
    .references(() => staffUsers.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  deliveries: integer("deliveries").notNull(),
  deliveryValue: integer("delivery_value").notNull(),
  commissionPct: integer("commission_pct").notNull(),
  amount: integer("amount").notNull(),
  status: payoutStatus("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidById: uuid("paid_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
});

// ══ Fittings / Provas (Gestão · 5) ═════════════════════════════════════

/**
 * EN: Fittings. Flow: the customer asks on the site (requested) and talks to the store on WhatsApp;
 *     the team accepts (confirmed) or proposes another time (pending), then marks done / no_show.
 *     `code` (PR-0042) goes in the WhatsApp message; `publicToken` opens the public request page.
 * PT: Provas. A cliente pede no site (requested) e fala com a loja no WhatsApp; a equipa aceita (confirmed)
 *     ou propõe outra hora (pending) e no fim marca realizada / faltou.
 */
export const fittings = pgTable(
  "fittings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // "PR-0042"
    publicToken: text("public_token").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    locale: text("locale").$type<Locale>().notNull().default("pt"),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    kind: text("kind").notNull(), // EN: key from FITTING_KINDS. PT: chave de FITTING_KINDS.
    status: fittingStatus("status").notNull().default("requested"),
    source: text("source").$type<"site" | "store" | "whatsapp">().notNull().default("site"),
    notes: text("notes"), // EN: from the customer. PT: da cliente.
    internalNotes: text("internal_notes"), // EN: team only. PT: só a equipa.
    productIds: jsonb("product_ids").$type<string[]>().notNull().default([]),
    confirmedById: uuid("confirmed_by_id").references(() => staffUsers.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("fittings_starts_idx").on(t.startsAt), index("fittings_customer_idx").on(t.customerId)],
);

// ══ Private files / Ficheiros privados ═════════════════════════════════

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

/**
 * EN: Transfer proofs and other private uploads (≤ 5 MB), kept in the database so they are never public and work
 *     the same locally and online. Referenced as "file:<id>".
 * PT: Comprovativos e outros ficheiros privados (≤ 5 MB), guardados na base de dados para nunca serem públicos e
 *     funcionarem igual em local e online. Referidos como "file:<id>".
 */
export const privateFiles = pgTable("private_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ══ Relations (for db.query.*) / Relações ══════════════════════════════

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "tree" }),
  children: many(categories, { relationName: "tree" }),
  products: many(productCategories),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  type: one(categories, { fields: [products.typeId], references: [categories.id], relationName: "productType" }),
  collection: one(categories, {
    fields: [products.collectionId],
    references: [categories.id],
    relationName: "productCollection",
  }),
  categories: many(productCategories),
  variants: many(productVariants),
  images: many(productImages),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  store: one(stores, { fields: [productVariants.storeId], references: [stores.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const occasionTilesRelations = relations(occasionTiles, ({ one }) => ({
  category: one(categories, { fields: [occasionTiles.categoryId], references: [categories.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  lines: many(orderLines),
  events: many(orderEvents),
  pickupStore: one(stores, { fields: [orders.pickupStoreId], references: [stores.id] }),
  deliveryZone: one(deliveryZones, { fields: [orders.deliveryZoneId], references: [deliveryZones.id] }),
  driver: one(staffUsers, { fields: [orders.driverId], references: [staffUsers.id] }),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));

export const staffUsersRelations = relations(staffUsers, ({ one, many }) => ({
  role: one(roles, { fields: [staffUsers.roleId], references: [roles.id] }),
  stores: many(staffUserStores),
}));

export const staffUserStoresRelations = relations(staffUserStores, ({ one }) => ({
  staffUser: one(staffUsers, { fields: [staffUserStores.staffUserId], references: [staffUsers.id] }),
  store: one(stores, { fields: [staffUserStores.storeId], references: [stores.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  identities: many(customerIdentities),
  favorites: many(favorites),
}));

export const customerIdentitiesRelations = relations(customerIdentities, ({ one }) => ({
  customer: one(customers, { fields: [customerIdentities.customerId], references: [customers.id] }),
}));

export const fittingsRelations = relations(fittings, ({ one }) => ({
  store: one(stores, { fields: [fittings.storeId], references: [stores.id] }),
  customer: one(customers, { fields: [fittings.customerId], references: [customers.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  customer: one(customers, { fields: [favorites.customerId], references: [customers.id] }),
  product: one(products, { fields: [favorites.productId], references: [products.id] }),
}));
