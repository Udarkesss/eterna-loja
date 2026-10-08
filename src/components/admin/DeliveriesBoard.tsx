"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { driverAction } from "@/app/gestao/actions/orders";
import type { MapMarker } from "@/components/delivery/LiveMap";
import { Icon } from "@/components/ui/Icon";
import { STORE_ORIGIN } from "@/lib/delivery";
import s from "./admin.module.css";

const LiveMap = dynamic(() => import("@/components/delivery/LiveMap").then((m) => m.LiveMap), { ssr: false });

/**
 * EN: "Entregas de hoje" table (assign a driver, WhatsApp the driver with everything written) and the live map.
 *     The page refreshes every 20 s so new positions and states appear.
 * PT: Tabela "Entregas de hoje" (atribuir, WhatsApp ao entregador com tudo escrito) e o mapa ao vivo.
 *     A página actualiza-se a cada 20 s para mostrar posições e estados novos.
 */

interface Row {
  id: string;
  number: string;
  client: string;
  zone: string;
  pay: string;
  collect: boolean;
  paid: boolean;
  status: string;
  driverId: string | null;
  when: string;
  waLink: string | null;
  driverPhone: string | null;
  canAssign: boolean;
  dest: { lat: number; lng: number } | null;
  position: { lat: number; lng: number; at: string } | null;
}

const STATUS: Record<string, [string, string]> = {
  pending: ["Pendente", ""],
  assigned: ["Atribuída", "dark"],
  in_transit: ["Em trânsito", "warn"],
  delivered: ["Entregue", "ok"],
  confirmed: ["Confirmada", "ok"],
  cancelled: ["Cancelada", "bad"],
};

export function DeliveriesBoard({ rows, drivers, canAssign }: { rows: Row[]; drivers: { id: string; name: string }[]; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(id);
  }, [router]);

  const markers: MapMarker[] = [
    { ...STORE_ORIGIN, kind: "store", label: "Loja 02 · Glória Mall" },
    ...rows.flatMap((r): MapMarker[] => {
      const short = r.number.replace(/^ET-\d{4}-/, "ET-");
      const list: MapMarker[] = [];
      if (r.dest) {
        const kind = r.status === "confirmed" || r.status === "delivered" ? "done" : r.status === "pending" ? "pending" : "destination";
        list.push({ ...r.dest, kind, label: `${short} · ${STATUS[r.status]?.[0] ?? ""}` });
      }
      if (r.position) list.push({ lat: r.position.lat, lng: r.position.lng, kind: "driver", label: short });
      return list;
    }),
  ];
  const outOfMap = rows.filter((r) => !r.dest && r.status !== "confirmed").map((r) => r.number);
  const latest = rows.map((r) => r.position?.at).filter(Boolean).sort().pop();
  const ago = latest ? Math.max(0, Math.round((Date.now() - new Date(latest).getTime()) / 1000)) : null;

  return (
    <>
      <section className={s.cardFlush}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Entregas de hoje</h2>
          <span className={s.muted}>{rows.filter((r) => r.status === "pending").length} por atribuir</span>
        </div>
        {error && <div className={s.error} style={{ margin: 16 }}>{error}</div>}
        {rows.length === 0 ? (
          <p className={s.empty}>Sem entregas ao domicílio por agora.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Encomenda</th>
                <th>Pagamento</th>
                <th>Estado</th>
                <th>Entregador</th>
                <th>Avisar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[r.status] ?? [r.status, ""];
                const editable = canAssign && r.canAssign && (r.status === "pending" || r.status === "assigned");
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={s.two}>
                        <Link href={`/gestao/encomendas/${r.id}`} className={s.a}>
                          {r.number}
                        </Link>
                        <span className={s.muted}>
                          {r.client} · {r.zone}
                        </span>
                      </span>
                    </td>
                    <td style={{ color: r.collect ? "var(--danger)" : r.paid ? "var(--success)" : "var(--warning)", fontWeight: 500, fontSize: 13 }}>
                      {r.canAssign ? r.pay : "Pagamento pendente"}
                    </td>
                    <td>
                      <span className={s.chip} data-tone={st[1] || undefined}>
                        {st[0]}
                      </span>
                    </td>
                    <td>
                      {editable ? (
                        <select
                          className={s.select}
                          style={{ minHeight: 36 }}
                          value={r.driverId ?? ""}
                          disabled={pending}
                          aria-label={`Entregador para ${r.number}`}
                          onChange={(e) =>
                            start(async () => {
                              const res = await driverAction(r.id, e.target.value || null);
                              setError(res.ok ? "" : (res.message ?? "Erro"));
                              router.refresh();
                            })
                          }
                        >
                          <option value="">Escolher entregador…</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={s.muted}>{drivers.find((d) => d.id === r.driverId)?.name ?? (r.canAssign ? "—" : "Aguarda pagamento")}</span>
                      )}
                    </td>
                    <td>
                      {r.waLink ? (
                        <span className={s.actions} style={{ gap: 6 }}>
                          <a href={r.waLink} target="_blank" rel="noopener noreferrer" className={`${s.btnOutline} ${s.small}`}>
                            <Icon name="whatsapp" size={14} />
                            WhatsApp
                          </a>
                          {r.driverPhone && (
                            <a href={`tel:+258${r.driverPhone}`} className={`${s.btnOutline} ${s.small}`}>
                              Ligar
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className={s.muted}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className={s.pager}>
          Ao atribuir, o botão WhatsApp abre a conversa com o entregador e a mensagem já escrita: nº da encomenda, morada, contacto da cliente e valor a cobrar.
          Estados: Pendente → Atribuída → Em trânsito → Entregue → Confirmada pela cliente.
        </div>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Mapa das entregas</h2>
          <span className={s.muted}>{ago !== null ? `Ao vivo · actualizado há ${ago < 120 ? `${ago} s` : `${Math.round(ago / 60)} min`}` : "Sem entregadores a caminho"}</span>
        </div>
        <LiveMap markers={markers} line={false} height={380} ariaLabel="Mapa das entregas de hoje em Maputo" />
        <div className={s.checks} style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          <span>● Loja / entregador a caminho</span>
          <span style={{ color: "var(--ink-muted)" }}>● Pendente</span>
          <span style={{ color: "var(--champagne-deep)" }}>● Destino</span>
          <span style={{ color: "var(--success)" }}>● Entregue / confirmada</span>
          {outOfMap.length > 0 && <span>Sem pino no mapa (morada escrita à mão): {outOfMap.join(", ")}</span>}
        </div>
      </section>
    </>
  );
}
