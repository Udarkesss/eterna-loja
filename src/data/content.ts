import type { Localized } from "@/types";

/**
 * EN: Initial content of the home page, copied from the design (Início). The team edits it later in
 *     Gestão · 8 Conteúdo do site. In titles, words between *asterisks* are shown in italics.
 * PT: Conteúdo inicial do Início, copiado do design. A equipa edita-o depois em Gestão · 8 Conteúdo do site.
 *     Nos títulos, as palavras entre *asteriscos* aparecem em itálico.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });

export interface SectionSeed {
  key: string;
  data: Record<string, unknown>;
}

export const homeSections: SectionSeed[] = [
  {
    key: "announcement",
    data: {
      messages: [
        L("Cartão, M-Pesa, e-Mola ou mKesh", "Card, M-Pesa, e-Mola or mKesh"),
        L("Visite-nos no Glória Mall — Lojas 02 e 22", "Visit us at Glória Mall — Stores 02 and 22"),
        L("Apoio +258 82 487 6300", "Support +258 82 487 6300"),
      ],
      startsAt: null,
      endsAt: null,
    },
  },
  {
    key: "hero",
    data: {
      media: "video",
      videoDesktop: "/videos/hero-desktop.mp4",
      videoMobile: "/videos/hero-mobile.mp4",
      poster: "/images/content/hero-poster.jpg",
      posterMobile: "/images/content/hero-poster-mobile.jpg",
      image: "/images/content/hero-beyond-time.webp",
      videoLabel: L(
        "Vídeo: noiva com vestido de renda da The White Collection",
        "Video: bride in a lace dress from The White Collection",
      ),
      imageAlt: L(
        "Duas modelos com vestidos longos de um ombro, vermelho e preto, da colecção Beyond Time",
        "Two models in one-shoulder long dresses, red and black, from the Beyond Time collection",
      ),
      videoBadge: L("Eterna Bridal · The White Collection", "Eterna Bridal · The White Collection"),
      imageBadge: L("Nova colecção · Beyond Time", "New collection · Beyond Time"),
      parallax: true,
      parallaxIntensity: 0.25,
    },
  },
  {
    key: "manifesto",
    data: {
      eyebrow: L("Moda feminina de luxo · Maputo, desde 2011", "Luxury womenswear · Maputo, since 2011"),
      title: L("Onde o *seu* momento\nse torna *eterno*.", "Where *your* moment\nbecomes *eternal*."),
      body: L(
        "Desde 2011 vestimos a mulher moçambicana para os dias que ficam na memória — casamentos, galas, lobolos e a rotina executiva. Cada peça é escolhida pelo corte, pelo tecido e pelo detalhe.",
        "Since 2011 we have dressed Mozambican women for the days that stay in memory — weddings, galas, lobolos and working life. Every piece is chosen for its cut, its fabric and its detail.",
      ),
      primaryCta: { label: L("Comprar Beyond Time", "Shop Beyond Time"), href: "category:beyond-time" },
      secondaryCta: { label: L("Marcar prova", "Book a fitting"), href: "#prova" },
    },
  },
  {
    key: "occasions",
    data: {
      eyebrow: L("Ocasiões especiais", "Special occasions"),
      title: L("Para cada *momento*", "For every *moment*"),
      linkLabel: L("Ver todas as ocasiões", "See all occasions"),
      href: "category:ocasioes",
    },
  },
  {
    key: "new_arrivals",
    data: {
      eyebrow: L("Novidades", "New in"),
      title: L("Acabadas de *chegar*", "Just *arrived*"),
      linkLabel: L("Ver tudo", "View all"),
      href: "category:beyond-time",
    },
  },
  {
    key: "privee_divider",
    data: {
      image: "/images/content/eterna-privee.webp",
      alt: L("Noiva com vestido de renda num corredor de mármore", "Bride in a lace dress in a marble corridor"),
      badge: L("Eterna Privée · Silhuetas escultóricas", "Eterna Privée · Sculptural silhouettes"),
    },
  },
  {
    key: "bridal",
    data: {
      eyebrow: L("Eterna Bridal", "Eterna Bridal"),
      title: L("Duas colecções, *uma essência*", "Two collections, *one essence*"),
      body: L(
        "Da leveza etérea da The White Collection ao esplendor escultórico da Eterna Privée — cada noiva encontra o vestido que traduz o seu sonho.",
        "From the ethereal lightness of The White Collection to the sculptural splendour of Eterna Privée — every bride finds the dress that tells her dream.",
      ),
      cards: [
        {
          image: "/images/content/white-collection.webp",
          alt: L("Noiva com vestido de tule fluido num terraço", "Bride in a flowing tulle dress on a terrace"),
          eyebrow: L("Leveza etérea e fluidez", "Ethereal lightness and flow"),
          title: L("The White Collection", "The White Collection"),
          cta: L("Descobrir", "Discover"),
          href: "category:white-collection",
        },
        {
          image: "/images/content/eterna-privee.webp",
          alt: L("Noiva com vestido de renda e decote em V num corredor de mármore", "Bride in a lace V-neck dress in a marble corridor"),
          eyebrow: L("Silhuetas dramáticas", "Dramatic silhouettes"),
          title: L("Eterna Privée", "Eterna Privée"),
          cta: L("Descobrir", "Discover"),
          href: "category:eterna-privee",
        },
        {
          image: "/images/content/bridal-accessories.webp",
          alt: L("Acessórios de noiva: véu e tiara", "Bridal accessories: veil and tiara"),
          eyebrow: L("Véus, tiaras e detalhes", "Veils, tiaras and details"),
          title: L("Acessórios de Noiva", "Bridal Accessories"),
          cta: L("Ver acessórios", "See accessories"),
          href: "category:acessorios-noiva",
        },
      ],
    },
  },
  {
    key: "experience",
    data: {
      eyebrow: L("A experiência Eterna", "The Eterna experience"),
      title: L("Do primeiro olhar\nao *grande dia*", "From first glance\nto the *big day*"),
      body: L(
        "Compre online ou venha experimentar. A nossa equipa acompanha cada escolha, da reserva ao levantamento no Glória Mall.",
        "Shop online or come and try on. Our team guides every choice, from reservation to collection at Glória Mall.",
      ),
      steps: [
        { title: L("Agende a prova", "Book a fitting"), body: L("Escolha o dia online ou pelo WhatsApp.", "Choose the day online or on WhatsApp.") },
        {
          title: L("Experimente na loja", "Try it on in store"),
          body: L("Na Loja 22 para noivas, na Loja 02 para ocasiões.", "Store 22 for brides, Store 02 for occasions."),
        },
        {
          title: L("Reserve a sua peça", "Reserve your piece"),
          body: L("Pague com M-Pesa ou e-Mola e garanta o seu tamanho.", "Pay with M-Pesa or e-Mola and secure your size."),
        },
        { title: L("Celebre", "Celebrate"), body: L("Levante no Glória Mall ou receba em casa.", "Collect at Glória Mall or receive it at home.") },
      ],
    },
  },
  {
    key: "privee_band",
    data: {
      eyebrow: L("Eterna Bridal · Glória Mall, Loja 22", "Eterna Bridal · Glória Mall, Store 22"),
      title: L("O seu dia, *eternizado*.", "Your day, made *eternal*."),
      body: L(
        "Cada detalhe, pensado para si. Marque a sua prova e venha conhecer as colecções com calma.",
        "Every detail, designed for you. Book a fitting and come and discover the collections at your own pace.",
      ),
      cta: L("Marcar prova", "Book a fitting"),
      whatsapp: "258840733688",
    },
  },
  {
    key: "secure",
    data: {
      items: [
        {
          icon: "phone",
          title: L("Pagamento seguro", "Secure payment"),
          body: L(
            "Cartão Visa ou Mastercard, M-Pesa, e-Mola e mKesh. Nunca lhe pedimos o PIN no site.",
            "Visa or Mastercard, M-Pesa, e-Mola and mKesh. We never ask for your PIN on the website.",
          ),
          showPaymentLogos: true,
        },
        {
          icon: "store",
          title: L("Levantamento em loja", "Collect in store"),
          body: L("Reserve online e levante no Glória Mall, Lojas 02 e 22.", "Reserve online and collect at Glória Mall, Stores 02 and 22."),
        },
        {
          icon: "truck",
          title: L("Envios", "Delivery"),
          body: L("Receba em casa. Consulte zonas e prazos antes de pagar.", "Receive it at home. Check zones and times before you pay."),
        },
        {
          icon: "return",
          title: L("Trocas & devoluções", "Exchanges & returns"),
          body: L("Condições claras, explicadas antes de pagar.", "Clear conditions, explained before you pay."),
        },
      ],
    },
  },
  {
    key: "stores",
    data: {
      eyebrow: L("Visite-nos", "Visit us"),
      title: L("As nossas *lojas*", "Our *stores*"),
      image: "/images/content/store-interior.webp",
      alt: L("Interior da loja Eterna no Glória Mall", "Inside the Eterna store at Glória Mall"),
      hoursLine: L("Horário: [SEG–SÁB 00:00–00:00] · apoio@eterna.co.mz", "Hours: [MON–SAT 00:00–00:00] · apoio@eterna.co.mz"),
    },
  },
  {
    key: "social",
    data: {
      eyebrow: L("Siga a Eterna", "Follow Eterna"),
      title: L("@eterna.dresses *& @eterna.bridal*", "@eterna.dresses *& @eterna.bridal*"),
      images: [
        "/images/content/hero-beyond-time.webp",
        "/images/content/white-collection.webp",
        "/images/content/eterna-privee.webp",
        "/images/occasions/gala.webp",
        "/images/occasions/aniversario.webp",
        "/images/products/8g106/01.webp",
      ],
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

/** EN: "Para cada momento" mosaic, in design order. PT: Mosaico "Para cada momento", pela ordem do design. */
export const occasionTiles: OccasionTileSeed[] = [
  { name: L("Casamento", "Wedding"), phrase: L("Para a noiva e para quem a acompanha.", "For the bride and those beside her."), imageUrl: "/images/content/white-collection.webp", category: "noivas", size: "large" },
  { name: L("Gala", "Gala"), phrase: L("Silhuetas longas, brilho discreto.", "Long silhouettes, quiet sparkle."), imageUrl: "/images/occasions/gala.webp", category: "gala", size: "tall" },
  { name: L("Aniversário", "Birthday"), phrase: L("A sua festa, o seu vestido.", "Your party, your dress."), imageUrl: "/images/occasions/aniversario.webp", category: "convidada", size: "normal" },
  { name: L("Dia dos Namorados", "Valentine's Day"), phrase: L("Em vermelho, claro.", "In red, of course."), imageUrl: "/images/content/hero-beyond-time.webp", category: "convidada", size: "normal" },
  { name: L("Formatura", "Graduation"), phrase: L("Finalistas & debutantes.", "Graduates & debutantes."), imageUrl: "/images/occasions/formatura.webp", category: "finalistas-debutantes", size: "normal" },
  { name: L("Dia da Mãe", "Mother's Day"), phrase: L("Para oferecer ou para brilhar.", "To give, or to shine."), imageUrl: "/images/occasions/dia-da-mae.webp", category: "madrinha-mae-noiva", size: "normal" },
  { name: L("Noivado & Lobolo", "Engagement & Lobolo"), phrase: L("O primeiro grande sim.", "The first big yes."), imageUrl: "/images/occasions/noivado-lobolo.webp", category: "noivado-lobolo", size: "normal" },
  { name: L("Evento Corporativo", "Corporate Event"), phrase: L("Elegância que trabalha consigo.", "Elegance that works with you."), imageUrl: "/images/occasions/evento-corporativo.webp", category: "evento-corporativo", size: "normal" },
];
