import "server-only";
import { z } from "zod";
import { CONTACTS_DEFAULT, waDigits, type ContactPlace, type ContactsSettings, type ContactsView } from "@/data/contacts";
import { site } from "@/data/site";
import { AppError } from "./errors";
import { getSetting, setSetting } from "./settings";

/**
 * EN: Phones, e-mails and social networks (Gestão → Contactos e redes sociais), setting "contacts".
 * PT: Telefones, e-mails e redes sociais (Gestão → Contactos e redes sociais), definição "contacts".
 */
export const getContacts = () => getSetting<ContactsSettings>("contacts", CONTACTS_DEFAULT);

/** EN: Switched-on channels shown in a place. PT: Contactos ligados mostrados num lugar. */
export async function channelsFor(place: ContactPlace) {
  return (await getContacts()).channels.filter((c) => c.on && c.value && c.places.includes(place));
}

/** EN: The store WhatsApp used by every "WhatsApp" button (digits, with 258). PT: O WhatsApp dos botões. */
export async function storeWhatsappNumber(): Promise<string> {
  const c = (await getContacts()).channels.find((x) => x.on && x.kind === "phone" && x.places.includes("buttons"));
  return c ? waDigits(c.value) : site.whatsapp;
}

/** EN: Phones, WhatsApp, e-mails and social networks of one place. PT: Contactos de um lugar. */
export async function contactsView(place: ContactPlace): Promise<ContactsView> {
  const all = await getContacts();
  const here = all.channels.filter((c) => c.on && c.value && c.places.includes(place));
  return {
    phones: here.filter((c) => c.kind === "phone" && !c.whatsapp),
    whatsapp: here.find((c) => c.kind === "phone" && c.whatsapp) ?? null,
    emails: here.filter((c) => c.kind === "email"),
    social: all.social.filter((x) => x.on && x.url),
  };
}

/** EN: Visible social networks, in order. PT: Redes sociais visíveis, por ordem. */
export async function visibleSocial() {
  return (await getContacts()).social.filter((s) => s.on && s.url);
}

const url = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v));
const schema = z.object({
  channels: z
    .array(
      z.object({
        kind: z.enum(["phone", "email"]),
        value: z.string().trim().max(120),
        label: z.string().trim().max(60),
        whatsapp: z.boolean().optional(),
        places: z.array(z.enum(["top", "contacts", "footer", "buttons"])).max(4),
        on: z.boolean(),
      }),
    )
    .max(20),
  social: z
    .array(
      z.object({
        network: z.enum(["instagram", "facebook", "tiktok", "youtube", "pinterest", "linkedin", "other"]),
        icon: z.string().trim().max(500),
        handle: z.string().trim().max(80),
        url,
        on: z.boolean(),
      }),
    )
    .max(20),
});

export async function saveContacts(input: unknown, staffId: string) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Verifique os contactos e as ligações.", 400);
  for (const c of parsed.data.channels) {
    if (!c.on) continue;
    if (c.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value)) throw new AppError("VALIDATION_ERROR", `E-mail inválido: ${c.value || "(vazio)"}. Corrija ou desligue.`, 400);
    if (c.kind === "phone" && waDigits(c.value).length < 9) throw new AppError("VALIDATION_ERROR", `Telefone inválido: ${c.value || "(vazio)"}. Corrija ou desligue.`, 400);
  }
  await setSetting("contacts", parsed.data, staffId);
}
