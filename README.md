# Eterna — Online store / Loja online

Luxury womenswear in Maputo (Glória Mall). Website in **Portuguese and English**, built API-first so a
**mobile app** can reuse the same backend later.

Moda feminina de luxo em Maputo (Glória Mall). Site em **português e inglês**, construído "API-first" para
que uma **app móvel** possa usar o mesmo servidor mais tarde.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL + Drizzle ORM · Zod · CSS Modules

## Start / Começar

Requires Node.js 20+ / Requer Node.js 20+ — https://nodejs.org

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open / Abrir: http://localhost:3000 → redirects to `/pt` or `/en`.

| Command / Comando   | What it does / O que faz                          |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Development server / Servidor de desenvolvimento  |
| `npm run build`     | Production build / Compilação para produção       |
| `npm run typecheck` | TypeScript check / Verificação de tipos           |
| `npm run lint`      | ESLint                                            |
| `npm run db:generate` | New migration after editing the schema / Nova migração depois de mudar o esquema |
| `npm run db:migrate`  | Apply migrations (every deploy) / Aplicar migrações (em cada deploy) |
| `npm run db:seed`     | Categories + sample products / Categorias + produtos de exemplo |
| `npm run db:studio`   | Browse the database / Ver a base de dados         |
| `npm run import:nexsory` | Import the real catalog / Importar o catálogo real |

### Database / Base de dados

- **Development:** nothing to install. Without `DATABASE_URL`, an embedded PostgreSQL (PGlite) is created in
  `.data/pglite` and filled automatically on the first `npm run dev`.
  **Desenvolvimento:** nada a instalar. Sem `DATABASE_URL`, é criado um PostgreSQL embutido (PGlite) em
  `.data/pglite`, preenchido automaticamente no primeiro `npm run dev`.
- **Production:** set `DATABASE_URL` (any PostgreSQL: Neon, Supabase, RDS…) and run `npm run db:migrate`.
  **Produção:** definir `DATABASE_URL` (qualquer PostgreSQL) e correr `npm run db:migrate`.
- PGlite allows one process at a time: stop `npm run dev` before `db:seed` / `import:nexsory`.
  O PGlite só aceita um processo de cada vez: parar o `npm run dev` antes de `db:seed` / `import:nexsory`.

## Structure / Estrutura

```
src/
├── app/
│   ├── [locale]/                 /pt and /en
│   │   ├── (site)/               Store frame: announcement bar + navbar / Moldura da loja
│   │   │   ├── page.tsx          Início (sections from the database / secções da base de dados)
│   │   │   └── (inner)/          Compact footer: category, product, cart, favorites, search,
│   │   │                         order, account, info, about, contact
│   │   └── checkout/             Own quiet frame, as in the design / Moldura própria do design
│   └── api/v1 · api/webhooks     Public API + provider callbacks / API pública + retorno das operadoras
├── components/                   home, category, product, cart, checkout, favorites, layout, ui
├── i18n/                         PT/EN interface texts / Textos da interface PT/EN
├── lib/                          SHARED, pure code (reusable in the mobile app) / Código PARTILHADO
├── server/                       SERVER-ONLY: db/, catalog, content, orders, checkout, payments/
├── data/                         Design data loaded by the seed / Dados do design carregados pelo seed
├── types/                        Shared domain types / Tipos partilhados
└── styles/tokens.css             Design system tokens
drizzle/                          SQL migrations / Migrações SQL
scripts/                          DB + import scripts / Scripts de base de dados e importação
docs/                             PLANO (phases), ARQUITETURA, API
```

### Test payments / Testar pagamentos (`PAYMENTS_MODE=mock`)

- M-Pesa/e-Mola/mKesh: confirmed after ~8 s · number ending `0000` → declined · ending `9999` → expires (90 s).
- Card: approved after ~3 s (fields are validated in the browser only, never sent).
- Transfer: upload any photo/PDF · Cash on delivery: only with home delivery.

More / Mais: [docs/PLANO.md](docs/PLANO.md) · [docs/ARQUITETURA.md](docs/ARQUITETURA.md) · [docs/API.md](docs/API.md) · [CONTRIBUTING.md](CONTRIBUTING.md)
