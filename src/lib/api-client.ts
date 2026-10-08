import type {
  ApiError,
  ApiErrorCode,
  ApiSuccess,
  CategoryDTO,
  CheckoutOptionsDTO,
  CustomerDTO,
  FittingKind,
  FittingPublicDTO,
  FittingSlotsDTO,
  IdentityProvider,
  Locale,
  MyOrderDTO,
  OrderStatusDTO,
  ProductDTO,
} from "@/types";
import type { FittingRequestInput } from "./auth-schemas";
import type { CreateOrderInput } from "./validation";

/**
 * EN: Typed client for the Eterna API (/api/v1). The website uses it today;
 *     the mobile app will use the same one, passing the server's full URL as baseUrl.
 * PT: Cliente tipado da API Eterna (/api/v1). O site usa-o hoje;
 *     a app móvel vai usar o mesmo, passando o endereço completo do servidor em baseUrl.
 */

export class ApiClientError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ProductQuery {
  locale: Locale;
  slugs?: string[];
  category?: string;
  isNew?: boolean;
  q?: string;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export function createApiClient(baseUrl = "") {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      const isForm = init?.body instanceof FormData;
      res = await fetch(`${baseUrl}/api/v1${path}`, {
        ...init,
        headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
      });
    } catch {
      throw new ApiClientError("INTERNAL_ERROR", "Network error", 0);
    }
    const body = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiError | null;
    if (!res.ok || !body || "error" in body) {
      const error = body && "error" in body ? body.error : null;
      throw new ApiClientError(error?.code ?? "INTERNAL_ERROR", error?.message ?? res.statusText, res.status, error?.details);
    }
    return body.data;
  }

  return {
    listCategories(locale: Locale) {
      return request<CategoryDTO[]>(`/categories?locale=${locale}`);
    },
    listProducts(params: ProductQuery) {
      const query = new URLSearchParams({ locale: params.locale });
      if (params.slugs?.length) query.set("slugs", params.slugs.join(","));
      if (params.category) query.set("category", params.category);
      if (params.isNew !== undefined) query.set("new", String(params.isNew));
      if (params.q) query.set("q", params.q);
      return request<ProductDTO[]>(`/products?${query}`);
    },
    getProduct(slug: string, locale: Locale) {
      return request<ProductDTO>(`/products/${encodeURIComponent(slug)}?locale=${locale}`);
    },
    checkoutOptions(locale: Locale) {
      return request<CheckoutOptionsDTO>(`/checkout/options?locale=${locale}`);
    },
    createOrder(input: CreateOrderInput) {
      return request<OrderStatusDTO>("/orders", { method: "POST", body: JSON.stringify(input) });
    },
    getOrder(id: string) {
      return request<OrderStatusDTO>(`/orders/${encodeURIComponent(id)}`);
    },
    cancelOrderPayment(id: string) {
      return request<OrderStatusDTO>(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" });
    },
    uploadTransferProof(id: string, file: File) {
      const form = new FormData();
      form.set("file", file);
      return request<OrderStatusDTO>(`/orders/${encodeURIComponent(id)}/proof`, { method: "POST", body: form });
    },
    subscribeNewsletter(email: string, locale: Locale) {
      return request<{ subscribed: boolean }>("/newsletter", { method: "POST", body: JSON.stringify({ email, locale }) });
    },

    // EN: Customer accounts. PT: Contas de cliente.
    register(input: { name: string; email: string; password: string; locale: Locale }) {
      return request<CustomerDTO>("/auth/customer/register", post(input));
    },
    login(identifier: string, password: string) {
      return request<CustomerDTO>("/auth/customer/login", post({ identifier, password }));
    },
    logout() {
      return request<{ signedOut: boolean }>("/auth/customer/logout", post({}));
    },
    forgotPassword(identifier: string) {
      return request<{ sent: boolean; devCode?: string }>("/auth/customer/forgot", post({ identifier }));
    },
    resetPassword(input: { identifier: string; code: string; password: string }) {
      return request<CustomerDTO>("/auth/customer/reset", post(input));
    },
    whatsappCode(phone: string) {
      return request<{ sent: boolean; devCode?: string }>("/auth/customer/whatsapp/code", post({ phone }));
    },
    whatsappVerify(phone: string, code: string) {
      return request<{ verified: boolean; existingName: string | null }>("/auth/customer/whatsapp/verify", post({ phone, code }));
    },
    whatsappComplete(input: { phone: string; code: string; name: string; password: string; locale: Locale }) {
      return request<CustomerDTO>("/auth/customer/whatsapp/complete", post(input));
    },
    me() {
      return request<CustomerDTO | null>("/me");
    },
    updateMe(input: { name: string }) {
      return request<CustomerDTO>("/me", { method: "PATCH", body: JSON.stringify(input) });
    },
    changePassword(current: string, next: string) {
      return request<{ changed: boolean }>("/me/password", post({ current, next }));
    },
    unlinkIdentity(provider: IdentityProvider) {
      return request<CustomerDTO>(`/me/identities?provider=${provider}`, { method: "DELETE" });
    },
    myOrders() {
      return request<MyOrderDTO[]>("/me/orders");
    },
    myFittings(locale: Locale) {
      return request<FittingPublicDTO[]>(`/me/fittings?locale=${locale}`);
    },
    favorites() {
      return request<string[]>("/me/favorites");
    },
    addFavorites(slugs: string[]) {
      return request<string[]>("/me/favorites", post({ slugs }));
    },
    removeFavorite(slug: string) {
      return request<string[]>(`/me/favorites?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    },

    // EN: Fittings. PT: Provas.
    fittingSlots(store: string, date: string, kind: FittingKind) {
      return request<FittingSlotsDTO>(`/fittings/slots?store=${store}&date=${date}&kind=${kind}`);
    },
    requestFitting(input: FittingRequestInput) {
      return request<FittingPublicDTO>("/fittings", post(input));
    },
    getFitting(token: string, locale: Locale) {
      return request<FittingPublicDTO>(`/fittings/${encodeURIComponent(token)}?locale=${locale}`);
    },
  };
}

export const api = createApiClient();
