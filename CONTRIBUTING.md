# Contributing / Como contribuir

## Code conventions / Convenções de código

- **Comments in English and Portuguese**, English first, one line each:
  **Comentários em inglês e português**, inglês primeiro, uma linha cada:

  ```ts
  // EN: Prices always come from the catalog.
  // PT: Os preços vêm sempre do catálogo.
  ```

  Comment the *why* and the rules, not what the code obviously does.
  Comentar o *porquê* e as regras, não o que o código já diz.

- **Names in English** (variables, functions, files, URLs). Customer-facing text lives only in `src/i18n/dictionaries`.
  **Nomes em inglês** (variáveis, funções, ficheiros, URLs). Textos para a cliente só em `src/i18n/dictionaries`.
- Components: `PascalCase.tsx` + `PascalCase.module.css` side by side. Other files: `kebab-case.ts`.
- Colours, spacing, fonts: only `var(--token)` from `src/styles/tokens.css`. No raw hex values in components.
  Cores, espaços, letras: só `var(--token)`. Nada de cores soltas nos componentes.
- Never put secrets in `NEXT_PUBLIC_*` variables or in `lib/`, `components/`.
  Nunca pôr segredos em variáveis `NEXT_PUBLIC_*` nem em `lib/`, `components/`.

## Where does my code go? / Onde vai o meu código?

| It is… / É…                                       | Folder / Pasta             |
| ------------------------------------------------- | -------------------------- |
| A page / Uma página                               | `src/app/[locale]/…`       |
| An endpoint / Um endpoint                         | `src/app/api/v1/…`         |
| A business rule using keys or storage / Regra com chaves ou armazenamento | `src/server/` |
| Pure logic also useful to the app / Lógica pura útil à app | `src/lib/`        |
| A visual piece / Uma peça visual                  | `src/components/<area>/`   |
| A text / Um texto                                 | `src/i18n/dictionaries/`   |

## Add a language / Juntar um idioma

1. `src/types/index.ts` → add the code to `LOCALES`.
2. Create `src/i18n/dictionaries/<code>.ts` typed as `Dictionary` and register it in `src/i18n/index.ts`.
3. Add it to `HTML_LANG` and `LOCALE_NAMES` in `src/i18n/config.ts`.
4. Fill the new key in every `Localized` field of `src/data/*`. TypeScript lists what is missing.

## Add a payment operator (e.g. e-Mola) / Juntar uma operadora (ex.: e-Mola)

1. `src/types/index.ts` → add to `PAYMENT_PROVIDERS`.
2. `src/lib/payments/msisdn.ts` → add its prefixes (e-Mola: 86/87).
3. `src/server/payments/<name>.ts` → implement `PaymentGateway`; register it in `src/server/payments/index.ts`.
4. `src/app/api/webhooks/<name>/route.ts` → `export const POST = createWebhookHandler("<name>")`.
5. Logo in `public/images/payments/`, name in `PaymentMethod.tsx`, prefix text in both dictionaries.
