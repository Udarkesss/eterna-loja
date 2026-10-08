# Pôr online e publicar / Deploy

Produção: **Vercel** (site) + **Neon** (PostgreSQL) + **Vercel Blob** (fotos e vídeos carregados na gestão).
Os comprovativos de transferência ficam na base de dados (privados).

## Configuração (uma vez)
1. **GitHub:** criar um repositório **privado** vazio (ex.: `eterna-loja`) e enviar o projecto (`git push -u origin main`).
2. **Neon:** criar o projecto (região mais próxima, ex.: Frankfurt) e copiar o endereço **com "-pooler"**
   (Connection string → Pooled connection).
3. **Vercel → Add New → Project →** importar o repositório do GitHub. Antes de "Deploy", em *Environment Variables*:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | endereço do Neon (pooled) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<nome>.vercel.app` (depois o domínio real) |
   | `NEXT_PUBLIC_WHATSAPP` | `258824876300` |
   | `PAYMENTS_MODE` | `mock` (até as operadoras estarem ligadas) |

4. **Vercel → Storage → Create → Blob** e ligar ao projecto (cria `BLOB_READ_WRITE_TOKEN` sozinho).
5. *Deployments → Redeploy*. No primeiro deploy as tabelas e os dados do design são criados.
6. Abrir `https://<nome>.vercel.app/gestao/entrar` → **Criar a conta de Superadministrador** (conta real da dona).

## Publicar uma alteração
Tudo é feito e testado em local. Quando a dona disser "publicar":
```
npx tsc --noEmit && npx eslint src scripts && npx next build
git push origin main
```
A Vercel actualiza o site em ~2 minutos. Para voltar atrás: Vercel → Deployments → versão anterior → *Promote*.

## Limites do plano gratuito
- Vercel Hobby é para uso **não comercial**: serve para a equipa ver e testar. Para vender a sério → plano Pro
  ou outro alojamento pago.
- Neon gratuito: 0,5 GB. Vercel Blob gratuito: espaço limitado — fotos em WebP e vídeos até 8 MB.
- M-Pesa real na Vercel: a resposta chega pela consulta de estado se a função for cortada antes do PIN.
