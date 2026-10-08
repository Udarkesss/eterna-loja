# API v1

Base URL: `/api/v1` · JSON · Used by the website and the future mobile app.
Usada pelo site e pela futura app móvel.

**Envelope:** success → `{ "data": ... }` · error → `{ "error": { "code", "message", "details?" } }`

Error codes / Códigos de erro (stable — clients translate them / estáveis — os clientes traduzem-nos):
`VALIDATION_ERROR` 400 · `METHOD_UNAVAILABLE` 400 · `UNAUTHORIZED` 401 · `NOT_FOUND` 404 · `OUT_OF_STOCK` 409 ·
`FORBIDDEN` 403 · `CONFLICT` 409 · `SLOT_TAKEN` 409 · `LOCKED` 423 · `PAYMENT_ERROR` 501/502 · `INTERNAL_ERROR` 500

Types: `src/types/index.ts` · Typed client / Cliente tipado: `src/lib/api-client.ts`

---

## Catalog / Catálogo

| Method | Path | What / O quê |
| ------ | ---- | ------------ |
| GET | `/health` | `{ status: "ok", version: "v1" }` |
| GET | `/categories?locale=pt` | Category tree / Árvore de categorias (`CategoryDTO[]`) |
| GET | `/products?locale=pt&…` | Visible products (`ProductDTO[]`). Filters: `category` (includes children), `type`, `size`, `color` (blue, off_white, beige, fuchsia, black, red, green, gold), `priceMin`, `priceMax`, `new`, `q`, `sort` (`recommended`, `price_asc`, `price_desc`), `slugs` — lists comma-separated |
| GET | `/products/:slug?locale=pt` | One product. Slug = code in lower case (`8G1L7` also works) |

`ProductDTO`: `code`, `name`, `description`, `composition`, `price`, `salePrice`, `isNew`, `type`, `collection`,
`occasions[]`, `colors[]` (`key`, `name`, `hex`, `family`), `images[]` (`url`, `alt`, `color`),
`variants[]` (`id`, `sku`, `color`, `size` e.g. `6US/38EUR/S`, `stock`, `store`), `stock`.

## Checkout

| Method | Path | What / O quê |
| ------ | ---- | ------------ |
| GET | `/checkout/options?locale=pt` | Enabled payment methods, pickup stores, delivery zones |
| POST | `/orders` | Create order + reserve stock + start payment (`CreateOrderInput`) → `201 OrderStatusDTO` |
| GET | `/orders/:id` | `OrderStatusDTO`. While pending, also asks the provider; after the time limit → `expired` |
| POST | `/orders/:id/cancel` | "Cancelar e mudar de método": releases the reserved pieces |
| POST | `/orders/:id/proof` | Bank transfer proof — `multipart/form-data`, field `file`, photo or PDF ≤ 5 MB |
| POST | `/newsletter` | `{ email, locale }` — footer "Receba as novidades" |

```json
POST /api/v1/orders
{
  "locale": "pt",
  "lines": [{ "slug": "8g1l7", "variantId": "uuid", "quantity": 1 }],
  "contact": { "name": "Ana", "email": "" },
  "fulfillment": { "type": "pickup", "storeCode": "02" },
  "payment": { "method": "emola", "msisdn": "86 234 5678" },
  "discountCode": "OPTIONAL"
}
```

- `fulfillment`: `{ type: "pickup", storeCode }` or `{ type: "delivery", city, neighbourhood, address, lat?, lng? }`
- `payment.method`: `card` · `mpesa` · `emola` · `mkesh` (with `msisdn`) · `transfer` · `cod` (`changeFor?`, delivery only)
- Mobile numbers / Números: M-Pesa 84/85 · e-Mola 86/87 · mKesh 82/83. Card details are **never** sent to this API.

`OrderStatusDTO`: `id`, `number` (`ET-2026-0001`), `total`, `paymentMethod`, `paymentStatus`
(`pending` → `paid` | `failed` | `expired` | `refunded`), `msisdnMasked` (`86 ••• 78`), `paymentExpiresAt`,
`fulfillmentType`, `fulfillmentStatus`, `pickupStore`.

## Customer accounts / Contas de cliente

Session: httpOnly cookie `eterna_session` (website) or `Authorization: Bearer <token>` (mobile app).
Sessão: cookie `eterna_session` (site) ou `Authorization: Bearer <token>` (app).

| Method | Path | What / O quê |
| ------ | ---- | ------------ |
| POST | `/auth/customer/register` | `{ name, email, password, locale }` → `CustomerDTO` (409 `ACCOUNT_EXISTS`) |
| POST | `/auth/customer/whatsapp/code` | `{ phone }` → sends a 6-digit code (`devCode` in demo mode) |
| POST | `/auth/customer/whatsapp/verify` | `{ phone, code }` → `{ verified, existingName }` |
| POST | `/auth/customer/whatsapp/complete` | `{ phone, code, name, password, locale }` → links to an existing account with that number |
| POST | `/auth/customer/login` | `{ identifier, password }` (e-mail or WhatsApp number) |
| POST | `/auth/customer/logout` | |
| POST | `/auth/customer/forgot` · `/reset` | Code by e-mail/WhatsApp (neutral answer) · `{ identifier, code, password }` |
| GET · PATCH | `/me` | Current customer (or `null`) · `{ name }` |
| GET · POST · DELETE | `/me/favorites` | slugs · `{ slugs }` (merge) · `?slug=` |
| DELETE | `/me/identities?provider=` | Unlink a sign-in method (at least one stays) |
| POST | `/me/password` | `{ current, next }` |
| GET | `/me/orders` · `/me/fittings?locale=` | `MyOrderDTO[]` · `FittingPublicDTO[]` |

## Fittings / Provas

| Method | Path | What / O quê |
| ------ | ---- | ------------ |
| GET | `/fittings/slots?store=22&date=2026-10-02&kind=bride_white` | Free times (Maputo) |
| POST | `/fittings` | `{ locale, name, phone, kind, storeCode, date, time, productSlugs?, notes? }` → `FittingPublicDTO` with `whatsappUrl` (409 `SLOT_TAKEN`) |
| GET | `/fittings/:token?locale=` | Public request page data (no personal data) |

The back-office (/gestao) uses server actions that call the same services in `src/server/` (permission-checked).
A gestão (/gestao) usa acções de servidor que chamam os mesmos serviços em `src/server/` (com permissões).

## Webhooks (not versioned / sem versão)

`POST /api/webhooks/{card|mpesa|emola|mkesh}` · header `x-webhook-secret: <WEBHOOK_SECRET>` ·
body (provisional) `{ "reference": "…", "status": "paid" | "failed", "responseCode": "INS-0" }`.
TODO (phase 6): each provider's real format and signature check.
