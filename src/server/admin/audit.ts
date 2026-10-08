import "server-only";
import { and, desc, gte, ilike, lt, or } from "drizzle-orm";
import { fromMaputo } from "@/lib/time";
import { getDb } from "../db";
import { auditLogs } from "../db/schema";

/**
 * EN: Read-only audit log with the design's filters (person, action group, dates).
 * PT: Registo de auditoria só de leitura, com os filtros do design.
 */

export const ACTION_GROUPS: Record<string, { label: string; match: string[] }> = {
  entradas: { label: "Entradas e saídas", match: ["Entrada na gestão", "Saída da gestão", "Primeiro acesso"] },
  falhas: { label: "Logins falhados e bloqueios", match: ["Login falhado", "Conta bloqueada", "Tentativa com conta"] },
  utilizadores: { label: "Utilizadores e permissões", match: ["Utilizador", "Permissões", "Palavra-passe", "Sessões terminadas", "Nova palavra-passe", "Recuperação"] },
  encomendas: { label: "Encomendas e reembolsos", match: ["Encomenda", "Reembolso", "Comprovativo", "Entregador", "Pagamento na entrega", "Estado verificado"] },
  pagamentos: { label: "Pagamentos e chaves de API", match: ["Pagamentos e avisos", "Chave de API"] },
  conteudo: { label: "Produtos, conteúdo e provas", match: ["Produto", "Conteúdo", "Ocasiões", "Imagem principal", "Prova", "Outra hora", "Definições"] },
};

export async function listAudit(filter: { q?: string; group?: string; from?: string; to?: string; limit?: number }) {
  const db = await getDb();
  const group = filter.group ? ACTION_GROUPS[filter.group] : undefined;
  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        filter.q ? or(ilike(auditLogs.actorName, `%${filter.q}%`), ilike(auditLogs.detail, `%${filter.q}%`)) : undefined,
        group ? or(...group.match.map((m) => ilike(auditLogs.action, `${m}%`))) : undefined,
        filter.from ? gte(auditLogs.at, fromMaputo(filter.from)) : undefined,
        filter.to ? lt(auditLogs.at, new Date(fromMaputo(filter.to).getTime() + 86_400_000)) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.at))
    .limit(filter.limit ?? 300);
}

