"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createVoucherAction,
  resendVoucherAction,
  setDiscountDisplayAction,
  setDiscountKindAction,
  suggestCodeAction,
  type VoucherActionResult,
} from "@/app/gestao/actions/vouchers";
import { Icon } from "@/components/ui/Icon";
import { formatMZN } from "@/lib/format";
import c from "./AdminV3.module.css";
import d from "./Discounts.module.css";

/**
 * EN: Interactive parts of "Gestão · Descontos e vouchers" (design V3): the kind switches, the display choice, the
 *     "Novo voucher" form with the WhatsApp preview, and "Reenviar".
 * PT: Partes interactivas de Descontos e vouchers (V3): interruptores, como mostrar o desconto, "Novo voucher" com a
 *     pré-visualização do WhatsApp, e "Reenviar".
 */

function Feedback({ result }: { result: VoucherActionResult | null }) {
  if (!result) return null;
  return (
    <span role={result.ok ? "status" : "alert"} className={result.ok ? c.ok : c.err}>
      {result.message}
    </span>
  );
}

export function KindToggle({ kind, on, label, disabled }: { kind: "level" | "campaigns" | "sale" | "vouchers"; on: boolean; label: string; disabled: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={c.row}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${label}: ${value ? "ligado" : "desligado"}`}
        className={c.toggle}
        disabled={disabled || pending}
        onClick={() => {
          const next = !value;
          setValue(next);
          start(async () => {
            const r = await setDiscountKindAction(kind, next);
            if (!r.ok) {
              setValue(!next);
              setError(r.message);
            } else setError(null);
          });
        }}
      />
      {error && <span className={c.err}>{error}</span>}
    </span>
  );
}

export function DisplayChoice({ display, disabled }: { display: "plain" | "named"; disabled: boolean }) {
  const [value, setValue] = useState(display);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<VoucherActionResult | null>(null);
  const pick = (next: "plain" | "named") => {
    if (next === value) return;
    setValue(next);
    start(async () => {
      const r = await setDiscountDisplayAction(next);
      if (!r.ok) setValue(value);
      setRes(r.ok ? null : r);
    });
  };
  const options: { key: "plain" | "named"; title: string; tag: string; body: string }[] = [
    { key: "plain", title: "Sem o nome do nível", tag: "pedido da cliente", body: "Carrinho: “Desconto e levantamento calculados no checkout”. Checkout: “Desconto de cliente · −5%”." },
    { key: "named", title: "Com o nome do nível", tag: "versão anterior", body: "Carrinho: “Desconto Safira calculado no checkout”. Checkout: “Nível Safira · −5%”." },
  ];
  return (
    <div className={d.choices}>
      {options.map((o) => (
        <label key={o.key} className={`${c.check} ${d.choice}`} data-on={value === o.key || undefined}>
          <input type="radio" name="mostra" checked={value === o.key} onChange={() => pick(o.key)} disabled={disabled || pending} />
          <span>
            <b className={d.w5}>{o.title}</b> · {o.tag}
            {value === o.key ? ", activo" : ""}
            <br />
            <span className={`${c.small} ${d.muted}`}>{o.body}</span>
          </span>
        </label>
      ))}
      <span className={c.xsMuted}>As duas versões ficam guardadas: muda-se aqui a qualquer altura, sem o programador.</span>
      <Feedback result={res} />
    </div>
  );
}

type Person = { id: string; name: string; phone: string | null; email: string | null };

/** EN: "1 000,00 MT" / "15 %" → integer. PT: Texto → número inteiro. */
const parseNumber = (v: string) => {
  const clean = v.replace(/[^\d,.]/g, "").replace(/\./g, "").split(",")[0];
  return clean ? Number(clean) : 0;
};
const formatPhone = (p: string) => `+258 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}`;
const firstName = (n: string) => n.replace(/\[[^\]]*\]\s*/g, "").split(" ")[0];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function NewVoucherForm({ people, levels, disabled, defaultEnd }: { people: Person[]; levels: { key: string; name: string; pct: number }[]; disabled: boolean; defaultEnd: string }) {
  const [kind, setKind] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("1 000,00 MT");
  const [min, setMin] = useState("");
  const [target, setTarget] = useState(people[0] ? `c:${people[0].id}` : "all");
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [uses, setUses] = useState("1");
  const [stacks, setStacks] = useState(false);
  const [wa, setWa] = useState(true);
  const [mail, setMail] = useState(true);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<VoucherActionResult | null>(null);

  const person = target.startsWith("c:") ? people.find((p) => p.id === target.slice(2)) ?? null : null;
  const amount = parseNumber(value);
  const minAmount = parseNumber(min);
  const auto = useMemo(
    () => ["ETERNA", person ? firstName(person.name).normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 10) : null, amount ? String(amount) : null].filter(Boolean).join("-"),
    [person, amount],
  );
  const [code, setCode] = useState<string | null>(null);
  const shown = code ?? auto;
  const valueLabel = kind === "percent" ? `${amount}% de desconto` : formatMZN(amount, "pt");
  const [, m, dd] = endsAt ? endsAt.split("-").map(Number) : [0, 0, 0];
  const preview = `Olá${person ? ` ${firstName(person.name)}` : ""}, tem um voucher de ${valueLabel} na Eterna${minAmount ? `, para compras a partir de ${formatMZN(minAmount, "pt")}` : ""}${endsAt ? `, válido até ${dd} de ${MONTHS[m - 1]}` : ""}.`;

  const submit = (send: boolean) => {
    const sendVia = send && person ? [...(wa && person.phone ? (["whatsapp"] as const) : []), ...(mail && person.email ? (["email"] as const) : [])] : [];
    start(async () => {
      const r = await createVoucherAction({
        kind,
        value: amount,
        minPurchase: minAmount || null,
        target: target.startsWith("c:") ? "customer" : target.startsWith("l:") ? "level" : "all",
        customerId: person?.id ?? null,
        levelKey: target.startsWith("l:") ? target.slice(2) : null,
        endsAt: endsAt || null,
        maxUses: parseNumber(uses) || null,
        code: shown,
        stacksWithLevel: stacks,
        send: sendVia,
      });
      setRes(r);
      if (r.ok) setCode(null);
    });
  };

  return (
    <form
      id="novo-voucher"
      className={d.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      <div className={c.seg} role="group" aria-label="Tipo de valor">
        <button type="button" aria-pressed={kind === "fixed"} onClick={() => {
            setKind("fixed");
            setValue("1 000,00 MT");
          }}>
          Valor fixo
        </button>
        <button type="button" aria-pressed={kind === "percent"} onClick={() => {
            setKind("percent");
            setValue("10 %");
          }}>
          Percentagem
        </button>
      </div>
      <div className={c.half}>
        <label className={c.field}>
          <span className={c.lbl}>Valor</span>
          <input className={`${c.input} ${c.num}`} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
        </label>
        <label className={c.field}>
          <span className={c.lbl}>Compra mínima</span>
          <input className={`${c.input} ${c.num}`} value={min} onChange={(e) => setMin(e.target.value)} placeholder="—" inputMode="decimal" />
        </label>
      </div>
      <label className={c.field}>
        <span className={c.lbl}>Para</span>
        <select className={c.select} value={target} onChange={(e) => {
            setTarget(e.target.value);
            setCode(null);
          }}>
          <optgroup label="Uma cliente">
            {people.map((p) => (
              <option key={p.id} value={`c:${p.id}`}>
                Uma cliente · {p.name}
              </option>
            ))}
          </optgroup>
          <option value="all">Todas as clientes</option>
          <optgroup label="Um nível">
            {levels.map((l) => (
              <option key={l.key} value={`l:${l.key}`}>
                Um nível · {l.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <div className={c.half}>
        <label className={c.field}>
          <span className={c.lbl}>Válido até</span>
          <input type="date" className={`${c.input} ${c.num}`} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <label className={c.field}>
          <span className={c.lbl}>Utilizações</span>
          <input className={`${c.input} ${c.num}`} value={uses} onChange={(e) => setUses(e.target.value)} inputMode="numeric" placeholder="Sem limite" />
        </label>
      </div>
      <label className={c.field}>
        <span className={c.lbl}>Código</span>
        <span className={c.row} style={{ gap: 8 }}>
          <input className={`${c.input} ${c.num} ${d.code}`} value={shown} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button type="button" className={`${c.btn} ${c.sm}`} disabled={pending} onClick={() => start(async () => setCode(await suggestCodeAction(person?.name ?? null, kind, amount)))}>
            Gerar outro
          </button>
        </span>
      </label>
      <label className={c.toggleRow}>
        <button type="button" role="switch" aria-checked={stacks} className={c.toggle} onClick={() => setStacks(!stacks)} />
        <span>Junta-se ao desconto do nível (desligado: aplica-se o maior)</span>
      </label>

      <div className={c.block}>
        <span className={c.label}>Enviar por</span>
        <label className={c.check} data-off={!person?.phone || undefined}>
          <input type="checkbox" checked={wa && !!person?.phone} disabled={!person?.phone} onChange={(e) => setWa(e.target.checked)} /> WhatsApp{person?.phone ? ` · ${formatPhone(person.phone)}` : ""}
        </label>
        <label className={c.check}>
          <input type="checkbox" checked={mail && !!person?.email} disabled={!person?.email} onChange={(e) => setMail(e.target.checked)} /> E-mail{person?.email ? ` · ${person.email}` : ""}
        </label>
        <label className={`${c.check} ${d.muted}`}>
          <input type="checkbox" checked disabled /> {person ? "Fica sempre na conta da cliente, em “Os meus vouchers”" : "Fica na conta das clientes, em “Os meus vouchers”"}
        </label>
      </div>
      {person && (
        <div className={d.wa}>
          <Icon name="whatsapp" size={14} /> {preview.replace(/\.$/, "")}. Código: <b>{shown}</b>. Use-o no checkout em eterna.co.mz ou na loja.
        </div>
      )}
      <div className={c.row}>
        <button className={`${c.btnPrimary} ${c.sm} ${d.grow}`} disabled={disabled || pending || !amount || !person}>
          Gerar e enviar
        </button>
        <button type="button" className={`${c.btn} ${c.sm}`} disabled={disabled || pending || !amount} onClick={() => submit(false)}>
          Só gerar
        </button>
      </div>
      <Feedback result={res} />
    </form>
  );
}

export function ResendButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<VoucherActionResult | null>(null);
  return (
    <span className={d.resend}>
      <button type="button" className={d.textBtn} disabled={disabled || pending} onClick={() => start(async () => setRes(await resendVoucherAction(id)))}>
        Reenviar
      </button>
      <Feedback result={res} />
    </span>
  );
}
