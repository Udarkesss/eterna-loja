# Plano de construção / Build plan

Fonte da verdade / Source of truth: canvas **"Eterna — Loja Online de Luxo"**
(https://claude.ai/artifact/PcYXgMJz5dQ75QsKKYZgiE). O site segue o design à risca.

| Fase | Ecrãs do design | Estado |
| ---- | --------------- | ------ |
| **0. Base de dados** | Modelo completo para todas as fases (27 tabelas) | ✅ Feito |
| **1. Loja pública** | Início, Categoria, Produto, Checkout (6 métodos + estados), Telemóvel · Início / Pagamento / A aguardar PIN, acompanhamento (sem mapa ao vivo) | ✅ Feito |
| **2. Conta de cliente** | Entrar ou criar conta (e-mail, WhatsApp com código), recuperar palavra-passe, área de cliente (encomendas, provas, favoritos na conta, dados, formas de entrar). Google/Facebook: botões prontos, falta a conta de programador | ✅ Feito |
| **3. Acesso à gestão** | /gestao: entrar, primeiro acesso, bloqueio 15 min, palavra-passe temporária, A1 Utilizadores, A2 Papéis, A3 menu por papel, A4 Auditoria (+CSV), A5 Sem acesso | ✅ Feito |
| **4. Gestão da loja** | Painel, Encomendas (lista, por cliente, detalhe, comprovativos, devoluções), Provas, Produtos (+ editor, fotos, stock por loja), Colecções, Conteúdo do site, Vídeo/parallax/ocasiões, Pagamentos e avisos, Definições, dados de exemplo | ✅ Feito |
| **5. Entregas** | (já existe: atribuir entregador e avançar estados) · 4 Entregas, mapa e comissões; Entregador · 2 As minhas entregas, 3 Entrega/GPS/código; mapa ao vivo em "Acompanhar entrega" | ⏳ |
| **6. Integrações reais** | ✅ M-Pesa (C2B + consulta de estado, `src/server/payments/mpesa.ts` — falta testar com as chaves da Eterna) · e-Mola / mKesh, cartão 3-D Secure (campos seguros do gateway), SMS/WhatsApp/e-mail, fornecedor de mapas | 🔶 |

## Decisões / Decisions

- **Navegação:** a navbar activa é a da versão anterior (escolha da cliente), com o menu **exactamente** como no design:
  Noivas · Ocasiões · Beyond Time · Acessórios · Modeladores · Agendar prova + pesquisa, conta, favoritos, carrinho.
  A navbar do design está em `src/components/layout/DesignHeader.tsx` e fica comentada em
  `src/app/[locale]/(site)/layout.tsx` — para a usar, trocar as duas linhas indicadas no ficheiro.
- **Textos com [parênteses rectos]** no design (horário, banco, NIB, taxas de entrega…) ficam iguais: são dados por preencher.
- **Imagens e vídeos** do design estão em `public/images/*` e `public/videos/*`.
- **Favoritos** ficam no browser até à fase 2 (depois passam para a conta).
- **Cartão:** os campos do design são validados no browser mas **nunca** enviados ao servidor; na fase 6 são trocados
  pelos campos seguros do gateway escolhido.

## Por confirmar com a Eterna / To confirm

1. O checkout do design só pede **nome e e-mail**. Para transferência, pagamento na entrega e cartão não há telefone —
   mas o design promete "confirmamos por SMS". Juntar um campo de telefone?
2. Taxas de entrega por zona, horário das lojas, dados bancários (NIB), limite do pagamento na entrega.
3. Descrições e composição das peças (marcadas "[Confirmar …]").

## M-Pesa (Vodacom)

1. Conta em https://developer.mpesa.vm.co.mz → My Profile: **API Key** e **Public Key**.
2. No `.env.local`: `MPESA_API_KEY`, `MPESA_PUBLIC_KEY`, `MPESA_SERVICE_PROVIDER_CODE=171717`, `MPESA_ENV=sandbox`.
3. Testar as chaves: `npm run test:mpesa -- 84XXXXXXX 10` → resposta `INS-0`.
4. Ligar no site: `PAYMENTS_LIVE_METHODS=mpesa` (os outros métodos continuam simulados) e reiniciar o servidor.
5. Produção só depois do **Go Live** aprovado pela Vodacom: `MPESA_ENV=production` e o código de comerciante da Eterna.

- O pedido C2B espera pelo PIN da cliente (até 85 s) em segundo plano; se não houver resposta, o site
  consulta a Vodacom (*Query Transaction Status*) antes de dar a encomenda como expirada.
- Precisa de servidor Node contínuo (`npm run build && npm start`); não serve em alojamento serverless.

## Agendamento de provas (combinado com a Eterna)

1. A cliente escolhe ocasião, loja (Noiva → Loja 22, resto → Loja 02), dia, hora livre e peças (favoritos) em /pt/fitting.
   Com conta, nome e telefone vêm da conta.
2. O pedido fica registado (PR-0042) e abre o WhatsApp da loja com a mensagem já escrita e o link /pt/fitting/<código>
   (fotos das peças; sem dados pessoais; pré-visualização com foto quando o site estiver online).
3. A equipa responde no WhatsApp e em Gestão → Provas carrega "Aceitar" ou "Propor outra hora"; o sistema prepara a
   mensagem de confirmação para enviar. Lembrete na véspera com um clique; no fim "Realizada" ou "Faltou".
4. Horário (dias, abertura, duração noiva/outras) em Gestão → Definições. Uma prova de cada vez por loja.

## Primeiro acesso à gestão

- Abrir /gestao/entrar → "Criar a conta de Superadministrador" (só aparece enquanto não existir nenhum real).
- Dados de exemplo: Gestão → Definições → "Carregar dados de exemplo" (apagam-se no mesmo sítio).
  A equipa de exemplo (demo.super, demo.admin, demo.gestora02, demo.gestora22, demo.atend02, demo.entregador) usa
  DEMO_PASSWORD do .env.local. `npm run db:demo-admin` cria só o demo.super (com o servidor parado).
- Mensagens (WhatsApp/SMS/e-mail) ainda não saem: em modo de demonstração os códigos aparecem no ecrã (fase 6).
