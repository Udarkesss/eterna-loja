import type { Localized } from "@/types";
import type { SectionSeed } from "./content";

/**
 * EN: Texts of the content pages ("Sobre nós" and the footer "Informações" pages), copied from the old eterna.co.mz
 *     (pages sobre-nos, tamanhos, trocas-devolucoes, reservas, faq) with an English version. They are editable in
 *     Gestão → Conteúdo do site; these are only the starting texts. Reservations follow design V3 (60 days for Bridal).
 * PT: Textos das páginas de conteúdo ("Sobre nós" e "Informações" do rodapé), copiados do eterna.co.mz antigo, com
 *     versão inglesa. Editam-se em Gestão → Conteúdo do site; isto são só os textos iniciais. As reservas seguem a V3.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });
const P = (...paragraphs: [string, string][]): Localized => ({
  pt: paragraphs.map((p) => p[0]).join("\n\n"),
  en: paragraphs.map((p) => p[1]).join("\n\n"),
});

const MISSION = L(
  "Proporcionar a cada mulher o look perfeito para os momentos mais especiais da sua vida, com atendimento personalizado e peças de excelência.",
  "To give every woman the perfect look for the most special moments of her life, with personal service and outstanding pieces.",
);
const VISION = L(
  "Ser a referência nacional em moda feminina de alta qualidade, reconhecida pela curadoria exclusiva, atendimento de excelência e experiência de loja irrepreensível.",
  "To be the national reference in high-quality womenswear, known for exclusive curation, excellent service and a flawless in-store experience.",
);
const VALUES = L(
  "Elegância atemporal, qualidade excepcional, atendimento personalizado e compromisso com a satisfação de cada cliente.",
  "Timeless elegance, exceptional quality, personal service and a commitment to every client's satisfaction.",
);

/** EN: Page "about", key "body". PT: Página "about", secção "body". */
export const aboutSeed: SectionSeed = {
  key: "body",
  data: {
    mission: MISSION,
    vision: VISION,
    values: VALUES,
    body: P(
      [
        "Fundada em 2011, a ETERNA é uma marca moçambicana de moda feminina que une elegância, exclusividade e requinte. Somos especializados em Vestidos de Festa e Trajes de Cerimónia, Roupa Executiva sofisticada e elegante e em Vestidos de Noiva que transformam sonhos em realidade.",
        "Founded in 2011, ETERNA is a Mozambican womenswear brand that brings together elegance, exclusivity and refinement. We specialise in party dresses and ceremony wear, sophisticated business wear and wedding dresses that turn dreams into reality.",
      ],
      [
        "Cada peça é cuidadosamente selecionada, incluindo opções em tamanhos plus size, para oferecer estilo, exclusividade e atenção a cada detalhe. Acreditamos que a verdadeira elegância se encontra nos detalhes e no cuidado que dedicamos a cada momento.",
        "Every piece is carefully selected, including plus-size options, to offer style, exclusivity and attention to every detail. We believe true elegance lies in the details and in the care we give to every moment.",
      ],
      [`Missão — ${MISSION.pt}`, `Mission — ${MISSION.en}`],
      [`Visão — ${VISION.pt}`, `Vision — ${VISION.en}`],
      [`Valores — ${VALUES.pt}`, `Values — ${VALUES.en}`],
      [
        "ETERNA Bridal · Glória Mall, Loja 22 — Um espaço inteiramente dedicado às noivas. Com atendimento exclusivo e apenas por marcação, reservamos a loja para uma única noiva de cada vez, garantindo dedicação total e uma atmosfera mágica, com uma curadoria criteriosa de vestidos de prestígio internacional.",
        "ETERNA Bridal · Glória Mall, Store 22 — A space entirely devoted to brides. With exclusive, appointment-only service, we keep the store for one bride at a time, for complete dedication and a magical atmosphere, with a careful selection of internationally renowned dresses.",
      ],
      [
        "ETERNA · Glória Mall, Loja 2 — A essência da ETERNA: vestidos de gala, moda executiva e peças intemporais que traduzem sofisticação e distinção, de marcas de renome internacional, num ambiente acolhedor e requintado.",
        "ETERNA · Glória Mall, Store 2 — The essence of ETERNA: gala dresses, business wear and timeless pieces that speak of sophistication and distinction, from internationally renowned brands, in a warm and refined setting.",
      ],
      [
        "A fundadora — «Quando sonhei a ETERNA, queria criar um espaço onde cada mulher se sentisse valorizada e confiante, independentemente da ocasião. Sempre acreditei que a moda vai além do vestir — é expressão de identidade, é memória, é emoção.» Obrigada por fazer parte desta história feita de mulheres reais, elegantes e extraordinárias.",
        "The founder — “When I dreamt of ETERNA, I wanted to create a place where every woman would feel valued and confident, whatever the occasion. I have always believed that fashion goes beyond dressing — it is identity, memory and emotion.” Thank you for being part of this story of real, elegant and extraordinary women.",
      ],
      [
        "A nossa equipa — Feita por mulheres, para mulheres: sensibilidade estética, profissionalismo e dedicação, para que cada visita seja um momento memorável.",
        "Our team — Made by women, for women: an eye for beauty, professionalism and dedication, so that every visit is a memorable moment.",
      ],
    ),
  },
};

/** EN: Page "info", one section per footer page (key = slug in src/data/site.ts). PT: Uma secção por página. */
export const infoSeeds: SectionSeed[] = [
  {
    key: "tamanhos",
    data: {
      body: P(
        [
          "Como medir: busto — contorne a parte mais proeminente do busto com a fita métrica, confortável, sem apertar; cintura — a parte mais estreita do tronco, logo acima do umbigo e abaixo das costelas; anca — a parte mais larga dos quadris e glúteos, com a fita paralela ao chão.",
          "How to measure: bust — around the fullest part of the bust, comfortable, not tight; waist — the narrowest part of the torso, just above the navel and below the ribs; hips — the widest part of the hips and seat, keeping the tape parallel to the floor.",
        ],
        ["Tamanhos padrão (busto · cintura · anca, em cm):", "Standard sizes (bust · waist · hips, in cm):"],
        ["XS · 2US (32–34EUR): 85–87 · 68–70 · 91–93", "XS · 2US (32–34EUR): 85–87 · 68–70 · 91–93"],
        ["S · 4US–6US (36–38EUR): 88–91 · 71–75 · 94–98", "S · 4US–6US (36–38EUR): 88–91 · 71–75 · 94–98"],
        ["M · 8US–10US (40–42EUR): 92–99 · 76–82 · 99–105", "M · 8US–10US (40–42EUR): 92–99 · 76–82 · 99–105"],
        ["L · 12US–14US (44–46EUR): 100–106 · 83–90 · 106–113", "L · 12US–14US (44–46EUR): 100–106 · 83–90 · 106–113"],
        ["XL · 16US–18US (48–50EUR): 107–114 · 91–97 · 114–119", "XL · 16US–18US (48–50EUR): 107–114 · 91–97 · 114–119"],
        ["XXL · 20US (52EUR): 115 · 98", "XXL · 20US (52EUR): 115 · 98"],
        [
          "Sapatos (US · Europa · cm): 5 · 35 · 22 — 6 · 36 · 23 — 7 · 37,5 · 24 — 8 · 38,5 · 25 — 9 · 40 · 26 — 10 · 42 · 27 — 11 · 43 · 28. Recomendamos medir o comprimento do pé em centímetros para maior precisão.",
          "Shoes (US · Europe · cm): 5 · 35 · 22 — 6 · 36 · 23 — 7 · 37.5 · 24 — 8 · 38.5 · 25 — 9 · 40 · 26 — 10 · 42 · 27 — 11 · 43 · 28. We recommend measuring your foot length in centimetres for accuracy.",
        ],
      ),
    },
  },
  {
    key: "trocas-devolucoes",
    data: {
      body: P(
        ["Na Eterna, não aceitamos trocas nem devoluções.", "At Eterna, we do not accept exchanges or returns."],
        [
          "Criamos todas as condições para que possa experimentar as suas peças com conforto e acompanhamento das nossas consultoras, assegurando que cada detalhe é revisto antes da compra e que não ocorram danos em artigos mais delicados.",
          "We make sure you can try on your pieces in comfort, with our consultants by your side, so that every detail is checked before you buy and delicate items are not damaged.",
        ],
        [
          "Antes do pagamento, tem a oportunidade de verificar cuidadosamente a peça escolhida. Após a saída da loja, a nossa responsabilidade cessa, uma vez que não conseguimos garantir a conservação de peças fora do nosso controlo. Todas as nossas peças são entregues com a qualidade garantida.",
          "Before paying, you can check the chosen piece carefully. Once it leaves the store our responsibility ends, as we cannot guarantee the care of pieces beyond our control. Every piece is delivered with guaranteed quality.",
        ],
      ),
    },
  },
  {
    key: "reservas",
    data: {
      body: P(
        [
          "Para sua comodidade, disponibilizamos o serviço de reserva de peças, que permite garantir o artigo desejado antes da compra.",
          "For your convenience, you can reserve a piece to secure it before you buy.",
        ],
        [
          "Como funciona: escolha a peça que deseja reservar; pague 50% do valor total como sinal; a peça fica separada em seu nome; no levantamento, liquida os 50% restantes e conclui a compra.",
          "How it works: choose the piece you want to reserve; pay 50% of the total as a deposit; the piece is set aside in your name; when you collect it, you pay the remaining 50% and complete the purchase.",
        ],
        [
          "Prazo: 30 dias a contar da data da reserva (colecções e ocasiões) ou 60 dias (vestidos de noiva e peças da Bridal). Após esse prazo, a reserva é cancelada automaticamente e o valor do sinal não é reembolsável.",
          "Time limit: 30 days from the reservation date (collections and occasions) or 60 days (wedding dresses and Bridal pieces). After that, the reservation is cancelled automatically and the deposit is not refundable.",
        ],
        [
          "As reservas destinam-se apenas a garantir disponibilidade; não é possível trocar a peça reservada por outra.",
          "Reservations only guarantee availability; the reserved piece cannot be exchanged for another.",
        ],
      ),
    },
  },
  {
    key: "pagamentos",
    data: {
      body: P(
        [
          "Na loja aceitamos cartões bancários, transferências, M-Pesa e numerário. Na loja online, os métodos disponíveis aparecem no checkout.",
          "In store we accept bank cards, transfers, M-Pesa and cash. Online, the available methods are shown at checkout.",
        ],
        ["Todas as vendas da ETERNA são finais.", "All ETERNA sales are final."],
      ),
    },
  },
  {
    key: "envios",
    data: {
      body: P(
        [
          "O levantamento nas nossas lojas do Glória Mall (Loja 2 e Loja 22, Maputo) é gratuito. Quando houver entrega ao domicílio, as opções aparecem no checkout.",
          "Collection from our Glória Mall stores (Store 2 and Store 22, Maputo) is free. When home delivery is available, the options are shown at checkout.",
        ],
      ),
    },
  },
  {
    key: "perguntas-frequentes",
    data: {
      body: P(
        [
          "Tem artigos em saldo ou promoção? — Os saldos realizam-se uma vez por ano, em Janeiro: a ocasião ideal para investir em peças exclusivas e de qualidade.",
          "Do you have sales or promotions? — Our sale happens once a year, in January: the perfect time to invest in exclusive, quality pieces.",
        ],
        ["Tem estacionamento? — O Glória Mall dispõe de parque para clientes.", "Is there parking? — Glória Mall has customer parking."],
        ["Que tamanhos tem? — Trabalhamos com peças desde o XXS até ao XXL (plus size).", "What sizes do you have? — Our pieces range from XXS to XXL (plus size)."],
        [
          "É preciso fazer marcação? — Para ver e experimentar Roupa de Festa e Executiva, não. Para a prova de vestidos de noiva, a marcação é obrigatória.",
          "Do I need an appointment? — Not to see and try on party and business wear. For wedding dress fittings, an appointment is required.",
        ],
        ["Posso experimentar? — Sim. Temos provadores espaçosos e consultoras experientes.", "Can I try things on? — Yes. We have spacious fitting rooms and experienced consultants."],
        [
          "Fazem atendimentos personalizados? — Para um atendimento personalizado e acesso a peças fora da colecção actual, marque pelo +258 84 105 5299.",
          "Do you offer personal styling? — For a personal appointment and access to pieces outside the current collection, book on +258 84 105 5299.",
        ],
        ["Alugam vestidos? — Não.", "Do you rent dresses? — No."],
        [
          "Aceitam encomendas? — Sim, de artigos das marcas que representamos. Mantemos stock para compra imediata em Maputo.",
          "Do you take special orders? — Yes, for the brands we represent. We keep stock for immediate purchase in Maputo.",
        ],
        [
          "Os artigos estão disponíveis ou são por encomenda? — Todas as peças expostas estão disponíveis para compra imediata, no tamanho e cor indicados.",
          "Are items in stock or made to order? — Every piece shown is available to buy now, in the size and colour indicated.",
        ],
        ["Vendem acessórios? — Sim: acessórios de festa e para o dia a dia, e bijuteria.", "Do you sell accessories? — Yes: party and everyday accessories, and jewellery."],
        [
          "Qual o vosso horário? — Segunda a sábado 09h00–19h00; domingos e feriados 10h00–15h00.",
          "What are your opening hours? — Monday to Saturday 9:00–19:00; Sundays and holidays 10:00–15:00.",
        ],
        [
          "Onde estão? — No Glória Mall, Loja 2 (Eterna) e Loja 22 (Eterna Bridal), Maputo.",
          "Where are you? — At Glória Mall, Store 2 (Eterna) and Store 22 (Eterna Bridal), Maputo.",
        ],
      ),
    },
  },
];
