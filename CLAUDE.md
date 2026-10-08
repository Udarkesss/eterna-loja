# Eterna — regras do projecto / project rules

Loja online de luxo Eterna (Maputo, Glória Mall). Next.js 15 + PostgreSQL (Drizzle). Ver `README.md` e `docs/`.

## Fluxo de trabalho: local → produção só por ordem da dona
1. **Tudo se faz e testa em local** (`npm run dev`, base de dados PGlite em `.data/`). Nunca pôr o `DATABASE_URL`
   de produção no `.env.local`.
2. Commits locais à vontade (`git commit`), com mensagens claras em português.
3. **Publicar só quando a dona disser "publicar"** (ou equivalente explícito). Publicar = `git push origin main`;
   a Vercel compila e actualiza o site sozinha (`vercel-build` aplica as migrações na base de dados de produção).
4. Antes de publicar: `npx tsc --noEmit`, `npx eslint src scripts`, `npx next build` sem erros, e testar no browser.
5. Depois de publicar: abrir o site online e confirmar que as páginas principais respondem.
6. Nunca `git push --force`, nunca reescrever o histórico, nunca publicar sem a ordem.

## Base de dados
- Mudou o esquema (`src/server/db/schema.ts`)? → `npm run db:generate` e incluir a migração nova em `drizzle/` no commit.
- Produção: migrações aplicadas automaticamente no deploy (`scripts/db-deploy.ts`); os dados do design só são
  carregados se a base estiver vazia — nunca se apaga o que a equipa fez na gestão.

## Código
- Comentários em inglês e português (`EN:` / `PT:`); textos para clientes em `src/i18n/dictionaries/{pt,en}.ts`.
- A gestão (`/gestao`) é só em português. Permissões sempre verificadas no servidor (`src/server/staff/access.ts`).
- Seguir o design "Eterna — Loja Online de Luxo" e o design system Eterna (tokens em `src/styles/tokens.css`).
- No fim de cada tarefa: rever o que deixou de ser útil e retirar com segurança (perguntar antes de apagar
  ficheiros fornecidos pela dona).

## Ambiente (Windows desta máquina)
- Node em `C:\Program Files\nodejs` (pode não estar no PATH do terminal do Claude).
- Disco C: cheio: `npm install --cache "D:\Web Dev\.npm-cache"` e TEMP/TMP em `D:\Web Dev\.tmp`.
