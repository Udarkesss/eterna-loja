# Migração do eterna.co.mz (Shopify) para a loja nova

Relatório do cruzamento feito a 2 nov 2026 entre o CSV exportado do Shopify (`products_export_1-2.csv`, 22 out 2026),
os dados públicos do site antigo e as categorias do design V3. A importação faz-se em **Gestão → Produtos → Importar do
Shopify** (local e online), com "Espelhar o site antigo" ligado.

## Números

| | Produtos |
|---|---|
| No CSV do Shopify | 1 467 (1 466 peças + 1 serviço) |
| Publicados no site antigo | 938 |
| No CSV e no site antigo | 937 (+ o serviço "Agendar prova") |
| Só no site antigo (mais recentes que o CSV) | 0 |
| Só no CSV (não publicados no site antigo) | 529 → entram em **rascunho**, com fotos |
| Vão para a loja (publicados no site antigo, com foto e preço) | 931 |
| Publicados no site antigo mas sem preço (ficam em rascunho) | 6: V012, V013, V007, CL151, CL153, 091174 |
| Sem nenhuma foto (ficam em rascunho) | 10: CL150, CAR520, DRESS1848, DRESS1662, DRESS1110, DRESS1399, DRESS1895, DRESS1538, DRESS1700, DRESS1924 |
| Fotografias | 2 531 links; 51 já não existem (49 no armazenamento do site antigo anterior ao Shopify, 2 apagadas no Shopify) |

## Regras da importação

1. **Sem duplicados:** cada produto é encontrado pelo handle do Shopify, pela referência ou pelo endereço; se já existir,
   é **substituído** pelos dados da origem (nomes, textos, preço, cores, categorias, tamanhos, stock, estado e fotos).
2. **Fonte dos dados:** produto publicado no site antigo → dados do site antigo (os mais recentes); não publicado → CSV.
3. **Estado (espelho):** publicado no site antigo, com foto e preço → publicado; tudo o resto → rascunho.
4. **Categorias:** as colecções do site antigo a que o produto pertence (tabela abaixo); para os rascunhos, o "Type" e as
   etiquetas do Shopify (ESSENZA, WHITE COLLECTION, ETERNA PRIVÉE, CONVIDADA-LISTA, GALA, …).
   Colecção principal: White Collection ou Eterna Privée, senão Essenza.
5. **Tamanhos:** "10" → `10US/42EUR/M` (escala do site); "OS" → "Único". **Stock:** o Shopify não regista stock; os tamanhos
   esgotados no site antigo ficam com 0, os outros com o número escolhido no ecrã (1 por defeito), na Loja 02.
6. **Fotos:** descarregadas do CDN do Shopify, em WebP (1200 px), guardadas no Vercel Blob online. Repetir a importação só
   volta a descarregar as fotos de um produto quando a lista dele mudou.
7. **Textos:** o Shopify só tem português; os 60 parágrafos que se repetem no catálogo têm tradução inglesa
   (`src/lib/import/shopify-en.ts`); os textos únicos ficam com uma frase curta em inglês (nome e referência).

## Colecções do site antigo → categorias da loja nova

| No site antigo | Handle | Produtos | Na loja nova |
|---|---|---|---|
| Acessórios | `acessorios-1` | 398 | `acessorios` |
| Acessórios de Festa | `acessorios` | 372 | `acessorios-festa` |
| Acessórios de Noiva | `acessorios-noiva` | 58 | `acessorios-noiva` |
| Acessórios Executivos | `acessorios-executivos` | 14 | `acessorios-executivos` |
| Agendar Prova | `agendamento` | 1 | — (sem equivalente) |
| Bijuteria | `bijuteria` | 79 | `bijuteria` |
| Blazers | `blazers-casacos` | 29 | `blazers-casacos` |
| Blusas | `blusas` | 69 | `blusas` |
| Bodys Modeladores | `bodys-modeladores` | 3 | `bodys-modeladores` |
| Calcinhas Modeladoras | `calcinhas-modeladoras` | 8 | `calcinhas-modeladoras` |
| Calças | `calcas` | 40 | `calcas` |
| Calções Modeladores | `calcoes-modeladores` | 9 | `calcoes-modeladores` |
| Capas de Noiva | `capas-noiva` | 5 | `capas-noiva` |
| Carteiras | `carteiras` | 10 | `carteiras` |
| Casaquinhos | `casaquinhos` | 0 | `casaquinhos` |
| Cintos de Noiva | `cintos-noiva` | 4 | `cintos-noiva` |
| Convidada | `convidada-list` | 44 | `convidada` |
| Echarpes | `echarpes` | 3 | `echarpes` |
| ESSENZA | `essenza` | 358 | `essenza` |
| ETERNA PRIVÉE | `eterna-privee` | 63 | `eterna-privee` |
| Evento Corporativo | `evento-corporativo-new` | 75 | `evento-corporativo` |
| Fascinators | `fascinators` | 53 | `fascinators` |
| Fatos de Cerimónia | `fatos-cerimonia` | 17 | `fatos-cerimonia` |
| Fatos Executivos | `fatos-executivos` | 32 | `fatos-executivos` |
| Finalistas & Debutantes | `finalistas-debutants-new` | 13 | `finalistas-debutantes` |
| Gala | `gala-new` | 95 | `gala` |
| Home page | `frontpage` | 1 | — (sem equivalente) |
| Macacões de Festa | `macaoes-festa` | 14 | `macaoes-festa` |
| Macacões Executivos | `macaoes-executivos` | 8 | `macaoes-executivos` |
| Macacões Modeladores | `macaoes-modeladores` | 1 | `macaoes-modeladores` |
| Madrinha & Mãe da Noiva | `madrinha-mae-da-noiva-new` | 84 | `madrinha-mae-noiva` |
| Modeladores | `modeladores` | 28 | `modeladores` |
| Modeladores de Braços | `modeladores-bracos` | 2 | `modeladores-bracos` |
| Natal | `natal` | 0 | — (sem equivalente) |
| Noivado & Lobolo | `noivado-lobolo-new` | 26 | `noivado-lobolo` |
| Noivas | `noivas` | 151 | `noivas` |
| Ocasiões | `ocasioes` | 181 | `ocasioes` |
| Plus Size Executivo | `plus-size-executivo` | 14 | — (sem equivalente) |
| Plus Size Festa | `plus-size-festa` | 20 | — (sem equivalente) |
| Pochettes | `pochettes` | 223 | `pochettes` |
| Pochettes de Noiva | `pochettes-de-noiva` | 12 | `pochettes-de-noiva` |
| Roupa de Festa | `roupa-de-festa` | 181 | `roupa-de-festa` |
| Roupa Executiva | `roupa-executiva` | 212 | `roupa-executiva` |
| Réveillon | `reveillon` | 0 | — (sem equivalente) |
| Saias | `saias` | 2 | `saias` |
| Saias Modeladoras | `saias-modeladoras` | 1 | `saias-modeladoras` |
| Sapatos de Festa | `sapatos-cerimonia` | 14 | `sapatos-cerimonia` |
| Sapatos de Noiva | `sapatos-noiva` | 12 | `sapatos-noiva` |
| Sapatos Executivos | `sapatos-executivos` | 4 | `sapatos-executivos` |
| Soutiens | `soutiens` | 4 | `soutiens` |
| THE WHITE COLLECTION | `white-collection` | 31 | `white-collection` |
| Tiaras de Noiva | `tiaras-noiva` | 12 | `tiaras-noiva` |
| Vestidos Cocktail | `vestidos-cocktail` | 80 | `vestidos-cocktail` |
| Vestidos de Noiva | `vestidos-de-noiva` | 93 | `vestidos-de-noiva` |
| Vestidos Executivos | `vestidos-executivos` | 22 | `vestidos-executivos` |
| Vestidos Longos | `vestidos-longos` | 71 | `vestidos-longos` |
| Véus de Noiva | `veus-noiva` | 13 | `veus-noiva` |

Sem equivalente: **Plus Size Festa / Executivo** (as peças continuam nos seus tipos; o design V3 não tem Plus Size),
**Natal / Réveillon** (vazias; passam a ser "Épocas do ano" na gestão, fase 4), **Home page** e **Agendar Prova** (o
serviço de prova é a página própria de provas).

## Conteúdos copiados do site antigo

- **Contactos:** Glória Mall — Loja 2 (Eterna · Roupa de Festa, Executiva e Acessórios) e Loja 22 (Eterna Bridal ·
  showroom, só por marcação); +258 82 487 6330, WhatsApp +258 84 073 3688, apoio@eterna.co.mz;
  Instagram @eterna.dresses e @eterna.bridal, Facebook "Eterna Dresses", TikTok @eterna.dresses.
- **Horário:** segunda a sábado 09h00–19h00; domingos e feriados 10h00–15h00.
- **Páginas:** Sobre nós (história, missão, visão, valores, lojas, fundadora, equipa), Tamanhos, Trocas e devoluções,
  Reservas (com a regra V3: 30 dias, ou 60 na Bridal), Perguntas frequentes, Pagamentos e Envios
  (`src/data/pages.ts`, editáveis em Gestão → Conteúdo do site).
- **Fidelidade:** os níveis do site antigo (Rubi 0–29 · 0%, Safira 30–69 · 5%, Pérola 70–119 · 10%, Diamante 120+ · 15%;
  1 000 MT = 1 ponto) são os mesmos do design V3.

## Por confirmar com a cliente

- A política de privacidade do site antigo é o texto genérico do Shopify ("desenvolvido pela Shopify"): não foi copiada;
  falta o texto da Eterna (e os termos e condições de compra).
- O site antigo tem um 2.º perfil de Facebook (`facebook.com/share/1BfKHkL5F5/`) sem nome visível: confirmar qual é.
- Telefone para atendimento personalizado na FAQ antiga: +258 84 105 5299 (mantido no texto).
