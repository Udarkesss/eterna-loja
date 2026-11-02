# Plano de construção / Build plan

Fonte da verdade / Source of truth: página **"Versão 3 · Design system v8"** do canvas
(https://claude.ai/artifact/PcYXgMJz5dQ75QsKKYZgiE). Lista dos ecrãs: [design-v3/ECRAS.md](design-v3/ECRAS.md);
regras: [design-v3/ESPECIFICACAO.md](design-v3/ESPECIFICACAO.md). Migração do site antigo: [MIGRACAO.md](MIGRACAO.md).

| Fase (V3) | O que inclui | Estado |
| --------- | ------------ | ------ |
| **Base** | Base de dados, API /api/v1, contas, gestão com papéis e auditoria, entregas, M-Pesa (falta testar com as chaves) | ✅ Feito (versões 1–2) |
| **Migração** | Produtos do Shopify (CSV + espelho do eterna.co.mz, fotos), categorias e conteúdo do site antigo | ✅ Feito |
| **2. Loja** | Início (vídeo ou slides, efeitos), colecção Essenza, categorias e ocasiões, peça, pesquisa com sugestões, favoritos, conta com nível, fidelidade, como comprar, entrar | ✅ Feito |
| **3. Compra e pagamentos** | Carrinho rápido e carrinho, checkout, voucher, termos obrigatórios, reservas (50%), provas Bridal pagas (Satin/Silk/Cashmere), desconto do nível no checkout, avisos | ⏳ Próxima |
| **4. Gestão** | Ecrãs V3-G-* e V3-M-G-* (computador e telemóvel), campanhas e épocas, tipos de peça, contactos e redes, descontos e vouchers, reservas, importar Excel + ZIP | ⏳ |
| **5. Lançamento** | Domínio, chaves reais, testes com a equipa, formação | ⏳ |
| **Assistentes** | Chat no site e bot no WhatsApp | ⏳ |

## Decisões / Decisions

- **Pagamentos:** todos os métodos ficam (incluindo o de teste, ilustrativo); cada um desliga-se em Gestão → Pagamentos e
  um método desligado não aparece no checkout.
- **Entregas:** módulo construído mas desligado (Gestão → Definições); desligado = só levantamento.
- **Preço nos cartões:** escondido por defeito (Gestão → Definições); peças em saldo mostram sempre o preço.
- **Dados de exemplo:** só em local (`npm run db:demo`, `npm run db:demo -- clear`), nunca na gestão nem em produção.
- **Cartão:** os campos são validados no browser mas **nunca** enviados ao servidor; no lançamento são trocados pelos
  campos seguros do gateway.

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
- Dados de exemplo (só em local, com o servidor parado): `npm run db:demo`; apagam-se com `npm run db:demo -- clear`.
  A equipa de exemplo (demo.super, demo.admin, demo.gestora02, demo.gestora22, demo.atend02, demo.entregador) usa
  DEMO_PASSWORD do .env.local.
- Mensagens (WhatsApp/SMS/e-mail) ainda não saem: em modo de demonstração os códigos aparecem no ecrã (fase 6).
