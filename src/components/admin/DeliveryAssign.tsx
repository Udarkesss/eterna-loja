"use client";

import { useState, useTransition } from "react";
import { driverAction } from "@/app/gestao/actions/orders";
import s from "./admin.module.css";

/** EN: Driver select for one delivery. PT: Escolher o entregador de uma entrega. */
export function DeliveryAssign({ orderId, driverId, drivers }: { orderId: string; driverId: string | null; drivers: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className={s.two}>
      <select
        className={s.select}
        style={{ minHeight: 36 }}
        defaultValue={driverId ?? ""}
        disabled={pending}
        aria-label="Entregador"
        onChange={(e) =>
          start(async () => {
            const r = await driverAction(orderId, e.target.value || null);
            setError(r.ok ? "" : (r.message ?? "Erro"));
          })
        }
      >
        <option value="">— Por atribuir —</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {error && <span className={s.hint} style={{ color: "var(--danger)" }}>{error}</span>}
    </span>
  );
}
