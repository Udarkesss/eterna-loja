import "server-only";
import { getDb } from "./db";
import { auditLogs } from "./db/schema";

/**
 * EN: Append-only audit log (Gestão · A4 "Quem fez o quê, quando e de onde"). Never updated or deleted.
 * PT: Registo de auditoria só de acrescentar. Nunca é alterado nem apagado.
 */
export interface AuditEntry {
  actor: { type: "staff" | "customer" | "system"; id?: string | null; name: string; role?: string | null };
  action: string; // "Entrada na gestão", "Permissões alteradas"…
  detail?: string | null;
  origin?: string | null;
  result?: "success" | "warning" | "blocked" | "failure";
}

export async function audit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  await db.insert(auditLogs).values({
    actorType: entry.actor.type,
    actorId: entry.actor.id ?? null,
    actorName: entry.actor.name,
    actorRole: entry.actor.role ?? null,
    action: entry.action,
    detail: entry.detail ?? null,
    origin: entry.origin ?? null,
    result: entry.result ?? "success",
  });
}
