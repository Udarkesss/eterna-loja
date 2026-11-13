import type { Localized } from "@/types";

/**
 * EN: Initial content of the home page of design V3 (Início 1/2 and 2/2). The team edits it later in
 *     Gestão → Conteúdo do site. In titles, words between *asterisks* are shown in italics. Images are the design's
 *     (public/images/v3); the mission, vision, values and the founder's words are the old eterna.co.mz's.
 * PT: Conteúdo inicial do Início do design V3. A equipa edita-o depois em Gestão → Conteúdo do site. Nos títulos, as
 *     palavras entre *asteriscos* aparecem em itálico. As imagens são as do design; a missão, a visão, os valores e as
 *     palavras da fundadora são os do eterna.co.mz antigo.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });
const V3 = (key: string) => `/images/v3/${key}.webp`;

export interface SectionSeed {
  key: string;
  data: Record<string, unknown>;
}

/** EN: Keys of the V3 home, in order. PT: Chaves do Início V3, por ordem. */
export const HOME_KEYS = [
  "announcement",
  "hero",
  "entrada",
  "colecao",
  "ocasioes",
  "novidades",
  "noivas",
  "acessorios",
  "modeladores",
  "sobre",
  "contactos",
] as const;

/** EN: Hero slides of design V3. PT: Slides do topo do V3. */
export const heroSlides = [
  {
    image: V3("s-festa"),
    position: "center 22%",
    eyebrow: L("Colecção II · 2026", "Collection II · 2026"),
    title: L("Essenza", "Essenza"),
    text: L("Do escritório à gala: a colecção que está agora na loja.", "From the office to the gala: the collection now in store."),
    cta: L("Comprar Essenza", "Shop Essenza"),
    href: "category:essenza",
    on: true,
  },
  {
    image: V3("s-convidada"),
    position: "center 22%",
    eyebrow: L("Ocasiões", "Occasions"),
    title: L("Convidada", "Wedding guest"),
    text: L("Bem vestida, sem roubar o momento.", "Beautifully dressed, without stealing the moment."),
    cta: L("Ver Convidada", "See Wedding guest"),
    href: "category:convidada",
    on: true,
  },
  {
    image: V3("s-ocasioes"),
    position: "center 25%",
    eyebrow: L("Peça em destaque", "Featured piece"),
    title: L("7G184", "7G184"),
    text: L("Vestido cocktail de um ombro só, com laço escultórico.", "One-shoulder cocktail dress with a sculpted bow."),
    cta: L("Ver a peça", "See the piece"),
    href: "product:7g184",
    on: true,
  },
];

export const homeSections: SectionSeed[] = [
  {
    key: "announcement",
    data: {
      // EN: fixed = above the header, scrolls away · auto = over the page, hides going down and returns going up · off.
      // PT: fixed = por cima do cabeçalho, sai ao descer · auto = sobre a página, esconde ao descer e volta ao subir · off.
      mode: "fixed",
      messages: [
        L("Cartão, M-Pesa, e-Mola ou mKesh", "Card, M-Pesa, e-Mola or mKesh"),
        L("Glória Mall · loja e showroom Bridal", "Glória Mall · store and Bridal showroom"),
        L("WhatsApp +258 84 073 3688", "WhatsApp +258 84 073 3688"),
      ],
      startsAt: null,
      endsAt: null,
    },
  },
  {
    key: "hero",
    data: {
      media: "video",
      videoDesktop: "/videos/hero-principal.mp4",
      videoMobile: "/videos/hero-principal.mp4",
      poster: V3("hero-principal-poster"),
      posterMobile: V3("hero-principal-poster"),
      image: V3("s-festa"),
      videoLabel: L("Vídeo: a loja Eterna no Glória Mall", "Video: the Eterna store at Glória Mall"),
      imageAlt: L("Colecção Essenza", "Essenza collection"),
      videoBadge: L("Colecção II · Essenza", "Collection II · Essenza"),
      imageBadge: L("Colecção II · Essenza", "Collection II · Essenza"),
      showTitle: true,
      title: L("Vestida para os momentos que *ficam*.", "Dressed for the moments that *stay*."),
      cta: { label: L("Comprar Essenza", "Shop Essenza"), href: "category:essenza" },
      parallax: true,
      parallaxIntensity: 0.25,
      // EN: "Slides" mode of the hero (design V3, chosen in Gestão → Vídeo, parallax e ocasiões).
      // PT: Modo "Slides" do topo (V3, escolhido em Gestão → Vídeo, parallax e ocasiões).
      slides: heroSlides,
      slidesAuto: false,
    },
  },
  {
    key: "entrada",
    data: {
      eyebrow: L("Moda feminina de luxo · Maputo, desde 2011", "Luxury womenswear · Maputo, since 2011"),
      title: L("Onde o *seu* momento\nse torna *eterno*.", "Where *your* moment\nbecomes *eternal*."),
      body: L(
        "Descubra a **Essenza**, a nova colecção Eterna que celebra a mulher através da **elegância, sofisticação, versatilidade e feminilidade**, do universo executivo às ocasiões especiais.",
        "Discover **Essenza**, the new Eterna collection celebrating women through **elegance, sophistication, versatility and femininity**, from the business world to special occasions.",
      ),
      cta: { label: L("Descobrir Essenza", "Discover Essenza"), href: "category:essenza" },
    },
  },
  {
    key: "colecao",
    data: {
      collection: "essenza",
      cue: L("Descobrir a colecção", "Discover the collection"),
      lines: [
        {
          eyebrow: L("Roupa de Festa", "Party Wear"),
          title: L("Brilho para a noite, do cocktail à gala.", "Sparkle for the evening, from cocktail to gala."),
          image: V3("s-festa"),
          position: "center 22%",
          links: [
            { label: L("Novidades", "New in"), href: "category:essenza?linha=roupa-de-festa" },
            { label: L("Vestidos de festa", "Party dresses"), href: "category:roupa-de-festa" },
          ],
        },
        {
          eyebrow: L("Roupa Executiva", "Business Wear"),
          title: L("Corte impecável, do escritório à reunião.", "Impeccable tailoring, from the office to the meeting."),
          image: V3("t-blazers"),
          position: "center 0%",
          links: [
            { label: L("Novidades", "New in"), href: "category:essenza?linha=roupa-executiva" },
            { label: L("Fatos e blazers", "Suits and blazers"), href: "category:roupa-executiva" },
          ],
        },
      ],
    },
  },
  {
    key: "ocasioes",
    data: {
      eyebrow: L("Ocasiões", "Occasions"),
      title: L("Para cada *momento*", "For every *moment*"),
      linkLabel: L("Ver todas as ocasiões", "See all occasions"),
      href: "category:ocasioes",
      visible: 8,
    },
  },
  {
    key: "novidades",
    data: {
      title: L("Acabadas de chegar", "Just arrived"),
      subtitle: L("As últimas peças a chegar à loja", "The latest pieces in store"),
      linkLabel: L("Ver tudo", "See all"),
      href: "category:essenza?sort=newest",
      count: 8,
    },
  },
  {
    key: "noivas",
    data: {
      video: "/videos/bridal-abertura.mp4",
      poster: V3("bridal-abertura-poster"),
      videoLabel: L("Vídeo: Eterna Bridal, The White Collection", "Video: Eterna Bridal, The White Collection"),
      pill: L("Eterna Bridal · The White Collection", "Eterna Bridal · The White Collection"),
      title: L("Duas colecções, *uma essência*", "Two collections, *one essence*"),
      body: L(
        "Da leveza etérea da The White Collection ao esplendor escultórico da Eterna Privée: cada noiva encontra o vestido que traduz o seu sonho.",
        "From the ethereal lightness of The White Collection to the sculptural splendour of Eterna Privée: every bride finds the dress that tells her dream.",
      ),
      cards: [
        { eyebrow: L("Delicada, encantadora e intemporal", "Delicate, enchanting and timeless"), title: L("The White Collection", "The White Collection"), image: V3("t-white"), position: "center 20%", cta: L("Descobrir", "Discover"), href: "category:white-collection" },
        { eyebrow: L("Exclusividade com assinatura de luxo", "Exclusivity with a luxury signature"), title: L("Eterna Privée", "Eterna Privée"), image: V3("bridal-privee"), position: "center 35%", cta: L("Descobrir", "Discover"), href: "category:eterna-privee" },
        { eyebrow: L("Véus, tiaras e detalhes", "Veils, tiaras and details"), title: L("Acessórios de Noiva", "Bridal Accessories"), image: V3("bridal-acessorios"), position: "center 30%", cta: L("Ver acessórios", "See accessories"), href: "category:acessorios-noiva" },
      ],
      experience: {
        eyebrow: L("A experiência Eterna", "The Eterna experience"),
        title: L("Do primeiro olhar\nao *grande dia*", "From the first look\nto the *big day*"),
        body: L(
          "Seis passos, do vestido escolhido ao dia da prova no showroom privativo da Eterna Bridal.",
          "Six steps, from the chosen dress to the fitting day in the private Eterna Bridal showroom.",
        ),
        steps: [
          { title: L("Escolha os vestidos", "Choose the dresses"), body: L("Veja as colecções e guarde nos favoritos os vestidos que quer provar.", "Browse the collections and save the dresses you want to try in your favourites.") },
          { title: L("Seleccione o pacote", "Select the package"), body: L("Satin, Silk ou Cashmere: até 3, 5 ou 6 vestidos, de 1 a 3 horas.", "Satin, Silk or Cashmere: up to 3, 5 or 6 dresses, from 1 to 3 hours.") },
          { title: L("Escolha a data e hora", "Choose the date and time"), body: L("Marque online ou pelo WhatsApp. Atendemos uma noiva de cada vez.", "Book online or on WhatsApp. We see one bride at a time.") },
          { title: L("Introduza os seus dados", "Enter your details"), body: L("Nome, telefone e a data do casamento.", "Name, phone and wedding date.") },
          { title: L("Efectue o pagamento", "Make the payment"), body: L("Por M-Pesa, e-Mola ou cartão. O valor desconta no vestido se o comprar em 30 dias.", "By M-Pesa, e-Mola or card. The amount is deducted from the dress if you buy it within 30 days.") },
          { title: L("Viva a experiência Eterna", "Live the Eterna experience"), body: L("No showroom privativo do Glória Mall, com toda a atenção para si.", "In the private showroom at Glória Mall, with all our attention on you.") },
        ],
      },
      band: {
        eyebrow: L("Eterna Bridal · Glória Mall, Loja 22", "Eterna Bridal · Glória Mall, Store 22"),
        title: L("O seu dia, *eternizado*.", "Your day, *made eternal*."),
        body: L(
          "Cada detalhe, pensado para si. Marque a sua prova e venha conhecer as colecções com calma.",
          "Every detail, made for you. Book your fitting and come and discover the collections at your own pace.",
        ),
        note: L("Só por marcação · uma noiva de cada vez", "By appointment only · one bride at a time"),
      },
    },
  },
  {
    key: "acessorios",
    data: {
      eyebrow: L("Acessórios", "Accessories"),
      title: L("O detalhe que *completa*", "The detail that *completes*"),
      seconds: 10,
      tabs: [
        {
          label: L("Festa", "Party"),
          body: L("Pochettes, fascinators, echarpes, sapatos e bijuteria para completar o vestido de festa.", "Clutches, fascinators, scarves, shoes and jewellery to complete the party dress."),
          linkLabel: L("Ver acessórios de festa", "See party accessories"),
          href: "category:acessorios-festa",
          image: V3("s-acessorios-festa"),
          contain: false,
        },
        {
          label: L("Executivos", "Business"),
          body: L("Carteiras e sapatos para o dia-a-dia executivo, discretos e duradouros.", "Handbags and shoes for everyday business life, discreet and lasting."),
          linkLabel: L("Ver acessórios executivos", "See business accessories"),
          href: "category:acessorios-executivos",
          image: V3("t-carteiras"),
          contain: true,
        },
      ],
    },
  },
  {
    key: "modeladores",
    data: {
      eyebrow: L("Modeladores", "Shapewear"),
      title: L("A base de *tudo*", "The foundation of *everything*"),
      body: L(
        "Discretos, confortáveis e invisíveis por baixo do vestido. Alisam a silhueta para que a peça assente como deve.",
        "Discreet, comfortable and invisible under the dress. They smooth the silhouette so the piece sits as it should.",
      ),
      linkLabel: L("Ver modeladores", "See shapewear"),
      href: "category:modeladores",
      image: V3("s-modeladores"),
    },
  },
  {
    key: "sobre",
    data: {
      eyebrow: L("Sobre nós · desde 2011", "About us · since 2011"),
      title: L("Feita por mulheres,\npara *mulheres*", "Made by women,\nfor *women*"),
      body: L(
        "Desde 2011 vestimos a mulher moçambicana para os dias que ficam na memória — casamentos, galas, lobolos e a rotina executiva. Cada peça é escolhida pelo corte, pelo tecido e pelo detalhe.",
        "Since 2011 we have dressed Mozambican women for the days that stay in memory — weddings, galas, lobolos and working life. Every piece is chosen for its cut, its fabric and its detail.",
      ),
      quote: L(
        "“Quando sonhei a ETERNA, queria criar um espaço onde cada mulher se sentisse valorizada e confiante, independentemente da ocasião. Sempre acreditei que a moda vai além do vestir — é expressão de identidade, é memória, é emoção.”",
        "“When I dreamt of ETERNA, I wanted to create a place where every woman would feel valued and confident, whatever the occasion. I have always believed that fashion goes beyond dressing — it is identity, memory and emotion.”",
      ),
      founder: V3("s-fundadora"),
      founderCaption: L("A fundadora, na Eterna.", "The founder, at Eterna."),
      founderLabel: L("A fundadora", "The founder"),
      signature: V3("s-assinatura"),
      figures: [
        { value: L("2011", "2011"), label: L("Fundada em Maputo", "Founded in Maputo") },
        { value: L("1 loja e 1 showroom", "1 store and 1 showroom"), label: L("A loja e o showroom privativo da Eterna Bridal, no Glória Mall", "The store and the private Eterna Bridal showroom, at Glória Mall") },
        { value: L("1 noiva", "1 bride"), label: L("De cada vez, na Eterna Bridal", "At a time, at Eterna Bridal") },
      ],
      values: [
        {
          icon: "gem",
          title: L("Missão", "Mission"),
          body: L(
            "Proporcionar a cada mulher o look perfeito para os momentos mais especiais da sua vida, com atendimento personalizado e peças de excelência.",
            "To give every woman the perfect look for the most special moments of her life, with personal service and outstanding pieces.",
          ),
        },
        {
          icon: "star",
          title: L("Visão", "Vision"),
          body: L(
            "Ser a referência nacional em moda feminina de alta qualidade, reconhecida pela curadoria exclusiva, atendimento de excelência e experiência de loja irrepreensível.",
            "To be the national reference in high-quality womenswear, known for exclusive curation, excellent service and a flawless in-store experience.",
          ),
        },
        {
          icon: "heart",
          title: L("Valores", "Values"),
          body: L(
            "Elegância atemporal, qualidade excepcional, atendimento personalizado e compromisso com a satisfação de cada cliente.",
            "Timeless elegance, exceptional quality, personal service and a commitment to every client's satisfaction.",
          ),
        },
      ],
      team: V3("s-equipa"),
      teamTitle: L("A nossa equipa", "Our team"),
      teamCaption: L(
        "Feita por mulheres, para mulheres: sensibilidade estética, profissionalismo e dedicação, do primeiro olhar ao grande dia.",
        "Made by women, for women: an eye for beauty, professionalism and dedication, from the first look to the big day.",
      ),
      socialEyebrow: L("Siga a Eterna", "Follow Eterna"),
      socialTitle: L("@eterna.dresses *& @eterna.bridal*", "@eterna.dresses *& @eterna.bridal*"),
      socialImages: [V3("occ-namorados"), V3("t-white2"), V3("bridal-privee"), V3("occ-gala"), V3("s-convidada"), V3("t-privee3")],
    },
  },
  {
    key: "contactos",
    data: {
      eyebrow: L("Contacte-nos", "Contact us"),
      title: L("Visite-nos no *Glória Mall*", "Visit us at *Glória Mall*"),
      stores: [
        {
          code: "02",
          image: V3("s-loja2"),
          eyebrow: L("A loja · Glória Mall, Loja 2", "The store · Glória Mall, Store 2"),
          name: L("Eterna", "Eterna"),
          description: L("Roupa de Festa, Executiva e Acessórios.", "Party wear, business wear and accessories."),
          action: "whatsapp",
        },
        {
          code: "22",
          image: V3("s-loja22"),
          eyebrow: L("Showroom privativo · Glória Mall, Loja 22", "Private showroom · Glória Mall, Store 22"),
          name: L("Eterna · Bridal Showroom", "Eterna · Bridal Showroom"),
          description: L(
            "Exclusividade, privacidade e atenção a cada detalhe. Atendimento apenas por marcação.",
            "Exclusivity, privacy and attention to every detail. By appointment only.",
          ),
          action: "fitting",
        },
      ],
      mapsUrl: "https://maps.google.com/?q=Gl%C3%B3ria+Mall+Maputo",
    },
  },
];

export interface OccasionTileSeed {
  name: Localized;
  phrase: Localized;
  imageUrl: string;
  category: string;
  size: "large" | "tall" | "normal";
}

/** EN: "Para cada momento" mosaic of design V3, in order. PT: Mosaico "Para cada momento" do V3, por ordem. */
export const occasionTiles: OccasionTileSeed[] = [
  { name: L("Casamento", "Wedding"), phrase: L("Para a noiva e para quem a acompanha.", "For the bride and those beside her."), imageUrl: V3("occ-casamento"), category: "noivas", size: "large" },
  { name: L("Gala", "Gala"), phrase: L("Silhuetas longas, brilho discreto.", "Long silhouettes, quiet sparkle."), imageUrl: V3("occ-gala"), category: "gala", size: "tall" },
  { name: L("Aniversário", "Birthday"), phrase: L("A sua festa, o seu vestido.", "Your party, your dress."), imageUrl: V3("occ-aniversario"), category: "convidada", size: "normal" },
  { name: L("Dia dos Namorados", "Valentine's Day"), phrase: L("Em vermelho, claro.", "In red, of course."), imageUrl: V3("occ-namorados"), category: "convidada", size: "normal" },
  { name: L("Finalistas & Debutantes", "Graduation & Debutante"), phrase: L("O primeiro grande baile.", "The first big ball."), imageUrl: V3("occ-formatura"), category: "finalistas-debutantes", size: "normal" },
  { name: L("Dia da Mãe", "Mother's Day"), phrase: L("Para oferecer ou para brilhar.", "To give, or to shine."), imageUrl: V3("occ-mae"), category: "madrinha-mae-noiva", size: "normal" },
  { name: L("Noivado & Lobolo", "Engagement & Lobolo"), phrase: L("O primeiro grande sim.", "The first big yes."), imageUrl: V3("occ-noivado"), category: "noivado-lobolo", size: "normal" },
  { name: L("Evento Corporativo", "Corporate Event"), phrase: L("Elegância que trabalha consigo.", "Elegance that works with you."), imageUrl: V3("occ-corporativo"), category: "evento-corporativo", size: "normal" },
  { name: L("Convidada", "Wedding guest"), phrase: L("Bem vestida, sem roubar o momento.", "Well dressed, without stealing the moment."), imageUrl: V3("s-convidada"), category: "convidada", size: "normal" },
  { name: L("Madrinha & Mãe da Noiva", "Bridesmaid & Mother of the Bride"), phrase: L("Ao lado da noiva, com classe.", "Beside the bride, with class."), imageUrl: V3("t-fatos-cerimonia"), category: "madrinha-mae-noiva", size: "normal" },
];
