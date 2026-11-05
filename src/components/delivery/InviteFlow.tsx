"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { acceptInvitationAction, activateDriverAction, checkInvitationCodeAction } from "@/app/gestao/actions/drivers";
import { Icon } from "@/components/ui/Icon";
import s from "./driver.module.css";

/**
 * EN: Invitation steps of design V3: 1) confirm the details and accept, 2) the 6-digit code sent by WhatsApp,
 *     3) the password ("Activar e entrar"). Next time the driver signs in with the WhatsApp number and this password.
 * PT: Passos do convite do V3: 1) confirmar os dados e aceitar, 2) o código de 6 dígitos enviado por WhatsApp,
 *     3) a palavra-passe ("Activar e entrar"). Da próxima vez entra com o número de WhatsApp e esta palavra-passe.
 */
type View = { name: string; inviter: string; phone: string; vehicle: string; store: string; commission: number };

export function InviteFlow({ token, view }: { token: string; view: View }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState("");
  const [demo, setDemo] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = () =>
    start(async () => {
      setError(null);
      const r = await acceptInvitationAction(token);
      if (!r.ok) return setError(r.message ?? "Erro");
      setDemo(r.code ?? null);
      setStep(2);
      setWait(60);
    });

  const rules = [
    [password.length >= 10, "Pelo menos 10 caracteres"],
    [/[A-Z]/.test(password), "Uma letra maiúscula"],
    [/\d/.test(password), "Um número"],
  ] as const;

  return (
    <section className={s.section}>
      {step === 1 && (
        <>
          <span className={s.eyebrow}>Convite · equipa de entregas</span>
          <h1 className={s.title}>
            Junte-se às <em>entregas</em> da Eterna
          </h1>
          <p className={s.muted}>{view.inviter} convidou-o para fazer as entregas da Eterna em Maputo. Confirme os seus dados antes de aceitar.</p>
          <div className={s.card}>
            {(
              [
                ["O seu número", view.phone],
                ["Veículo", view.vehicle],
                ["Loja de partida", view.store],
                ["Comissão", `${view.commission}% do preço de cada entrega`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={s.line}>
                <span className={s.label}>{k}</span>
                <b style={{ fontWeight: 500 }}>{v}</b>
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <button type="button" className={s.btn} disabled={pending} onClick={send}>
            Aceitar convite
          </button>
          <p className={s.muted}>Não é você? Ignore a mensagem: o convite expira sozinho.</p>
        </>
      )}

      {step === 2 && (
        <form
          style={{ display: "contents" }}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = await checkInvitationCodeAction(token, code);
              if (!r.ok) return setError(r.message ?? "Erro");
              setStep(3);
            });
          }}
        >
          <span className={s.eyebrow}>Primeiro acesso · passo 2 de 3</span>
          <h1 className={s.title}>
            Confirme o seu <em>número</em>
          </h1>
          <p className={s.muted}>Enviámos um código de 6 dígitos por WhatsApp para {view.phone}.</p>
          {demo && <p className={s.notice}>Modo de demonstração · código: {demo}</p>}
          <input
            className={s.codeInput}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código de 6 dígitos"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <button type="submit" className={s.btn} disabled={pending || code.length !== 6}>
            Continuar
          </button>
          <button type="button" className={s.linkBtn} disabled={pending || wait > 0} onClick={send}>
            {wait > 0 ? `Reenviar código (0:${String(wait).padStart(2, "0")})` : "Reenviar código"}
          </button>
        </form>
      )}

      {step === 3 && (
        <form
          style={{ display: "contents" }}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = await activateDriverAction(token, code, password, repeat);
              if (!r.ok) return setError(r.message ?? "Erro");
              router.replace("/gestao/entregador");
            });
          }}
        >
          <span className={s.eyebrow}>Passo 3 de 3</span>
          <h1 className={s.title}>
            Crie a sua <em>palavra-passe</em>
          </h1>
          <label className={s.label} htmlFor="pw">
            Palavra-passe
          </label>
          <input id="pw" className={s.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className={s.label} htmlFor="pw2">
            Repetir a palavra-passe
          </label>
          <input id="pw2" className={s.input} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {rules.map(([ok, label]) => (
              <li key={label} className={s.muted} style={{ display: "flex", gap: 8, alignItems: "center", color: ok ? "var(--success)" : undefined }}>
                <Icon name={ok ? "check" : "dot"} size={14} />
                {label}
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <button type="submit" className={s.btn} disabled={pending || rules.some(([ok]) => !ok) || password !== repeat}>
            Activar e entrar
          </button>
          <p className={s.muted}>Da próxima vez, entre com o número de WhatsApp e esta palavra-passe.</p>
        </form>
      )}
    </section>
  );
}
