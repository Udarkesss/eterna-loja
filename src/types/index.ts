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
  imageUrl: string | null; // EN: type circle / collection cover. PT: círculo do tipo / capa da colecção.
  details: { edition: string | null; season: string | null; lines: string[]; active: boolean } | null;
  /** EN: Order and filters (Gestão · Categorias e filtros). PT: Ordem e filtros. */
  listing: CategoryListing | null;
  parent: CategorySummary | null;
  children: CategoryDTO[];
}

/**
 * EN: Details of a collection (design V3, "Gestão → Colecções → Editar colecção"): edition label, season, the lines
 *     shown as tabs (department slugs) and the home message.
 * PT: Detalhes de uma colecção (V3): edição, época, as linhas mostradas em separadores e a mensagem do Início.
 */
export interface CategoryDetails {
  edition?: Localized; // "Colecção II · 2026"
  season?: Localized; // "Agosto a dezembro · na Loja 2 e no site"
  lines?: string[]; // ["roupa-de-festa", "roupa-executiva"]
  active?: boolean; // EN: the active seasonal collection. PT: a colecção sazonal activa.
  /** EN: Bridal accessory types: where they appear (Gestão · Tipos de peça). PT: Acessórios de noiva: onde aparecem. */
  showIn?: "noivas" | "acessorios" | "both";
  // EN: Gestão · Colecções (design V3). PT: Gestão · Colecções (V3).
  collectionType?: "seasonal" | "special";
  number?: string; // "II"
  year?: number;
  startsOn?: string; // EN: planned, yyyy-mm-dd. PT: planeado.
  endsOn?: string;
  status?: "draft" | "active" | "archived";
  history?: boolean; // EN: old collection, archive only (not on the site). PT: colecção antiga, só arquivo.
  message?: Localized; // EN: home "entrada" text while active. PT: texto da entrada enquanto activa.
  buttonText?: Localized;
  buttonLink?: string; // EN: "auto" = this collection. PT: "auto" = esta colecção.
  // EN: Gestão · Categorias e filtros (design V3). PT: Gestão · Categorias e filtros (V3).
  listing?: CategoryListing;
}

/** EN: Order and filters of a category page (Gestão · Categorias e filtros). PT: Ordem e filtros de uma categoria. */
export interface CategoryListing {
  sort?: "featured" | "newest" | "bestsellers" | "price_asc" | "price_desc" | "name" | "size" | "type";
  featured?: string[]; // EN: product ids, in order. PT: ids das peças, por ordem.
  filters?: { size?: boolean; color?: boolean; price?: boolean; types?: boolean; reserved?: boolean };
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

/** EN: Suggestions while typing in the search (design V3). PT: Sugestões enquanto escreve na pesquisa (V3). */
export interface SearchSuggestionsDTO {
  total: number; // EN: pieces found. PT: peças encontradas.
  places: CategorySummary[]; // EN: collections, occasions, departments. PT: colecções, ocasiões, departamentos.
  types: (CategorySummary & { count: number })[];
  products: { slug: string; code: string; type: string | null; price: number; salePrice: number | null; image: string | null }[];
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
  later?: boolean; // EN: kept for later, not bought now (design V3). PT: guardada para depois, não se compra agora.
}

// ── Payments / Pagamentos ────────────────────────────────────────────
/** EN: The six methods in the design, in checkout order. PT: Os seis métodos do design, pela ordem do checkout. */
export const PAYMENT_METHODS = ["card", "paypal", "mpesa", "emola", "mkesh", "transfer", "cod", "test"] as const;
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
  deliveryCode: string | null; // EN: collection code (pickup) or reception code (delivery). PT: código de levantamento ou de recepção.
  /** EN: Signed-in customer: points of this order and of the year (paid orders). PT: Pontos desta encomenda e do ano. */
  points: { earned: number; year: number; level: string } | null;
  /** EN: First name, for "Obrigada, Ana." PT: Primeiro nome. */
  firstName: string;
  createdAt: string;
  /** EN: Set when this is a reservation deposit. PT: Preenchido quando é o sinal de uma reserva. */
  reservationToken: string | null;
}

/** EN: A reservation for the customer (confirmation and account). PT: Uma reserva para a cliente (confirmação e conta). */
export interface ReservationDTO {
  number: string; // "RS-2026-0012"
  token: string;
  code: string;
  name: string;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
  storeCode: string | null;
  price: number;
  discount: number;
  total: number;
  deposit: number;
  rest: number;
  status: "pending" | "active" | "completed" | "expired" | "cancelled";
  days: number;
  expiresAt: string | null;
  daysLeft: number;
  ending: boolean;
  moreTimeAsked: boolean;
  canAskMore: boolean;
  orderId: string | null;
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
  delivery: boolean; // EN: home delivery switched on (delivery module). PT: entrega ao domicílio ligada.
  pickupStores: StoreDTO[];
  zones: DeliveryZoneDTO[];
  /** EN: How the delivery fee is calculated (Gestão · Entregas). PT: Como se calcula o preço da entrega. */
  pricing: { mode: "fixed" | "zone" | "distance"; fixedFee: number | null; baseFee: number | null; perKm: number | null; maxFee: number | null };
  /** EN: Signed-in customer's level and discount (pieces not on sale). PT: Nível e desconto da cliente com sessão. */
  level: { key: string; name: string; pct: number } | null;
  /** EN: Level discount shown without (plain) or with its name (Gestão · Descontos). PT: Desconto sem ou com o nome do nível. */
  levelDisplay: "plain" | "named";
  /** EN: Vouchers switched on. PT: Vouchers ligados. */
  vouchers: boolean;
  /** EN: The signed-in customer's vouchers she can still use ("Na sua conta"). PT: Vouchers da cliente por usar. */
  myVouchers: CustomerVoucherDTO[];
}

/** EN: A voucher in "Os meus vouchers". PT: Um voucher em "Os meus vouchers". */
export interface CustomerVoucherDTO {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minPurchase: number | null;
  endsAt: string | null;
  state: "unused" | "used";
  usedAt: string | null;
  usedOrder: string | null;
}

/** EN: Answer of POST /checkout/voucher. PT: Resposta de POST /checkout/voucher. */
export type VoucherCheckDTO =
  | { ok: true; code: string; amount: number; stacks: boolean; kind: "percent" | "fixed"; value: number }
  | { ok: false; error: "NOT_FOUND" | "OFF" | "EXPIRED" | "NOT_YET" | "USED" | "NOT_YOURS" | "MIN_PURCHASE" | "SIGN_IN"; min: number | null };

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

/** EN: A Bridal fitting booking with its payment (design V3). PT: Uma marcação da Bridal com o pagamento (V3). */
export interface BridalBookingDTO extends FittingPublicDTO {
  paymentStatus: "none" | "pending" | "paid" | "failed";
  amount: number;
  packageKey: string | null;
  extraDresses: number;
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
