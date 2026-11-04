import "server-only";
import { z } from "zod";
import type { AssistantSettings } from "@/data/assistant";
import { audit } from "../audit";
import { assistantSettings } from "../assistant/engine";
import { AppError } from "../errors";
import { setSetting } from "../settings";
import type { StaffContext } from "../staff/access";

/**
 * EN: Gestão → Assistente (design V3-G-Assistente): switch the chat and WhatsApp on/off, the questions and answers and
 *     the hand-off to a person. Every change goes to the audit log.
 * PT: Gestão → Assistente: ligar/desligar o chat e o WhatsApp, as perguntas e respostas e a passagem a uma pessoa.
 *     Cada mudança fica na auditoria.
 */
const hours = z.string().trim().max(40);
const schema = z.object({
  site: z.boolean(),
  whatsapp: z.boolean(),
  alwaysHuman: z.boolean(),
  handoffAfter: z.number().int().min(1).max(10),
  teamWeek: hours,
  teamSat: hours,
  offHours: z.string().trim().min(1).max(400),
  waSilence: z.boolean(),
  topics: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
        kind: z.enum(["price", "stock", "reservations", "payments", "fittings", "hours", "order", "exchanges", "deliveries", "custom"]),
        text: z.string().trim().max(800),
        site: z.boolean(),
        whatsapp: z.boolean(),
        on: z.boolean(),
      }),
    )
    .max(60),
});

export async function saveAssistant(staff: StaffContext, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Verifique as perguntas: cada uma precisa de nome e de pelo menos uma palavra.", 400);
  const fixed = parsed.data.topics.find((t) => (t.kind === "custom" || t.kind === "exchanges") && !t.text);
  if (fixed) throw new AppError("VALIDATION_ERROR", `Escreva a resposta de “${fixed.name}”.`, 400);
  const before = await assistantSettings();
  await setSetting("assistant", parsed.data satisfies AssistantSettings, staff.id);
  const changes = [
    before.site !== parsed.data.site && `Chat no site ${parsed.data.site ? "ligado" : "desligado"}`,
    before.whatsapp !== parsed.data.whatsapp && `Assistente no WhatsApp ${parsed.data.whatsapp ? "ligado" : "desligado"}`,
  ].filter(Boolean);
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Assistente actualizado", detail: changes.join(" · ") || "Perguntas e respostas" });
}
