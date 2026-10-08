/**
 * EN: Shared domain types, modelled on the design canvas "Eterna — Loja Online de Luxo".
 *     Used by the website, the API and (later) the mobile app — no React/Next.js/database imports here.
 * PT: Tipos de domínio partilhados, feitos a partir do canvas "Eterna — Loja Online de Luxo".
 *     Usados pelo site, pela API e (mais tarde) pela app móvel — sem imports de React/Next.js/base de dados.
 */

// ── Languages / Idiomas ──────────────────────────────────────────────
export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** EN: A value in every supported language. PT: Um valor em cada idioma suportado. */
export type Localized<T = string> = Record<Locale, T>;

// ── Catalog / Catálogo ───────────────────────────────────────────────
/** EN: department = menu item; occasion = Convidada…; type = Vestido longo…; collection = Beyond Time… */
export const CATEGORY_KINDS = ["department", "occasion", "type", "collection"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const PRODUCT_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface CategorySummary {
  slug: string;
  name: string;
}

export interface CategoryDTO extends CategorySummary {
  kind: CategoryKind;
  description: string | null;
  parent: CategorySummary | null;
  children: CategoryDTO[];
}

/** EN: A colour as stored (all languages). PT: Uma cor como está guardada (todos os idiomas). */
export interface ProductColor {
  key: string; // e.g. "peacock_blue"
  name: Localized; // "Azul pavão"
  hex: string | null;
  family: ColorFamily | null; // EN: used by the colour filter. PT: usado pelo filtro de cor.
}

/** EN: The colour filter swatches in the design. PT: As amostras do filtro de cor no design. */
export const COLOR_FAMILIES = ["blue", "off_white", "beige", "fuchsia", "black", "red", "green", "gold"] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export interface ProductColorDTO {
  key: string;
  name: string;
  hex: string | null;
  family: ColorFamily | null;
}

export interface ProductImageDTO {
  url: string;
  alt: string;
  color: string | null;
}

export interface StoreSummary {
  code: string; // "02", "22"
  name: string;
}

/** EN: One buyable size + colour in one store. PT: Um tamanho + cor numa loja. */
export interface ProductVariantDTO {
  id: string;
  sku: string;
  color: string | null;
  size: string; // e.g. "6US/38EUR/S"
  stock: number;
  store: StoreSummary | null;
}

/** EN: A product as the API returns it (one language). PT: Um produto como a API o devolve (um idioma). */
export interface ProductDTO {
  id: string;
  slug: string;
  code: string; // "8G1L7" — shown as the title. PT: mostrado como título.
  name: string; // "Vestido midi off-white com mangas de penas"
  description: string;
  composition: string | null;
  price: number; // MT
  salePrice: number | null;
  isNew: boolean;
  type: CategorySummary | null; // "Vestido midi"
  collection: CategorySummary | null; // "Beyond Time"
  occasions: CategorySummary[]; // "Convidada", "Gala"
  colors: ProductColorDTO[];
  images: ProductImageDTO[];
  variants: ProductVariantDTO[];
  stock: number;
}

// ── Stores & site / Lojas e site ─────────────────────────────────────
export interface StoreDTO extends StoreSummary {
  location: string;
  phone: string;
  hours: string | null;
}

export interface OccasionTileDTO {
  name: string;
  phrase: string;
  imageUrl: string;
  href: string | null; // EN: category slug. PT: slug da categoria.
  size: "large" | "tall" | "normal";
}

// ── Cart / Carrinho ──────────────────────────────────────────────────
export interface CartLine {
  slug: string;
  variantId: string;
  quantity: number;
}

// ── Payments / Pagamentos ────────────────────────────────────────────
/** EN: The six methods in the design, in checkout order. PT: Os seis métodos do design, pela ordem do checkout. */
export const PAYMENT_METHODS = ["card", "mpesa", "emola", "mkesh", "transfer", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** EN: Mobile money: the customer confirms with a PIN on the phone. PT: Dinheiro móvel: confirma com PIN no telemóvel. */
export const MOBILE_METHODS = ["mpesa", "emola", "mkesh"] as const satisfies readonly PaymentMethod[];
export type MobileMethod = (typeof MOBILE_METHODS)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "expired", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ── Fulfilment / Entrega ─────────────────────────────────────────────
export const FULFILLMENT_TYPES = ["pickup", "delivery"] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

/**
 * EN: Pickup: pending → ready → collected. Delivery: pending → assigned → in_transit → delivered → confirmed.
 * PT: Levantamento: pendente → pronta → levantada. Entrega: pendente → atribuída → em trânsito → entregue → confirmada.
 */
export const FULFILLMENT_STATUSES = [
  "pending",
  "ready",
  "collected",
  "assigned",
  "in_transit",
  "delivered",
  "confirmed",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export interface DeliveryZoneDTO {
  id: string;
  name: string;
  neighbourhoods: string[];
  fee: number | null; // EN: null = not set yet. PT: null = ainda por definir.
  eta: string;
}

// ── Orders / Encomendas ──────────────────────────────────────────────
export interface Customer {
  name: string;
  email?: string;
  phone?: string;
}

export interface OrderLine {
  productId: string | null;
  variantId: string | null;
  storeId: string | null;
  slug: string;
  code: string;
  name: string;
  color: string | null;
  size: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
}

/** EN: Public order view returned by the API. PT: Vista pública da encomenda devolvida pela API. */
export interface OrderStatusDTO {
  id: string;
  number: string; // "ET-2026-0148"
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  msisdnMasked: string | null; // "84 ••• 12"
  paymentExpiresAt: string | null;
  fulfillmentType: FulfillmentType;
  fulfillmentStatus: FulfillmentStatus;
  pickupStore: StoreSummary | null;
}

/** EN: One line of "As minhas encomendas". PT: Uma linha de "As minhas encomendas". */
export interface MyOrderDTO {
  id: string;
  number: string;
  createdAt: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentType: FulfillmentType;
  fulfillmentStatus: FulfillmentStatus;
  items: { code: string; size: string; imageUrl: string | null }[];
}

/** EN: What the checkout needs from the server. PT: O que o checkout precisa do servidor. */
export interface CheckoutOptionsDTO {
  methods: PaymentMethod[]; // EN: enabled only. PT: só os activos.
  pickupStores: StoreDTO[];
  zones: DeliveryZoneDTO[];
}

// ── Fittings / Provas ────────────────────────────────────────────────
/**
 * EN: Kinds offered in "Agendar prova". `bridal` ones default to Loja 22 and take longer.
 * PT: Tipos de prova. Os de noiva vão por omissão para a Loja 22 e demoram mais.
 */
export const FITTING_KINDS = [
  "bride_white",
  "bride_privee",
  "bride_second",
  "bridesmaid_mother",
  "engagement_lobolo",
  "gala",
  "guest",
  "graduation",
  "corporate",
  "other",
] as const;
export type FittingKind = (typeof FITTING_KINDS)[number];
export const BRIDAL_FITTING_KINDS: readonly FittingKind[] = ["bride_white", "bride_privee", "bride_second"];

export const FITTING_STATUSES = ["requested", "pending", "confirmed", "done", "no_show", "cancelled"] as const;
export type FittingStatus = (typeof FITTING_STATUSES)[number];

/** EN: Public view of a fitting request (no personal data). PT: Vista pública do pedido (sem dados pessoais). */
export interface FittingPublicDTO {
  code: string; // "PR-0042"
  token: string;
  kind: FittingKind;
  status: FittingStatus;
  startsAt: string;
  durationMinutes: number;
  store: StoreSummary & { location: string };
  products: { slug: string; code: string; name: string; imageUrl: string | null }[];
  whatsappUrl: string; // EN: opens the store chat with the message. PT: abre a conversa da loja.
}

export interface FittingSlotsDTO {
  date: string; // YYYY-MM-DD (Maputo)
  store: string; // "02" | "22"
  times: string[]; // "09:00", "09:30"…
}

// ── Accounts / Contas ────────────────────────────────────────────────
export const IDENTITY_PROVIDERS = ["email", "whatsapp", "google", "facebook"] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export interface CustomerDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string | null; // EN: 9 digits. PT: 9 dígitos.
  identities: { provider: IdentityProvider; label: string | null }[];
  hasPassword: boolean;
}

// ── API contract / Contrato da API ───────────────────────────────────
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "OUT_OF_STOCK"
  | "PAYMENT_ERROR"
  | "METHOD_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "LOCKED"
  | "SLOT_TAKEN"
  | "INTERNAL_ERROR";

/** EN: Every successful response: { data }. PT: Todas as respostas com sucesso: { data }. */
export interface ApiSuccess<T> {
  data: T;
}

/** EN: Every error response: { error }. PT: Todas as respostas de erro: { error }. */
export interface ApiError {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}
