/**
 * EN: Phones, e-mails and social networks of design V3-G-Contactos ("Contactos e redes sociais"). Each phone or e-mail
 *     says where it appears (top bar, Contacte-nos, footer, the WhatsApp buttons) and can be switched off; social
 *     networks keep their order, an optional uploaded icon and on/off. The store cards (photo, name, address, text,
 *     phone, main button, hours) live in the stores table and the "contactos" home section.
 * PT: Telefones, e-mails e redes sociais do V3 ("Contactos e redes sociais"). Cada telefone ou e-mail diz onde aparece
 *     (barra do topo, Contacte-nos, rodapé, botões de WhatsApp) e pode ser desligado; as redes têm ordem, ícone
 *     carregado opcional e ligar/desligar. Os cartões das lojas vivem na tabela de lojas e na secção "contactos".
 */

export type ContactPlace = "top" | "contacts" | "footer" | "buttons";
export const CONTACT_PLACES: Record<ContactPlace, string> = { top: "Topo", contacts: "Contactos", footer: "Rodapé", buttons: "Botões" };

export interface ContactChannel {
  kind: "phone" | "email";
  value: string;
  label: string;
  /** EN: A WhatsApp number (the "Botões" place uses the first one). PT: Número de WhatsApp. */
  whatsapp?: boolean;
  places: ContactPlace[];
  on: boolean;
}

export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "youtube" | "pinterest" | "linkedin" | "other";
export const SOCIAL_NETWORKS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  other: "Outra",
};

export interface SocialLink {
  network: SocialNetwork;
  icon: string; // EN: uploaded icon or "" (default icon). PT: ícone carregado ou "" (ícone padrão).
  handle: string;
  url: string;
  on: boolean;
}

export interface ContactsSettings {
  channels: ContactChannel[];
  social: SocialLink[];
}

export const CONTACTS_DEFAULT: ContactsSettings = {
  channels: [
    { kind: "phone", value: "+258 82 487 6300", label: "Loja", places: ["contacts", "footer"], on: true },
    { kind: "phone", value: "+258 82 487 6330", label: "Showroom Bridal", places: ["contacts", "footer"], on: true },
    { kind: "phone", value: "+258 84 073 3688", label: "WhatsApp", whatsapp: true, places: ["top", "contacts", "footer", "buttons"], on: true },
    { kind: "email", value: "apoio@eterna.co.mz", label: "Apoio", places: ["contacts", "footer"], on: false },
    { kind: "email", value: "support@eterna.co.mz", label: "Apoio (EN)", places: ["contacts", "footer"], on: false },
  ],
  social: [
    { network: "instagram", icon: "", handle: "@eterna.dresses", url: "https://www.instagram.com/eterna.dresses/", on: true },
    { network: "instagram", icon: "", handle: "@eterna.bridal", url: "https://www.instagram.com/eterna.bridal/", on: true },
    { network: "facebook", icon: "", handle: "Eterna Dresses", url: "https://www.facebook.com/share/1A3tHGxafB/", on: true },
    { network: "tiktok", icon: "", handle: "@eterna.dresses", url: "https://www.tiktok.com/@eterna.dresses", on: true },
  ],
};

/** EN: "+258 84 073 3688" → "258840733688". PT: Número só com dígitos, com o 258. */
export const waDigits = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 9 ? `258${d}` : d;
};

/** EN: What the store pages need (already filtered). PT: O que as páginas da loja precisam (já filtrado). */
export interface ContactsView {
  phones: ContactChannel[];
  whatsapp: ContactChannel | null;
  emails: ContactChannel[];
  social: SocialLink[];
}
