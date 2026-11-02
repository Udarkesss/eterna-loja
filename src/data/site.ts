import type { Localized, PaymentMethod } from "@/types";
import { FITTING_SETTINGS_DEFAULT } from "./fittings";

/**
 * EN: Store-wide data from the design: stores, contacts, social links, menu, payment methods, delivery zones
 *     and the role/permission matrix. Values that change per environment come from .env.local.
 * PT: Dados gerais da loja vindos do design: lojas, contactos, redes, menu, métodos de pagamento, zonas de
 *     entrega e matriz de papéis. Valores que mudam por ambiente vêm do .env.local.
 */

const L = (pt: string, en: string): Localized => ({ pt, en });

export const site = {
  name: "Eterna",
  foundedYear: 2011,
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "apoio@eterna.co.mz",
  supportPhone: "+258 82 487 6300",
  // EN: Main WhatsApp of the old eterna.co.mz. PT: WhatsApp principal do eterna.co.mz antigo.
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "258840733688",
  social: [
    { key: "instagram", label: "Instagram", handle: "@eterna.dresses", url: "https://www.instagram.com/eterna.dresses/" },
    { key: "instagram", label: "Bridal", handle: "@eterna.bridal", url: "https://www.instagram.com/eterna.bridal/" },
    { key: "facebook", label: "Facebook", handle: "Eterna Dresses", url: "https://www.facebook.com/share/1A3tHGxafB/" },
    { key: "tiktok", label: "TikTok", handle: "@eterna.dresses", url: "https://www.tiktok.com/@eterna.dresses" },
    { key: "whatsapp", label: "WhatsApp", handle: "+258 84 073 3688", url: "https://wa.me/258840733688" },
  ] as const,
};

export function whatsappLink(message?: string, number: string = site.whatsapp): string {
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}

/**
 * EN: Glória Mall stores, with the data of the old eterna.co.mz (contacts and FAQ "Qual o vosso horário?").
 * PT: Lojas do Glória Mall, com os dados do eterna.co.mz antigo (contactos e FAQ "Qual o vosso horário?").
 */
export const STORE_HOURS = L(
  "Segunda a sábado 09h00–19h00 · Domingos e feriados 10h00–15h00",
  "Monday to Saturday 9:00–19:00 · Sundays and holidays 10:00–15:00",
);
export const storeSeeds = [
  {
    code: "02",
    name: "Eterna · Roupa de Festa, Executiva e Acessórios",
    location: "Glória Mall — Loja 2, Maputo",
    phone: "+258 82 487 6330",
    hours: STORE_HOURS,
  },
  {
    code: "22",
    name: "Eterna Bridal · Showroom",
    location: "Glória Mall — Loja 22, Maputo",
    phone: "+258 84 073 3688",
    hours: L(`Só por marcação · ${STORE_HOURS.pt}`, `By appointment only · ${STORE_HOURS.en}`),
  },
];

/**
 * EN: Main menu of design V3 (Essenza · Ocasiões · Noivas · Acessórios · Modeladores · Sobre nós · Contacte-nos).
 *     `href`: "#noivas" = home section, "category:x" = category page, "/about" = page.
 * PT: Menu principal do design V3. `href`: "#noivas" = secção do Início, "category:x" = categoria, "/about" = página.
 */
export const mainNav: { label: Localized; href: string }[] = [
  { label: L("Essenza", "Essenza"), href: "category:essenza" },
  { label: L("Ocasiões", "Occasions"), href: "category:ocasioes" },
  { label: L("Noivas", "Bridal"), href: "#noivas" },
  { label: L("Acessórios", "Accessories"), href: "category:acessorios" },
  { label: L("Modeladores", "Shapewear"), href: "category:modeladores" },
  { label: L("Sobre nós", "About us"), href: "/about" },
  { label: L("Contacte-nos", "Contact us"), href: "/contact" },
];

/** EN: Footer "Informações" links (pages to be written). PT: Ligações "Informações" do rodapé (páginas por escrever). */
export const infoPages = ["tamanhos", "trocas-devolucoes", "reservas", "pagamentos", "envios", "perguntas-frequentes"] as const;

/** EN: Legal pages linked from the checkout (not in the footer). PT: Páginas legais ligadas no checkout. */
export const legalPages = ["termos", "privacidade"] as const;

/** EN: Payment methods (Gestão · 10). All enabled in development, as in the checkout design. */
export const paymentMethodSeeds: { method: PaymentMethod; environment: "production" | "test" | "unconfigured"; note: string }[] = [
  { method: "card", environment: "unconfigured", note: "[Banco ou gateway a escolher]" },
  { method: "paypal", environment: "test", note: "Simulado · precisa de conta PayPal Business" },
  { method: "mpesa", environment: "test", note: "API C2B da Vodacom" },
  { method: "emola", environment: "test", note: "Contrato de comerciante Movitel" },
  { method: "mkesh", environment: "unconfigured", note: "Contrato de comerciante Tmcel" },
  { method: "transfer", environment: "production", note: "Validação manual no painel" },
  { method: "cod", environment: "production", note: "Limite por encomenda: [valor]" },
  { method: "test", environment: "test", note: "Só para demonstração · remover antes de abrir" },
];

/** EN: Delivery zones (Gestão · 4). Fees are still "[valor]" in the design → null. PT: Taxas ainda por definir → null. */
export const deliveryZoneSeeds = [
  { name: "Baixa, Polana, Sommerschield", neighbourhoods: ["Baixa", "Polana", "Polana Cimento", "Sommerschield"], eta: L("30–45 min", "30–45 min") },
  { name: "Coop, Alto-Maé, Malhangalene", neighbourhoods: ["Coop", "Alto-Maé", "Malhangalene"], eta: L("40–60 min", "40–60 min") },
  { name: "Polana Caniço, Costa do Sol", neighbourhoods: ["Polana Caniço", "Costa do Sol"], eta: L("45–70 min", "45–70 min") },
  { name: "Matola", neighbourhoods: ["Matola", "Liberdade"], eta: L("60–90 min", "60–90 min") },
  { name: "Marracuene, Boane", neighbourhoods: ["Marracuene", "Boane"], eta: L("Por combinar", "To be arranged") },
];

/** EN: The 5 base roles (Gestão · A2). PT: Os 5 papéis base. */
export const roleSeeds = [
  { key: "super", name: L("Superadministrador", "Super administrator"), level: 5 },
  { key: "admin", name: L("Administrador", "Administrator"), level: 4 },
  { key: "gestor", name: L("Gestor de loja", "Store manager"), level: 3 },
  { key: "atendedor", name: L("Atendedor", "Sales assistant"), level: 2 },
  { key: "entregador", name: L("Entregador", "Driver"), level: 1 },
] as const;

/**
 * EN: Access matrix from the design, columns: super, admin, gestor, atendedor, entregador.
 *     T total · L own stores · V view only · P own only · Pd ask approval · E delivery data only · — none.
 * PT: Matriz de acesso do design. T total · L só as suas lojas · V só ver · P só as próprias · Pd pedir aprovação ·
 *     E só dados da entrega · — sem acesso.
 */
export const permissionMatrix: [area: string, access: [string, string, string, string, string]][] = [
  ["dashboard", ["T", "T", "L", "L", "—"]],
  ["orders.view", ["T", "T", "L", "L", "P"]],
  ["orders.edit", ["T", "T", "L", "L", "—"]],
  ["orders.cancel", ["T", "T", "L", "—", "—"]],
  ["refunds", ["T", "T", "Pd", "—", "—"]],
  ["transfers.validate", ["T", "T", "L", "—", "—"]],
  ["customers", ["T", "T", "L", "L", "E"]],
  ["customers.export", ["T", "T", "—", "—", "—"]],
  ["deliveries.assign", ["T", "T", "L", "L", "—"]],
  ["deliveries.run", ["—", "—", "—", "—", "P"]],
  ["deliveries.pricing", ["T", "T", "V", "—", "—"]],
  ["commissions.view", ["T", "T", "V", "—", "P"]],
  ["commissions.pay", ["T", "T", "—", "—", "—"]],
  ["fittings", ["T", "T", "L", "L", "—"]],
  ["products.view", ["T", "T", "L", "L", "—"]],
  ["products.edit", ["T", "T", "L", "—", "—"]],
  ["products.publish", ["T", "T", "—", "—", "—"]],
  ["content", ["T", "T", "—", "—", "—"]],
  ["payments.toggle", ["T", "T", "—", "—", "—"]],
  ["api_keys", ["T", "—", "—", "—", "—"]],
  ["notifications", ["T", "T", "L", "—", "—"]],
  ["users.admins", ["T", "—", "—", "—", "—"]],
  ["users.managers", ["T", "T", "—", "—", "—"]],
  ["users.staff", ["T", "T", "L", "—", "—"]],
  ["roles", ["T", "—", "—", "—", "—"]],
  ["stores", ["T", "T", "V", "V", "—"]],
  ["audit", ["T", "V", "—", "—", "—"]],
  ["system", ["T", "—", "—", "—", "—"]],
];

/** EN: Initial key/value settings. PT: Definições iniciais. */
export const settingSeeds: Record<string, unknown> = {
  "delivery.enabled": false, // EN: design V3: the delivery module starts switched off. PT: V3: começa desligado.
  "delivery.pricing": { mode: "zone", fixedFee: null, baseFee: null, perKm: null, maxFee: null },
  "delivery.commissionPct": 70,
  "notifications.events": {
    newPaidOrder: true,
    pendingOver10Min: true,
    transferProof: true,
    cashOnDelivery: true,
    customerConfirmed: false,
  },
  "payments.mobileTimeoutSeconds": 90,
  "fittings.schedule": FITTING_SETTINGS_DEFAULT,
};
