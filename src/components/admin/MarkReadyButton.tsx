"use client";

import { useTransition } from "react";
import { fulfillmentAction } from "@/app/gestao/actions/orders";
import s from "./admin.module.css";

/** EN: "Marcar pronta" in the order list (design V3). PT: "Marcar pronta" na lista de encomendas. */
export function MarkReadyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`${s.btn} ${s.small}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await fulfillmentAction(id, "ready");
          if (!r.ok) window.alert(r.message);
        })
      }
    >
      Marcar pronta
    </button>
  );
}
