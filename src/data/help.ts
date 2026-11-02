import type { IconName } from "@/components/ui/Icon";
import type { Localized } from "@/types";

/**
 * EN: Texts of "Como comprar" and "Programa de fidelidade" (design V3), written from the Eterna and Eterna Bridal terms
 *     and the old site, in the third person. Loyalty levels: Rubi 0–29 · 0%, Safira 30–69 · 5%, Pérola 70–119 · 10%,
 *     Diamante 120+ · 15% (1 000 MT = 1 point), the same as the old eterna.co.mz.
 * PT: Textos de "Como comprar" e "Programa de fidelidade" (V3), a partir dos termos da Eterna e da Eterna Bridal e do
 *     site antigo. Níveis de fidelidade iguais aos do eterna.co.mz antigo.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });

export const FINAL_SALE = L(
  "Todas as vendas da ETERNA são finais, não sendo aceites trocas nem devoluções.",
  "All ETERNA sales are final; exchanges and returns are not accepted.",
);

export interface HelpSection {
  id: string;
  icon: IconName;
  title: Localized;
  paragraphs: Localized[];
}

export const HOW_TO_BUY: HelpSection[] = [
  {
    id: "comprar",
    icon: "bag",
    title: L("Comprar", "Buying"),
    paragraphs: [
      L(
        "Escolha a cor e o tamanho, junte ao carrinho e escolha o que compra agora: o resto fica guardado no carrinho.",
        "Choose the colour and size, add to the bag and choose what you buy now: the rest stays saved in the bag.",
      ),
      L(
        "Com conta, os seus dados já vêm preenchidos e o desconto do seu nível aplica-se sozinho. Antes de pagar, aceite os termos e condições de compra.",
        "With an account, your details are already filled in and your level's discount applies by itself. Before paying, accept the terms and conditions of sale.",
      ),
    ],
  },
  {
    id: "reservar",
    icon: "hourglass",
    title: L("Reservar", "Reserving"),
    paragraphs: [
      L(
        "Escolha a peça que deseja reservar e pague 50% do valor total como sinal. A peça fica separada em seu nome por um período máximo de 30 dias; nos vestidos de noiva e nas peças da Eterna Bridal, 60 dias.",
        "Choose the piece you want to reserve and pay 50% of the total as a deposit. The piece is set aside in your name for up to 30 days; for wedding dresses and Eterna Bridal pieces, 60 days.",
      ),
      L(
        "No levantamento, liquida os 50% restantes e conclui a sua compra. Após o prazo, a reserva é automaticamente cancelada e o valor do sinal não é reembolsável.",
        "When you collect it, you pay the remaining 50% and complete your purchase. After the time limit, the reservation is cancelled automatically and the deposit is not refundable.",
      ),
      L(
        "As reservas destinam-se apenas a garantir a disponibilidade, não sendo possível trocar a peça reservada por outra.",
        "Reservations only guarantee availability; the reserved piece cannot be exchanged for another.",
      ),
    ],
  },
  {
    id: "pagamento",
    icon: "lock",
    title: L("Pagamento", "Payment"),
    paragraphs: [
      L(
        "Cartão Visa ou Mastercard, PayPal, M-Pesa, e-Mola, mKesh ou transferência bancária. Nos pagamentos por telemóvel, introduza o PIN no seu telemóvel: o site nunca o pede.",
        "Visa or Mastercard, PayPal, M-Pesa, e-Mola, mKesh or bank transfer. For mobile payments, enter your PIN on your phone: the site never asks for it.",
      ),
    ],
  },
  {
    id: "levantamento",
    icon: "store",
    title: L("Levantamento e entrega", "Collection and delivery"),
    paragraphs: [
      L("Levante grátis no Glória Mall. Avisamos por WhatsApp quando a encomenda estiver pronta.", "Collect free of charge at Glória Mall. We let you know on WhatsApp when your order is ready."),
      L(
        "Com a entrega ao domicílio ligada, escolha a morada no checkout: a taxa da sua zona aparece antes de pagar.",
        "When home delivery is available, choose your address at checkout: your area's fee is shown before you pay.",
      ),
    ],
  },
  {
    id: "trocas",
    icon: "return",
    title: L("Trocas e devoluções", "Exchanges and returns"),
    paragraphs: [
      L(`${FINAL_SALE.pt} Esta regra vale para as compras na loja e no site.`, `${FINAL_SALE.en} This applies to purchases in store and online.`),
      L(
        "Criamos todas as condições para que possa experimentar as suas peças com conforto e acompanhamento das nossas consultoras. Antes do pagamento, verifique com cuidado a peça escolhida e o tamanho; em caso de dúvida, recomendamos a compra presencial na nossa loja.",
        "We make sure you can try on your pieces in comfort, with our consultants by your side. Before paying, check the chosen piece and size carefully; if in doubt, we recommend buying in our store.",
      ),
    ],
  },
  {
    id: "fidelidade",
    icon: "gem",
    title: L("Programa de fidelidade", "Loyalty programme"),
    paragraphs: [
      L(
        "Cada 1 000 MT em compras dá 1 ponto, online e na loja, incluindo a Eterna Bridal. Em janeiro, o seu nível do ano é definido pelos pontos do ano anterior.",
        "Every 1,000 MT spent earns 1 point, online and in store, including Eterna Bridal. In January, your level for the year is set by the previous year's points.",
      ),
    ],
  },
  {
    id: "prova",
    icon: "dress",
    title: L("Eterna Bridal · prova de noiva", "Eterna Bridal · bridal fitting"),
    paragraphs: [
      L(
        "As provas fazem-se no showroom privativo da Eterna Bridal (Glória Mall, Loja 22), só por marcação. O showroom fica reservado para a noiva e até 2 acompanhantes.",
        "Fittings take place in the private Eterna Bridal showroom (Glória Mall, Store 22), by appointment only. The showroom is reserved for the bride and up to 2 companions.",
      ),
      L(
        "Seleccione antes, no catálogo, os vestidos que deseja provar: a prova inclui apenas esses vestidos. Para provar outros, é necessário marcar nova prova.",
        "Select in the catalogue beforehand the dresses you want to try: the fitting includes only those dresses. To try others, a new fitting must be booked.",
      ),
    ],
  },
  {
    id: "marcacao",
    icon: "calendar",
    title: L("Eterna Bridal · marcação", "Eterna Bridal · booking"),
    paragraphs: [
      L(
        "Marque com pelo menos 48 horas de antecedência, no site ou pelo WhatsApp da Eterna Bridal (84 073 3688). A data e a hora ficam sujeitas à disponibilidade da agenda.",
        "Book at least 48 hours in advance, online or on the Eterna Bridal WhatsApp (84 073 3688). The date and time are subject to availability.",
      ),
      L(
        "A prova começa e termina à hora marcada, mesmo com atraso. Cancelamentos ou remarcações: avise com pelo menos 24 horas de antecedência. Se não comparecer sem aviso, o valor pago passa a taxa de serviço.",
        "The fitting starts and ends at the booked time, even if you are late. Cancellations or changes: let us know at least 24 hours in advance. If you do not come without notice, the amount paid becomes a service fee.",
      ),
    ],
  },
  {
    id: "pacotes",
    icon: "card",
    title: L("Eterna Bridal · pacotes e pagamento", "Eterna Bridal · packages and payment"),
    paragraphs: [
      L(
        "**Satin** · até 3 vestidos · 1 hora · 3 000,00 MT. **Silk** · até 5 vestidos · 2 horas · 5 000,00 MT. **Cashmere** (brevemente) · até 6 vestidos · 3 horas · bebidas do menu especial (pagas à parte) e fotografias autorizadas · 7 500,00 MT.",
        "**Satin** · up to 3 dresses · 1 hour · 3,000.00 MT. **Silk** · up to 5 dresses · 2 hours · 5,000.00 MT. **Cashmere** (coming soon) · up to 6 dresses · 3 hours · drinks from the special menu (paid separately) and authorised photographs · 7,500.00 MT.",
      ),
      L(
        "Em qualquer pacote pode juntar até 3 vestidos extra, a 1 000,00 MT cada, escolhidos no catálogo no acto da marcação.",
        "Any package can include up to 3 extra dresses, at 1,000.00 MT each, chosen from the catalogue when booking.",
      ),
      L(
        "A marcação fica confirmada com o pagamento, que implica a aceitação dos termos e condições da Eterna Bridal. O valor desconta no preço final do vestido se o comprar na Eterna Bridal até 30 dias depois da prova; depois desse prazo, é taxa de serviço e não é reembolsável.",
        "The booking is confirmed with the payment, which means accepting the Eterna Bridal terms and conditions. The amount is deducted from the dress price if you buy it at Eterna Bridal within 30 days of the fitting; after that, it is a non-refundable service fee.",
      ),
    ],
  },
  {
    id: "cuidados",
    icon: "sparkle",
    title: L("Eterna Bridal · cuidados com os vestidos", "Eterna Bridal · caring for the dresses"),
    paragraphs: [
      L(
        "Uma consultora acompanha toda a prova e ajuda a vestir e despir cada peça. No dia da prova, não use maquilhagem, jóias, cremes, óleos corporais ou perfumes intensos.",
        "A consultant is with you throughout the fitting and helps you in and out of each piece. On the day, please do not wear make-up, jewellery, creams, body oils or strong perfume.",
      ),
      L(
        "Danos nos vestidos por incumprimento destas regras podem implicar custos de limpeza ou reparação. Não é permitido comer ou beber na loja (excepto no pacote Cashmere); fotografar ou filmar só com autorização da Eterna Bridal.",
        "Damage to dresses caused by not following these rules may incur cleaning or repair costs. Eating or drinking in the store is not allowed (except in the Cashmere package); photos or videos only with Eterna Bridal's permission.",
      ),
    ],
  },
];

export interface LoyaltyLevel {
  key: "rubi" | "safira" | "perola" | "diamante";
  name: Localized;
  min: number;
  max: number | null;
  pct: number;
  icon: IconName;
  color: string;
}

export const LOYALTY_LEVELS: LoyaltyLevel[] = [
  { key: "rubi", name: L("Rubi", "Ruby"), min: 0, max: 29, pct: 0, icon: "levelRubi", color: "#9B2335" },
  { key: "safira", name: L("Safira", "Sapphire"), min: 30, max: 69, pct: 5, icon: "levelSafira", color: "#2B4C8C" },
  { key: "perola", name: L("Pérola", "Pearl"), min: 70, max: 119, pct: 10, icon: "levelPerola", color: "#9C8664" },
  { key: "diamante", name: L("Diamante", "Diamond"), min: 120, max: null, pct: 15, icon: "levelDiamante", color: "#5E7A8C" },
];

export const LOYALTY_STEPS: { icon: IconName; title: Localized; body: Localized }[] = [
  { icon: "user", title: L("Crie a sua conta", "Create your account"), body: L("É grátis. As suas compras ficam associadas ao seu nome e ao seu número.", "It's free. Your purchases are linked to your name and number.") },
  {
    icon: "bag",
    title: L("Compre e acumule", "Shop and collect"),
    body: L("1 000 MT = 1 ponto, online e nas lojas. As reservas contam quando estiverem pagas por inteiro.", "1,000 MT = 1 point, online and in store. Reservations count once fully paid."),
  },
  {
    icon: "calendar",
    title: L("Em janeiro, o nível ajusta-se", "In January, your level adjusts"),
    body: L("Analisamos as compras do ano anterior: pode subir, manter ou descer de nível.", "We look at the previous year's purchases: you can move up, stay or move down a level."),
  },
];

export const LOYALTY_RULES: Localized[] = [
  L("O desconto aplica-se sozinho no checkout, com a sessão iniciada.", "The discount applies by itself at checkout, when you are signed in."),
  L("Aplica-se também a reservas e às compras da Eterna Bridal, incluindo vestidos de noiva.", "It also applies to reservations and Eterna Bridal purchases, including wedding dresses."),
  L("Não se junta a saldos nem a campanhas: aplicamos sempre o maior dos dois.", "It does not add to sales or campaigns: we always apply the larger of the two."),
  L("Os pontos contam sobre o valor pago. Encomendas canceladas não dão pontos.", "Points count on the amount paid. Cancelled orders earn no points."),
];
