# Architecture / Arquitectura

## 1. Principles / Princípios

1. **API-first.** Every business action goes through `/api/v1` (or the same service functions on the server).
   The website is one client; the mobile app will be another.
   **API primeiro.** Todas as acções de negócio passam por `/api/v1` (ou pelas mesmas funções de serviço no servidor).
   O site é um cliente; a app móvel será outro.
2. **Three layers, one direction.** `app/` + `components/` → `server/` → `data/`. Pure shared code lives in `lib/` + `types/`.
   **Três camadas, um sentido.** `app/` + `components/` → `server/` → `data/`. O código puro partilhado vive em `lib/` + `types/`.
3. **Swap, don't rewrite.** Storage and operators sit behind interfaces (`ProductRepository`, `OrderRepository`,
   `PaymentGateway`). Moving to a database or adding an operator changes one file.
   **Trocar, não reescrever.** Armazenamento e operadoras estão atrás de interfaces. Passar para uma base de dados
   ou juntar uma operadora muda um só ficheiro.
4. **The server decides.** Prices, stock and payment status are always computed on the server.
   **O servidor decide.** Preços, stock e estado do pagamento são sempre calculados no servidor.

## 2. Layers / Camadas

| Folder / Pasta | Runs where / Corre onde     | May import / Pode importar          | Reusable in mobile / Reutilizável na app |
| -------------- | --------------------------- | ----------------------------------- | ---------------------------------------- |
| `types/`       | anywhere / em qualquer lado | nothing / nada                      | yes / sim                                |
| `lib/`         | anywhere / em qualquer lado | `types/`, zod                       | yes / sim                                |
| `i18n/`        | anywhere / em qualquer lado | `types/`                            | dictionaries yes / dicionários sim       |
| `server/`      | server only / só servidor   | `lib/`, `types/`, `data/`           | no (stays in the API) / não              |
| `components/`  | browser + server            | `lib/`, `i18n/`, `types/`           | no (React DOM) / não                     |
| `app/`         | Next.js routes              | everything / tudo                   | no / não                                 |

`server/*` files start with `import "server-only"`: importing them from the browser fails the build.
Os ficheiros de `server/*` começam com `import "server-only"`: importá-los no browser falha a compilação.

## 3. Data / Dados

PostgreSQL through Drizzle ORM (`src/server/db/schema.ts`). Development uses PGlite (embedded PostgreSQL, same SQL).
PostgreSQL com Drizzle ORM. Em desenvolvimento usa-se o PGlite (PostgreSQL embutido, o mesmo SQL).

| Area / Área | Tables / Tabelas | Design screens / Ecrãs do design |
| ----------- | ---------------- | -------------------------------- |
| Stores / Lojas | `stores` | Loja 02 (Eterna & Beyond Time), Loja 22 (Eterna Bridal) |
| Catalog / Catálogo | `categories` (kind: department, occasion, type, collection), `products`, `product_categories`, `product_variants` (size + colour + store + stock), `product_images` | Início, Categoria, Produto, Gestão · 6/7 |
| Content / Conteúdo | `content_sections`, `occasion_tiles`, `newsletter_subscribers` | Início, Gestão · 8/9 |
| Customers / Clientes | `customers`, `customer_identities` (e-mail, WhatsApp, Google, Facebook), `favorites` | Conta · Entrar, Formas de entrar |
| Staff / Equipa | `roles`, `role_permissions`, `staff_users`, `staff_user_stores`, `sessions`, `one_time_codes`, `audit_logs` | Gestão · 0, A1–A5 |
| Orders / Encomendas | `orders`, `order_lines`, `order_events`, `refunds`, `discount_codes` | Checkout, Gestão · 1/2/3 |
| Payments / Pagamentos | `payment_method_settings`, `notification_recipients`, `settings` | Gestão · 10, Integração |
| Delivery / Entregas | `delivery_zones`, `driver_locations`, `driver_payouts` | Gestão · 4, Entregador · 1–3, Acompanhar |
| Fittings / Provas | `fittings` | Gestão · 5 |

**Stock:** reserved in a transaction when the order is created (`UPDATE … WHERE stock >= qty`) and returned if the
payment fails, so two customers can never buy the same last piece.
Reservado numa transacção ao criar a encomenda e devolvido se o pagamento falhar.

Old eterna.co.mz addresses (`/produtos/*`, `/produto/*`, `/noivas`, `/contactos`…) redirect permanently (`next.config.ts`).
Os endereços antigos redireccionam de forma permanente.

## 4. Purchase flow / Fluxo de compra

```
Home → Category/Collection → Product → Cart → Checkout
Checkout: Delivery → Method (M-Pesa | mKesh) → Number → Pay
  └─ POST /api/v1/orders
       ├─ validate (createOrderSchema — same schema as the browser)
       ├─ load prices + stock from the catalog (never from the request)
       ├─ create order (status: pending)
       └─ gateway.charge() → PIN request on the customer's phone
  → /[locale]/order/[id] shows "Payment pending"
  → customer confirms with her PIN
  → operator calls /api/webhooks/<operator> → paid | failed
  → the page polls GET /api/v1/orders/[id] every 4 s
     (while pending, the server also asks the operator — safety net if a webhook is lost)
```

## 5. Languages / Idiomas

- URLs: `/pt/...` and `/en/...`. `middleware.ts` redirects paths without a language (cookie → browser → `pt`).
- Texts: `src/i18n/dictionaries/pt.ts` defines the shape; `en.ts` must match it (TypeScript checks).
- Product data: `Localized` fields (`{ pt, en }`); the API returns one language via `?locale=`.
- Add a language / Juntar um idioma: see [CONTRIBUTING.md](../CONTRIBUTING.md).

## 6. Path to the mobile app / Caminho para a app móvel

1. Build the app with **Expo (React Native)** in the same repository.
2. Turn the repo into a monorepo: `apps/web` (this project), `apps/mobile`, `packages/core` (today's `src/types`, `src/lib`, `src/i18n/dictionaries`).
3. The app uses `createApiClient("https://eterna.co.mz")` from `src/lib/api-client.ts`.
4. Before the app: add authentication for customers (order history) and CORS rules if needed.

## 7. Next steps / Próximos passos

1. Import the real catalog / Importar o catálogo real (`npm run import:nexsory`, needs the Nexsory storefront id).
2. Real M-Pesa and mKesh integrations / Integrações reais (`src/server/payments/*`), sandbox first.
3. Back-office to manage products and orders / Área de gestão de produtos e encomendas.
4. Order notifications (WhatsApp/SMS/e-mail) / Avisos de encomenda.
5. Info pages from the old site / Páginas informativas do site antigo (tamanhos, trocas, reservas, envios, FAQ).
6. Caching of catalog reads / Cache das leituras do catálogo (`src/server/catalog.ts`).
7. Automated tests (Vitest for `lib/` and `server/`, Playwright for checkout).
