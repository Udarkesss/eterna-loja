import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ContactsSettings } from "@/data/contacts";
import type { Localized } from "@/types";
import { audit } from "../audit";
import { getContacts, saveContacts } from "../contacts";
import { getDb } from "../db";
import { contentSections, stores } from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";

/**
 * EN: "Gestão · Contactos e redes sociais" of design V3-G-Contactos: the two store cards (photo, name, address, text,
 *     phone, main button, hours), phones and e-mails with where they appear, and the social networks. One
 *     "Publicar alterações" saves it all; it shows at once in the top bar, Contacte-nos, Sobre nós and the footer.
 * PT: Contactos e redes sociais do V3: os dois cartões das lojas, telefones e e-mails com onde aparecem e as redes
 *     sociais. Um "Publicar alterações" guarda tudo e aparece logo no site.
 */

export interface StoreCardEdit {
  code: string;
  label: string;
  image: string;
  name: string;
  address: string;
  text: string;
  phone: string;
  action: "whatsapp" | "call" | "fitting";
  showHours: boolean;
  hours: string;
  mapsUrl: string;
}

type Card = { code: string; image: string; eyebrow: Localized; name: Localized; description: Localized; action: string; showHours?: boolean; mapsUrl?: string };

export async function contactsPage(): Promise<{ stores: StoreCardEdit[]; contacts: ContactsSettings }> {
  const db = await getDb();
  const [rows, [section], contacts] = await Promise.all([
    db.select().from(stores).orderBy(asc(stores.position)),
    db.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "contactos"))),
    getContacts(),
  ]);
  const cards = ((section?.data.stores ?? []) as Card[]).filter((c) => rows.some((r) => r.code === c.code));
  return {
    contacts,
    stores: cards.map((card) => {
      const r = rows.find((x) => x.code === card.code)!;
      return {
        code: card.code,
        label: card.action === "fitting" ? "Showroom privativo · Eterna Bridal" : "A loja",
        image: card.image,
        name: card.name.pt,
        address: r.location,
        text: card.description.pt,
        phone: r.phone,
        action: card.action === "fitting" || card.action === "call" ? card.action : "whatsapp",
        showHours: card.showHours ?? card.action !== "fitting",
        hours: r.hours?.pt ?? "",
        mapsUrl: card.mapsUrl ?? "",
      };
    }),
  };
}

const storeSchema = z.object({
  code: z.string().max(10),
  image: z.string().trim().max(500),
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(120),
  text: z.string().trim().max(300),
  phone: z.string().trim().min(6).max(30),
  action: z.enum(["whatsapp", "call", "fitting"]),
  showHours: z.boolean(),
  hours: z.string().trim().max(160),
  mapsUrl: z.union([z.literal(""), z.string().trim().url().max(500)]),
});

export async function publishContacts(staff: StaffContext, input: { stores: unknown; contacts: unknown }) {
  const parsed = z.array(storeSchema).max(6).safeParse(input.stores);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Verifique os dados das lojas: nome, morada e telefone são obrigatórios.", 400);
  await saveContacts(input.contacts, staff.id);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [section] = await tx.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "contactos")));
    const cards = ((section?.data.stores ?? []) as Card[]).map((card) => {
      const e = parsed.data.find((x) => x.code === card.code);
      if (!e) return card;
      // EN: Portuguese is edited here; English follows when it was the same text. PT: Edita-se o português.
      const tr = (v: Localized, pt: string): Localized => ({ pt, en: v.en === v.pt || !v.en ? pt : v.en });
      return { ...card, image: e.image || card.image, name: tr(card.name, e.name), description: tr(card.description, e.text), action: e.action, showHours: e.showHours, mapsUrl: e.mapsUrl || undefined };
    });
    if (section) await tx.update(contentSections).set({ data: { ...section.data, stores: cards }, publishedAt: new Date() }).where(eq(contentSections.id, section.id));
    for (const e of parsed.data) {
      const [row] = await tx.select().from(stores).where(eq(stores.code, e.code));
      if (!row) continue;
      const hours = e.hours ? { pt: e.hours, en: row.hours && row.hours.en !== row.hours.pt ? row.hours.en : e.hours } : null;
      await tx.update(stores).set({ location: e.address, phone: e.phone, hours, updatedAt: new Date() }).where(eq(stores.id, row.id));
    }
  });
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Contactos e redes sociais publicados" });
}
