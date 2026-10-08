"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import form from "@/components/ui/Form.module.css";
import { recoverStaff, resetStaff, setFirstPassword, signInStaff, type AuthState } from "@/app/gestao/actions/auth";
import btn from "@/components/ui/Button.module.css";

/**
 * EN: The views of "Gestão · 0 Entrar": sign in → recover (WhatsApp or e-mail) → code + new password,
 *     first access (replace the temporary password) and the 15-minute lock message.
 * PT: As vistas do ecrã de entrada: entrar → recuperar → código + nova palavra-passe, primeiro acesso e bloqueio.
 */

const RULES = [
  { label: "Pelo menos 10 caracteres", test: (p: string) => p.length >= 10 },
  { label: "Não é uma palavra-passe comum", test: (p: string) => p.length > 0 && !["1234567890", "password123", "eterna12345", "qwertyuiop1"].includes(p.toLowerCase()) },
];

function PasswordField({ name, label, autoComplete, onChange }: { name: string; label: string; autoComplete: string; onChange?: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <label className={form.field}>
      {label}
      <span style={{ position: "relative", display: "flex" }}>
        <input className={form.input} style={{ paddingRight: 52 }} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required onChange={(e) => onChange?.(e.target.value)} />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
          style={{ position: "absolute", right: 4, top: 4, width: 44, height: 44, border: 0, background: "transparent", color: "var(--ink-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="eye" size={20} />
        </button>
      </span>
    </label>
  );
}

function NewPasswordFields() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const rules = [...RULES.map((r) => ({ label: r.label, ok: r.test(pw) })), { label: "As duas são iguais", ok: pw.length > 0 && pw === pw2 }];
  return (
    <>
      <PasswordField name="password" label="Nova palavra-passe" autoComplete="new-password" onChange={setPw} />
      <PasswordField name="repeat" label="Repetir a palavra-passe" autoComplete="new-password" onChange={setPw2} />
      <ul style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        {rules.map((r) => (
          <li key={r.label} style={{ color: r.ok ? "var(--success)" : "var(--ink-muted)" }}>
            {r.ok ? "✓" : "·"} {r.label}
          </li>
        ))}
      </ul>
    </>
  );
}

function Status({ state }: { state: AuthState }) {
  return (
    <>
      {state.notice && (
        <div role="status" className={form.notice}>
          <span>{state.notice}</span>
        </div>
      )}
      {state.demoCode && (
        <div role="status" className={form.warning}>
          <span>Modo de demonstração — sem envio real. O código é {state.demoCode}.</span>
        </div>
      )}
      {state.error && (
        <div role="alert" className={form.error}>
          <span>
            <strong style={{ fontWeight: 500 }}>Erro:</strong> {state.error}
          </span>
        </div>
      )}
    </>
  );
}

export function StaffLogin({ firstAccess }: { firstAccess: boolean }) {
  const [loginState, login, loggingIn] = useActionState(signInStaff, { view: firstAccess ? "first" : "login" } as AuthState);
  const [recoverState, recover, recovering] = useActionState(recoverStaff, {} as AuthState);
  const [resetState, reset, resetting] = useActionState(resetStaff, {} as AuthState);
  const [firstState, first, saving] = useActionState(setFirstPassword, {} as AuthState);
  const [mode, setMode] = useState<"auto" | "recover" | "reset">("auto");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");

  const view =
    mode === "recover" ? (recoverState.view === "sent" ? "sent" : "recover") : mode === "reset" ? "reset" : (loginState.view ?? "login");
  const primary = `${btn.button} ${btn.primary} ${btn.block}`;

  if (view === "first") {
    return (
      <form action={first} className={form.form}>
        <Status state={firstState.error ? firstState : loginState} />
        <p className={form.hint}>Por segurança, troque a palavra-passe temporária que recebeu por uma só sua.</p>
        <PasswordField name="current" label="Palavra-passe temporária" autoComplete="current-password" />
        <NewPasswordFields />
        <button type="submit" className={primary} disabled={saving}>
          Guardar palavra-passe
        </button>
      </form>
    );
  }

  if (view === "recover" || view === "sent" || view === "reset") {
    const identifier = recoverState.identifier ?? resetState.identifier ?? loginState.identifier ?? "";
    return (
      <div className={form.form}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400 }}>Recuperar a palavra-passe</h2>
        {view === "recover" && (
          <form action={recover} className={form.form}>
            <Status state={recoverState} />
            <label className={form.field}>
              Nome de utilizador, e-mail ou número de WhatsApp
              <input className={form.input} name="identifier" defaultValue={identifier} autoComplete="username" required />
            </label>
            <fieldset className={form.form}>
              <legend className={form.field} style={{ paddingBottom: 8 }}>
                Enviar para
              </legend>
              <div role="radiogroup" className={form.choices}>
                {(["whatsapp", "email"] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={channel === c} className={form.choice} onClick={() => setChannel(c)}>
                    {c === "whatsapp" ? "WhatsApp · código de 6 dígitos" : "E-mail · código de 6 dígitos"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="channel" value={channel} />
            </fieldset>
            <button type="submit" className={primary} disabled={recovering}>
              Enviar instruções
            </button>
          </form>
        )}
        {(view === "sent" || view === "reset") && (
          <form action={reset} className={form.form}>
            <Status state={resetState.error ? resetState : recoverState} />
            <input type="hidden" name="identifier" value={identifier} />
            <label className={form.field}>
              {channel === "whatsapp" ? "Código recebido no WhatsApp" : "Código recebido por e-mail"}
              <input className={form.input} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" required />
            </label>
            <NewPasswordFields />
            <button type="submit" className={primary} disabled={resetting} onClick={() => setMode("reset")}>
              Guardar palavra-passe
            </button>
          </form>
        )}
        <button type="button" className={form.link} onClick={() => setMode("auto")}>
          Voltar a entrar
        </button>
      </div>
    );
  }

  return (
    <form action={login} className={form.form} style={{ gap: 16 }}>
      <Status state={loginState} />
      <label className={form.field}>
        Nome de utilizador, e-mail ou número de WhatsApp
        <input className={form.input} name="identifier" defaultValue={loginState.identifier} autoComplete="username" placeholder="ex.: gestora.l02 ou 84 123 4567" required />
      </label>
      <PasswordField name="password" label="Palavra-passe" autoComplete="current-password" />
      <button type="submit" className={primary} disabled={loggingIn}>
        Entrar
      </button>
      <button type="button" className={form.link} onClick={() => setMode("recover")}>
        Esqueci a palavra-passe
      </button>
      <span className={form.hint}>Acesso só para a equipa Eterna. As contas são criadas pela gestão; não há registo público.</span>
    </form>
  );
}
