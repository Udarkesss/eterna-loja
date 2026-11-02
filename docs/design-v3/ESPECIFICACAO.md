# Eterna · Loja online · Especificação para implementação (design Versão 3, final)

Caderno de entrega do design para o código. Junta tudo o que foi decidido no chat de design (set.–nov. 2026) e com a cliente
(decisões de 1 nov 2026). Quando este caderno e o canvas não baterem certo, **manda o canvas**; quando o código actual e o
canvas não baterem certo, **manda o canvas** (a versão 3 substitui as versões 1 e 2).

- **Canvas (fonte de verdade):** https://claude.ai/artifact/PcYXgMJz5dQ75QsKKYZgiE, página **"Versão 3 · Design system v8"**,
  versão 90 (2 nov 2026). As páginas "Versão 1" e "Versão 2" ficam só como histórico: não se constroem.
- **Lista dos ecrãs:** [ECRAS.md](ECRAS.md): 125 ecrãs de produção (loja e gestão no computador e no telemóvel, app do
  entregador) + a fila "Ideias" (não construir). Telemóvel e tablet: [secção 8](#8-telemóvel-e-tablet).
- **Design system:** https://claude.ai/code/artifact/610c7297-375e-4ad0-b59c-d7139d5e189d (tokens já em `src/styles/tokens.css`;
  confirmar que estão actualizados com o `project/tokens.json` do design system).
- **Ficheiros do design no computador:** `D:\Web Dev\Eterna-design\` (ver o README dessa pasta):
  - `v3\canvas\project\V3-*.dc.html`: o HTML de cada prancheta, tal como está no canvas;
  - `v3\render\V3-*.html`: as mesmas pranchetas com as imagens locais, para abrir no Chrome e medir/copiar estilos;
  - `v3\*.py`: o gerador (os textos, preços e regras de exemplo estão aí, em Python legível).
- **Proposta comercial aprovada para envio:** `Downloads\Eterna - Proposta comercial da loja online.pptx` (gerador em
  `D:\Web Dev\Eterna-design\proposta\deck.js`). Respostas à cliente: `Downloads\Eterna-V3-proposta - Só as respostas.pptx`.

Como ler uma prancheta a partir do Claude: `Artifact` → `read` com `url` do canvas e `path: "project/V3-Checkout.dc.html"`
(ou abrir o ficheiro local acima). O nome do ficheiro é o nome da prancheta na [lista](ECRAS.md).

---

## 1. Regras gerais

1. **Seguir o canvas à risca**: medidas, cores, tipos de letra, textos e ordem das secções. Os `[parênteses]` são conteúdo de
   exemplo, nunca "a pedir à cliente".
2. **Gestão flexível:** tudo o que é conteúdo (textos, fotos, vídeos, preços, contactos, redes sociais, pacotes de prova, épocas,
   campanhas, respostas do assistente, níveis e percentagens) muda-se na gestão, sem programador. Quando falta um dado da
   cliente, constrói-se o campo para o criar ou importar (Excel/ficheiro), não se espera por ele.
3. **Termo:** sempre "entregador", nunca "motoqueiro".
4. **Pagamentos no arranque: só M-Pesa activo.** A arquitectura de métodos (cartão, M-Pesa, e-Mola, mKesh, transferência, PayPal…)
   fica no código, cada um liga e desliga em Gestão → Pagamentos e avisos; **um método desligado desaparece do checkout**
   (sem "Brevemente"). e-Mola, mKesh e cartão ainda estão em estudo: ficam desligados e não se mencionam à cliente.
5. **Módulo de entregas** desenhado por inteiro (checkout com entrega, acompanhar, app do entregador, entregas e entregadores na
   gestão): constrói-se, mas **começa desligado** (Gestão → Definições). Com ele desligado, só há levantamento no Glória Mall.
6. Português e inglês na loja; a gestão é só em português. Regras do repositório em `CLAUDE.md` (local primeiro; publicar só
   quando a dona disser "publicar").

## 2. Loja (computador e telemóvel)

### Página inicial (`V3-Inicio`, `V3-Inicio-2`, `V3-Inicio-Navegacao`, `V3-M-Inicio*`)
- **Hero** em vídeo 16:9 sem corte (só etiqueta + botão; título opcional) **ou** em slides (`V3-Inicio-Hero-Slides`): escolhe-se
  na gestão (Conteúdo do site). Cada slide liga a uma colecção, categoria, ocasião ou produto.
- **Entrada** com a mensagem da colecção activa (Essenza): mensagem, texto e ligação do botão editáveis em Gestão → Colecções →
  Editar colecção. `*asteriscos*` = destaque. Ao activar outra colecção entra a mensagem dela.
- **Colecção activa:** capa em parallax; ao descer/clicar, a capa sobe e revela Festa e Executiva.
- **Campanha** (`V3-Inicio-Campanha`) e **época do ano** (`V3-Inicio-Epoca`): ver §4.
- **Ocasiões:** "Ver mais ocasiões" com seta minimalista em V e abertura suave.
- **Acabadas de chegar:** automático (últimas peças publicadas primeiro); na gestão só se escolhe quantas.
- **Noivas:** textos novos da White Collection e da Privée; "A experiência Eterna" com **6 passos**; faixa escura com o único
  botão "Marcar prova". Não há botão de prova no cabeçalho.
- **Acessórios:** alterna sozinho Festa ↔ Executivos a cada **10 s** (segundos configuráveis na gestão; propriedade
  `acessoriosSegundos`).
- **Sobre nós:** missão/visão/valores com ícones e 3 números: 2011, "1 loja e 1 showroom", "1 noiva de cada vez" (sem Plus size).
  **Sem linha do tempo "A nossa história"** (retirada).
- **Contactos:** cartões da loja (Eterna · Roupa de Festa, Executiva e Acessórios) e do showroom (Eterna · Bridal Showroom),
  sem "Beyond Time"; dados vêm de Gestão → Contactos e redes sociais.

### Listas e cartão (`V3-Colecao`, `V3-Campanha`, `V3-Categoria`, `V3-Pesquisa`, `V3-Favoritos`)
- **Barra de tipos de peça:** molduras **circulares**, centradas, nomes em maiúsculas, em todo o site; a foto de cada tipo
  enquadra-se em círculo na gestão (Tipos de peça → Enquadrar).
- **Cartão igual em todo o site:** foto, referência, cores em **círculos** (a primeira com anel + nome da cor) e tamanhos.
  **Preço escondido** por defeito; liga em Gestão → Definições → "Preço nos cartões". Peças em campanha ou saldo mostram sempre
  o selo −% e o preço (riscado + novo).
- Filtros: tamanho, cor, preço, "em campanha". "Não encontra o que procura?" com WhatsApp no fim da categoria.
- **Favoritos:** fila "Para madrinhas e mães da noiva".
- As páginas de lista são fluidas (todas as larguras de ecrã).

### Peça (`V3-Produto`, `V3-M-Produto`)
Fotos por cor, tamanhos US/EU (com letra), guia de tamanhos, "Adicionar ao carrinho" (abre o carrinho rápido), "Reservar"
(sinal de 50%), favoritos, "Não encontra o que procura?".

### Carrinho e compra (`V3-Carrinho-Rapido`, `V3-Carrinho`, `V3-Checkout*`, `V3-Confirmacao`)
- **O carrinho guarda as peças:** a cliente marca o que compra agora; o resto fica guardado ("Para depois"). (Decisão
  confirmada: não remover.)
- Checkout curto com os dados já preenchidos; levantamento na loja grátis (entrega só com o módulo ligado).
- **Voucher:** campo "Código do voucher" + "Aplicar"; mostra os vouchers da conta da cliente para aplicar com um toque; código
  errado mostra aviso; linha "Voucher … aplicado" e total recalculado. (No protótipo: `ETERNA-ANA-1000` = −1 000 MT.)
- **Caixa obrigatória** dos termos e condições de compra; sem ela o botão de pagar fica bloqueado.
- **"Todas as vendas da ETERNA são finais…"** em todo o percurso (checkout, confirmação, como comprar).
- Pagamento M-Pesa: a cliente confirma o PIN no telemóvel (`V3-M-Estado`); recibo por WhatsApp e e-mail.

### Reserva (`V3-Checkout-Reserva`)
- **Sinal de 50%**; prazo **30 dias** (colecções e ocasiões) ou **60 dias** (vestidos de noiva e peças da Bridal).
- Caixa obrigatória "Li e aceito as condições de reserva". Textos na 3.ª pessoa, como em eterna.co.mz/pages/reservas.
- "Pedir mais tempo": a cliente pede na conta; liga/desliga em Gestão → Definições.
- A reserva conta para a fidelidade quando estiver paga por inteiro.

### Agendar prova Bridal (`V3-Prova`, `V3-M-Prova`)
Feito pelos termos da Eterna Bridal (PDF `Downloads\termos-condicoes.pdf`; referência eterna-booking.onrender.com).
Passos: vestidos → pacote → data e hora → dados → pagamento.
- Pacotes: **Satin** 3 000 MT, **Silk** 5 000 MT, **Cashmere** 7 500 MT (**brevemente**, até 6 vestidos, 3 horas).
  Até 3 vestidos extra a 1 000 MT cada.
- **48 h de antecedência**; cancelar ou remarcar até 24 h antes; horas de exemplo 12h, 14h, 15h, 16h.
- A prova só fica marcada com o pacote pago. Pacotes, preços, dias, horas, regras e o PDF dos termos editam-se em
  Gestão → Provas.

### Conta e fidelidade (`V3-Conta-Entrar`, `V3-Conta`, `V3-Fidelidade`, `V3-Como-Comprar`)
- Níveis com **ícone próprio**: **Rubi** 0–29 pontos · 0% · **Safira** 30–69 · 5% · **Pérola** 70–119 · 10% ·
  **Diamante** 120+ · 15%. 1 000 MT = 1 ponto (online e na loja, incluindo a Bridal); o nível do ano define-se em janeiro pelos
  pontos do ano anterior; canceladas não dão pontos. Valores editáveis em Gestão → Definições.
- O desconto de nível **não se junta** a campanhas: aplica-se sempre o maior dos dois. Aplica-se a reservas e noivas.
- Por defeito o desconto aparece **sem o nome do nível** ("Desconto de cliente · −5%"); a versão com nome fica guardada em
  Descontos e vouchers.
- A Bridal continua no programa de fidelidade.

### Assistente (chat) (`V3-Chat`, `V3-M-Chat`, `V3-M-WhatsApp-Bot`, `V3-G-Assistente`)
- Botão redondo em **todas as páginas** (computador: canto inferior direito; telemóvel: acima da barra fixa, abre o chat em ecrã
  inteiro).
- **Sem IA paga:** responde por regras/palavras-chave com as perguntas e respostas da gestão e os dados do site (preço e stock
  por referência, tamanhos, reservas, pagamentos, provas, horário, morada, estado da encomenda por número `ET-2026-…`).
- **Liga e desliga na gestão**, cada canal à parte (chat no site · assistente no WhatsApp), no topo de Gestão → Assistente
  (`V3-G-Assistente`, `V3-M-G-Assistente`) e também em Definições. Só o Administrador e o Superadministrador. Desligado: o botão do
  chat sai de todas as páginas da loja (ver `V3-Chat` / `V3-M-Chat` com o Tweak `chatNoSite` = falso) e as mensagens do WhatsApp
  vão directas à equipa na app WhatsApp Business. As perguntas e respostas ficam guardadas; a mudança fica na auditoria.
- **Passa a uma pessoa** sempre que a cliente pede, ou à 2.ª pergunta sem resposta: continua no WhatsApp ou deixa mensagem.
- **WhatsApp Business:** o mesmo assistente no número da loja, pela WhatsApp Cloud API em **coexistência** (a equipa continua
  a usar a app no telemóvel). Gestão → Assistente: perguntas e respostas, conversas passadas à equipa, canais.

### Ecrãs técnicos
`V3-Integracao-Pagamentos` e `V3-Arquitectura-Contas-API`: como os pagamentos e as contas/API se ligam (a loja servirá mais
tarde uma app móvel pela mesma `/api/v1`).

## 3. Gestão (`/gestao`, pela ordem do menu lateral)

| Grupo | Menu | Prancheta(s) |
|---|---|---|
| Loja | Painel | `V3-G-Painel` (+ `V3-G-Painel-Entregas` com o módulo ligado) |
| | Encomendas | `V3-G-Encomendas`, `V3-Admin-Encomenda` (+ variantes com entrega) |
| | Entregas | `V3-Admin-Entregas`, `V3-G-Entregadores` (módulo de entregas) |
| | Reservas | `V3-G-Reservas` (nova reserva, prolongar) |
| | Provas · Bridal | `V3-G-Provas` (agenda, pacotes e regras, termos em PDF) |
| | Clientes | `V3-G-Clientes` (importar clientes da loja antiga; nível editável na ficha) |
| | Descontos e vouchers | `V3-G-Descontos` (tipos ligam/desligam; como o desconto aparece; vouchers por WhatsApp, e-mail e conta) |
| Catálogo | Produtos | `V3-G-Produtos`, `V3-G-Produto-Editar` (cores, tamanhos, fotos por cor) |
| | Tipos de peça | `V3-G-Tipos` (fotos em círculo) |
| | Colecções | `V3-G-Coleccoes`, `V3-G-Colecao-Editar`, `V3-G-Campanha-Editar` |
| | Categorias e filtros | `V3-G-Categorias` |
| | Importar | `V3-G-Importar` (Excel + ZIP de fotos) |
| Site | Conteúdo do site | `V3-G-Conteudo` (secções = menu, hero vídeo/slides, capas e vídeos, épocas do ano), `V3-G-Enquadrar` |
| | Contactos e redes sociais | `V3-G-Contactos` (loja, showroom, telefones, e-mails, horário, redes com ícone) |
| | Assistente (chat) | `V3-G-Assistente` |
| Sistema | Pagamentos e avisos | `V3-G-Pagamentos` |
| | Definições | `V3-G-Definicoes` (preço nos cartões, pedir mais tempo, níveis, módulo de entregas…) |
| | Utilizadores, Papéis, Auditoria | `V3-Admin-Utilizadores`, `V3-Admin-Papeis`, `V3-Admin-Menu-Papeis`, `V3-Admin-Sem-Acesso`, `V3-Admin-Auditoria` |

Entrada da equipa: `V3-Gestao-Entrar`. App do entregador (telemóvel): `V3-E-*` e `V3-Entregador-*` (módulo de entregas).

**Colecções:** uma colecção sazonal activa de cada vez (Festa/Executiva), mais edições especiais e campanhas. Uma capa por
colecção (16:9, banner e topo da página). Ao terminar, as peças voltam às listas normais e a colecção passa ao **arquivo**
("Colecções antigas · arquivo", só na gestão, **não aparece no site**), com nome, datas e capa; cria-se uma a uma ou por
Excel + ZIP. A página pública de colecções anteriores (`V3-Arquivo`) é só uma ideia guardada: não construir.

## 4. Campanhas e épocas do ano

No telemóvel: `V3-M-Inicio-Campanha` e `V3-M-Inicio-Epoca` (mesmas opções; no telemóvel o painel da época empilha sempre:
texto "direita"/"baixo" fica por baixo da imagem, "esquerda"/"cima" fica por cima; peças em 2 × 2).

- **Campanha** (Gestão → Colecções → Nova campanha, `V3-G-Campanha-Editar`): nome e datas livres (Black Friday é só exemplo);
  **normal** ou **relâmpago** (horas, com contagem); escolhe-se **qualquer peça publicada** (de colecções ou ocasiões) e o
  desconto. Na página inicial a secção fica **antes ou depois** da colecção, nunca no lugar dela. As peças em campanha mostram o
  selo −% e o preço nos cartões de todas as listas, e há página da campanha (`V3-Campanha`).
- **Época do ano** (ex.: Natal & Réveillon; Gestão → Conteúdo → Épocas do ano): barra de ponta a ponta colada à colecção, com
  as peças (4) dentro da barra e um painel de foto + descrição de ponta a ponta. Editáveis: cor da barra, fundo da descrição,
  cor das letras, cor do botão; texto à direita, à esquerda, em cima ou em baixo (em cima/baixo a imagem vai de ponta a ponta);
  imagem como foto, slides ou vídeo; efeito visual opcional; datas de início e fim.

## 5. O que ainda falta da cliente (construir o campo; não esperar)

Horário da loja · capas e datas dos catálogos antigos · contas de Facebook e TikTok · contactos e e-mails certos (+ caixa
"Novidades") · Excel das clientes com o nível · catálogo em Excel com fotos · acessos M-Pesa para empresas (Vodacom) ·
termos e condições da Eterna (compra) · conta WhatsApp Business (Meta).

## 6. Ordem de construção (fases da proposta comercial)

| Fase | O que inclui | Prazo |
|---|---|---|
| 1. Design | Esta versão 3 | concluída |
| 2. Loja | Página inicial, colecções, ocasiões, noivas, peça, pesquisa, favoritos, conta e fidelidade | 3 semanas |
| 3. Compra e pagamentos | Carrinho, checkout, voucher, reservas, provas Bridal, M-Pesa, avisos por WhatsApp e e-mail | 3 semanas |
| 4. Gestão | Todos os ecrãs do §3, campanhas e épocas | 3 semanas |
| 5. Lançamento | Domínio, segurança, catálogo e clientes importados, testes com a equipa, formação, 30 dias de garantia | 1 semana |
| Assistentes | Chat no site e bot no WhatsApp (podem ir em paralelo ou depois do lançamento) | 2 semanas |

Antes de cada fase: comparar os ecrãs dessa fase com o que já existe no código e listar as diferenças.

## 7. Pôr online (deploy)

Stack já no repositório (avaliada como segura e adequada): Next.js 15.5 + React 19 + TypeScript, PostgreSQL na **Neon** com
Drizzle, ficheiros na **Vercel Blob**, alojamento **Vercel**. Para lançar:
1. **Vercel Pro** (o plano Hobby não permite uso comercial), projecto e variáveis em nome da Eterna.
2. **Neon** (base de produção com cópias automáticas); migrações aplicadas pelo `vercel-build`.
3. **Domínio eterna.co.mz** num registador moçambicano (≈ 2 400 MT/ano), DNS apontado à Vercel, HTTPS automático.
4. **E-mail** profissional (Google Workspace) e e-mails automáticos.
5. **M-Pesa** com as chaves de produção da Eterna (`src/server/payments/mpesa.ts`, `PAYMENTS_LIVE_METHODS=mpesa`).
6. **WhatsApp Cloud API** (Meta) em coexistência com a app, para avisos e para o assistente.
7. Testes com a equipa (comprar, reservar, marcar prova), formação (uma sessão, todos ao mesmo tempo) e lançamento.

Custos mensais estimados para a cliente: ≈ 4 620 MT (alojamento, base de dados, ficheiros, e-mail, mensagens).
Publicar em produção **só quando a dona disser "publicar"** (`CLAUDE.md`, `docs/PUBLICAR.md`).

## 8. Telemóvel e tablet

Revisão de 2 nov 2026 (versão 90). O site tem de funcionar em computador (≥ 1280 px), tablet (768–1279 px) e telemóvel
(< 768 px).

**Loja no telemóvel: tudo desenhado (28 ecrãs, fila "Loja · telemóvel").** Cada ecrã da loja do computador tem o seu par
`V3-M-*` (os técnicos `V3-Integracao-Pagamentos` e `V3-Arquitectura-Contas-API` não são ecrãs de cliente). Padrões: cabeçalho
de telemóvel, margens de 16 px, listas em 2 colunas, barra de tipos a deslizar, botões a toda a largura, barra fixa em baixo
nos passos de compra, botão do assistente em todas as páginas da loja. As ligações entre ecrãs de telemóvel apontam para os
ecrãs de telemóvel (pesquisa, carrinho, reserva, favoritos, fidelidade, como comprar).

**Gestão no telemóvel: tudo desenhado (29 ecrãs, fila "Gestão · telemóvel", `V3-M-G-*`).** Mesmos dados e regras do
computador. Padrões:
- barra de topo escura (menu, ETERNA Gestão, procurar, avisos);
- a barra lateral passa a menu em gaveta (`V3-M-G-Menu`); o Tweak "papel" mostra o que cada papel vê (Superadministrador,
  Administrador, Gestor de loja, Atendedor), como em `V3-Admin-Menu-Papeis`;
- barra de separadores em baixo: Painel, Encomendas, Reservas, Provas, Menu (com contadores);
- tabelas passam a cartões (uma linha = um cartão com as acções principais em botões);
- nos ecrãs de edição, a acção principal (Guardar, Publicar, Activar) fica numa barra fixa por cima dos separadores.
A entrada é a mesma da equipa e dos entregadores: `V3-M-Gestao-Entrar`. As variantes de computador "com entregas ligadas"
(`V3-G-Painel-Entregas`, `V3-G-Encomendas-Entregas`, `V3-Admin-Encomenda-Entrega`) seguem o mesmo padrão no telemóvel,
com os dados de entrega de `V3-M-G-Entregas`.

**Tablet:** não há pranchetas. Regra: a loja usa o layout do computador com 2–3 colunas nas listas e o menu em gaveta (como no
telemóvel) abaixo de 1024 px; nos passos de compra, uma coluna centrada (máx. 640 px). Na gestão, a barra lateral recolhe para
ícones e as tabelas mantêm-se, com deslocamento horizontal quando não couberem.
