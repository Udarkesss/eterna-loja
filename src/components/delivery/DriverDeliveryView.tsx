"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { finishDeliveryAction, positionAction, startDeliveryAction } from "@/app/gestao/actions/driver";
import { Icon } from "@/components/ui/Icon";
import { STORE_ORIGIN } from "@/lib/delivery";
import type { MapMarker } from "./LiveMap";
import s from "./driver.module.css";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false });

/**
 * EN: Interactive part of a delivery in the driver app: map with "Você" and the customer, Google Maps / Waze,
 *     "Iniciar entrega", GPS every ~15 s while in transit, and the 4-digit code (or "A cliente não tem o código").
 * PT: Parte interactiva de uma entrega: mapa, Google Maps / Waze, iniciar, GPS a cada ~15 s em trânsito e o código.
 */

const GPS_EVERY_MS = 15_000;

export function DriverDeliveryView(props: {
  order: { id: string; status: string; cod: boolean; dest: { lat: number; lng: number } | null };
  navigation: { google: string; waze: string };
  address: ReactNode;
  contact: ReactNode;
  cash: ReactNode;
}) {
  const { order } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"" | "code" | "nocode">("");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [gps, setGps] = useState<"off" | "on" | "denied">("off");
  const lastSent = useRef(0);
  const inTransit = order.status === "in_transit" && !done;

  // EN: Share the position while in transit (the store and the customer see it). PT: Partilhar a posição em trânsito.
  useEffect(() => {
    if (!inTransit || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(p);
        setGps("on");
        if (Date.now() - lastSent.current >= GPS_EVERY_MS) {
          lastSent.current = Date.now();
          positionAction(order.id, p.lat, p.lng);
        }
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [inTransit, order.id]);

  const markers: MapMarker[] = [
    ...(me ? [{ ...me, kind: "driver" as const, label: "Você" }] : [{ ...STORE_ORIGIN, kind: "store" as const, label: "Glória Mall" }]),
    ...(order.dest ? [{ ...order.dest, kind: "destination" as const, label: "Cliente" }] : []),
  ];

  function begin() {
    start(async () => {
      const r = await startDeliveryAction(order.id);
      if (!r.ok) setError(r.message ?? "Erro");
      router.refresh();
    });
  }

  function confirm(e: FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await finishDeliveryAction(order.id, code);
      if (r.ok) {
        setDone("code");
        router.refresh();
      } else setError(r.message === "WRONG_CODE" ? "Código errado. Peça à cliente para confirmar o código no SMS ou WhatsApp." : (r.message ?? "Erro"));
    });
  }

  function noCode() {
    if (!window.confirm("Registar a entrega sem código? Pedimos à cliente que confirme a recepção no telemóvel.")) return;
    start(async () => {
      const r = await finishDeliveryAction(order.id, null);
      if (r.ok) {
        setDone("nocode");
        router.refresh();
      } else setError(r.message ?? "Erro");
    });
  }

  const status = done ? (done === "code" ? "confirmed" : "delivered") : order.status;

  return (
    <>
      <section className={s.section}>
        {props.address}
        {markers.length > 0 && <LiveMap markers={markers} ariaLabel="Mapa com a rota até à cliente" />}
        <div className={s.row21}>
          <a href={props.navigation.google} target="_blank" rel="noopener noreferrer" className={s.btn}>
            <Icon name="navigate" size={18} />
            Seguir no GPS
          </a>
          <a href={props.navigation.waze} target="_blank" rel="noopener noreferrer" className={s.btnOutline}>
            Waze
          </a>
        </div>
        <span className={s.muted}>Abre o Google Maps com navegação por voz. Enquanto a entrega está Em trânsito, a loja e a cliente vêem a sua posição.</span>
        {inTransit && (
          <span className={s.gps} style={gps === "denied" ? { color: "var(--danger)" } : gps === "off" ? { color: "var(--ink-muted)" } : undefined}>
            {gps === "on" ? "A partilhar a sua localização" : gps === "denied" ? "Localização desligada: autorize-a no telemóvel para a cliente o ver no mapa" : "A ligar o GPS…"}
          </span>
        )}
        {props.contact}
      </section>

      {props.cash}

      {status === "assigned" && (
        <div>
          <button className={s.btn} disabled={pending} onClick={begin}>
            <Icon name="truck" size={20} />
            Iniciar entrega
          </button>
          <span className={s.muted} style={{ display: "block", marginTop: 8, textAlign: "center" }}>
            A cliente recebe o seu nome, matrícula e hora prevista.
          </span>
        </div>
      )}

      {status === "in_transit" && (
        <form onSubmit={confirm} className={s.section}>
          <label className={s.label}>
            Código de recepção da cliente
            <input
              className={s.codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              aria-invalid={!!error}
            />
          </label>
          {error && (
            <span role="alert" className={s.error}>
              <strong style={{ fontWeight: 500 }}>Erro:</strong> {error}
            </span>
          )}
          {order.cod && <span className={s.muted}>Receba o dinheiro antes de confirmar: o pagamento fica registado com o código.</span>}
          <button type="submit" className={s.btn} disabled={pending || code.length !== 4}>
            Confirmar entrega
          </button>
          <button type="button" className={s.linkBtn} disabled={pending} onClick={noCode}>
            A cliente não tem o código
          </button>
          {/* EN: Design V3-E-Em-Transito → V3-E-Falhou. PT: Não consegui entregar. */}
          <Link href={`/gestao/entregador/${order.id}/falhou`} className={s.btnOutline}>
            Não consegui entregar
          </Link>
        </form>
      )}

      {(status === "delivered" || status === "confirmed") && (
        <div role="status" className={s.ok}>
          <Icon name="check" size={20} />
          <span>
            {status === "confirmed"
              ? "Código certo. Entrega confirmada pelos dois lados."
              : "Entrega registada. Pedimos à cliente que confirme a recepção no telemóvel."}
          </span>
        </div>
      )}
    </>
  );
}
