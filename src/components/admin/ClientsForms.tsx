"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  adjustPointsAction,
  importClientsAction,
  notifyLevelUpsAction,
  registerStorePurchaseAction,
  setClientLevelAction,
  type ClientActionResult,
} from "@/app/gestao/actions/customers";
import { Icon } from "@/components/ui/Icon";
import type { ImportResult } from "@/server/admin/customers";
import c from "./AdminV3.module.css";

/**
 * EN: Interactive parts of "Gestão · Clientes" (design V3): the card's three forms, "Avisar quem sobe" and the import.
 * PT: Partes interactivas de Clientes (V3): os três formulários da ficha, "Avisar quem sobe" e a importação.
 */

function Feedback({ result }: { result: ClientActionResult | null }) {
  if (!result) return null;
  return (
    <span role="status" className={result.ok ? c.ok : c.err}>
      {result.message}
    </span>
  );
}

/** EN: "14 000,00 MT" → 14000. PT: "14 000,00 MT" → 14000. */
const parseMt = (v: string) => {
  const clean = v.replace(/[^\d,.]/g, "").replace(/\./g, "").split(",")[0];
  return clean ? Number(clean) : 0;
};
/** EN: "+ 5", "−3", "-3" → 5, -3. PT: "+ 5", "−3" → 5, -3. */
const parsePoints = (v: string) => {
  const t = v.replace(/\s/g, "").replace("−", "-");
  return /^[+-]?\d+$/.test(t) ? Number(t) : NaN;
};

export function ClientCardForms(props: {
  id: string;
  level: string;
  reason: string | null;
  levels: { key: string; label: string }[];
  stores: { code: string; name: string }[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [level, setLevel] = useState(props.level);
  const [reason, setReason] = useState(props.reason ?? "");
  const [amount, setAmount] = useState("");
  const [store, setStore] = useState(props.stores[0]?.code ?? "");
  const [points, setPoints] = useState("");
  const [why, setWhy] = useState("");
  const [res, setRes] = useState<{ form: "level" | "store" | "adjust"; result: ClientActionResult } | null>(null);
  const mt = parseMt(amount);
  const earn = Math.floor(mt / 1000);

  const run = (form: "level" | "store" | "adjust", act: () => Promise<ClientActionResult>, reset?: () => void) =>
    start(async () => {
      const result = await act();
      setRes({ form, result });
      if (result.ok) reset?.();
    });
  const fb = (form: "level" | "store" | "adjust") => <Feedback result={res?.form === form ? res.result : null} />;

  return (
    <>
      <form
        className={c.block}
        onSubmit={(e) => {
          e.preventDefault();
          run("level", () => setClientLevelAction({ id: props.id, level: level as "rubi", reason }));
        }}
      >
        <span className={c.label}>Nível</span>
        <div className={c.pair}>
          <select className={c.select} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Nível" disabled={!props.canEdit}>
            {props.levels.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <input className={c.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" disabled={!props.canEdit} />
        </div>
        <span className={c.xsMuted}>
          Muda o desconto a partir de hoje e fica no registo de auditoria. As clientes importadas da loja antiga entram com o nível do Excel; corrija aqui se for preciso.
        </span>
        <button className={`${c.btn} ${c.sm}`} disabled={!props.canEdit || pending}>
          Guardar nível
        </button>
        {fb("level")}
      </form>

      <form
        className={c.block}
        onSubmit={(e) => {
          e.preventDefault();
          run("store", () => registerStorePurchaseAction({ id: props.id, amount: mt, store }), () => setAmount(""));
        }}
      >
        <span className={c.label}>Registar compra na loja</span>
        <div className={c.half}>
          <input className={`${c.input} ${c.num}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00 MT" aria-label="Valor da compra" disabled={!props.canEdit} />
          <select className={c.select} value={store} onChange={(e) => setStore(e.target.value)} aria-label="Loja" disabled={!props.canEdit}>
            {props.stores.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className={`${c.btn} ${c.sm}`} disabled={!props.canEdit || pending || earn < 1}>
          <Icon name="plus" size={14} />
          Associar venda{earn > 0 ? ` · +${earn} ${earn === 1 ? "ponto" : "pontos"}` : ""}
        </button>
        {fb("store")}
      </form>

      <form
        className={c.block}
        onSubmit={(e) => {
          e.preventDefault();
          run(
            "adjust",
            () => adjustPointsAction({ id: props.id, points: parsePoints(points), reason: why }),
            () => {
              setPoints("");
              setWhy("");
            },
          );
        }}
      >
        <span className={c.label}>Ajustar pontos</span>
        <div className={c.narrow}>
          <input className={`${c.input} ${c.num}`} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="+ 5" aria-label="Pontos" disabled={!props.canEdit} />
          <input className={c.input} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Motivo" aria-label="Motivo do ajuste" disabled={!props.canEdit} />
        </div>
        <span className={c.xsMuted}>Fica no registo de auditoria com o seu nome.</span>
        <button className={`${c.btn} ${c.sm}`} disabled={!props.canEdit || pending || !Number.isFinite(parsePoints(points)) || parsePoints(points) === 0}>
          Guardar ajuste
        </button>
        {fb("adjust")}
      </form>
    </>
  );
}

export function NotifyUpsButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ClientActionResult | null>(null);
  return (
    <>
      <button
        type="button"
        className={`${c.btn} ${c.xs}`}
        disabled={disabled || pending}
        onClick={() => {
          if (!window.confirm("Enviar por WhatsApp o aviso de subida de nível a todas as clientes que sobem?")) return;
          start(async () => setRes(await notifyLevelUpsAction()));
        }}
      >
        <Icon name="whatsapp" size={14} />
        Avisar quem sobe
      </button>
      <Feedback result={res} />
    </>
  );
}

/** EN: "Importar clientes" (header and note): picks the Excel and sends it. PT: Escolhe o Excel e envia. */
export function ImportClientsButton({ primary, size, disabled }: { primary?: boolean; size: "sm" | "xs"; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const form = new FormData();
          form.set("file", file);
          start(async () => {
            const r = await importClientsAction(form);
            if (r.ok) {
              setResult(r.result);
              setError(null);
              router.refresh();
            } else setError(r.message);
          });
        }}
      />
      <button type="button" className={`${primary ? c.btnPrimary : c.btn} ${size === "sm" ? c.sm : c.xs}`} disabled={disabled || pending} onClick={() => input.current?.click()}>
        {!primary && <Icon name="upload" size={size === "sm" ? 15 : 13} />}
        {pending ? "A importar…" : "Importar clientes"}
      </button>
      {error && (
        <span role="alert" className={c.err}>
          {error}
        </span>
      )}
      {result && (
        <span role="status" className={c.importBox}>
          <span>
            {result.created} {result.created === 1 ? "nova" : "novas"} · {result.updated} {result.updated === 1 ? "actualizada" : "actualizadas"}
            {result.skipped.length > 0 && ` · ${result.skipped.length} ${result.skipped.length === 1 ? "linha ignorada" : "linhas ignoradas"}`}
          </span>
          {result.skipped.length > 0 && (
            <ul>
              {result.skipped.slice(0, 8).map((s) => (
                <li key={s.row}>
                  Linha {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </>
  );
}
