"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import form from "@/components/ui/Form.module.css";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import type { CustomerDTO } from "@/types";
import { useCustomer } from "./CustomerProvider";
import { accountError } from "./errors";

/**
 * EN: "Conta · Entrar ou criar conta" from the design: sign in (e-mail or WhatsApp number + password),
 *     forgot password (6-digit code), and sign up with e-mail or WhatsApp (number → code → password).
 *     Google / Facebook buttons are in place; they work once Eterna creates the developer apps.
 * PT: "Conta · Entrar ou criar conta" do design: entrar, recuperar palavra-passe e criar conta com e-mail ou
 *     WhatsApp (número → código → palavra-passe). Google / Facebook ficam prontos para quando a Eterna os ligar.
 */

type Tab = "login" | "register";
type Way = "email" | "whatsapp" | "google" | "facebook";

export function AuthPanel({ next }: { next: string }) {
  const { dict, locale } = useI18n();
  const a = dict.account;
  const router = useRouter();
  const { setCustomer } = useCustomer();

  const [tab, setTab] = useState<Tab>("login");
  const [view, setView] = useState<"form" | "forgot" | "reset">("form");
  const [way, setWay] = useState<Way>("email");
  const [waStep, setWaStep] = useState(1);
  const [notice, setNotice] = useState("");
  const [demo, setDemo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ identifier: "", password: "", name: "", email: "", phone: "", code: "", existing: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  function reset(extra: Partial<{ tab: Tab; way: Way }> = {}) {
    setError("");
    setNotice("");
    setDemo("");
    setView("form");
    setWaStep(1);
    if (extra.tab) setTab(extra.tab);
    if (extra.way) setWay(extra.way);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(accountError(e, dict));
    } finally {
      setBusy(false);
    }
  }

  function done(customer: CustomerDTO) {
    setCustomer(customer);
    router.push(next);
    router.refresh();
  }

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    run(async () => done(await api.login(f.identifier, f.password)));
  };

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api.forgotPassword(f.identifier);
      setNotice(a.sentNeutral);
      setDemo(r.devCode ? t(a.demoCode, { code: r.devCode }) : "");
      setView("reset");
    });
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    run(async () => done(await api.resetPassword({ identifier: f.identifier, code: f.code, password: f.password })));
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    run(async () => done(await api.register({ name: f.name, email: f.email, password: f.password, locale })));
  };

  const onWhatsapp = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (waStep === 1) {
        const r = await api.whatsappCode(f.phone);
        setDemo(r.devCode ? t(a.demoCode, { code: r.devCode }) : "");
        setWaStep(2);
      } else if (waStep === 2) {
        const r = await api.whatsappVerify(f.phone, f.code);
        setF((p) => ({ ...p, existing: r.existingName ?? "", name: p.name || r.existingName || "" }));
        setDemo("");
        setWaStep(3);
      } else {
        done(await api.whatsappComplete({ phone: f.phone, code: f.code, name: f.name, password: f.password, locale }));
      }
    });
  };

  const social = (provider: "Google" | "Facebook") => {
    setError("");
    setNotice(t(a.socialSoon, { provider }));
  };

  return (
    <div className={form.form} style={{ gap: 18 }}>
      <div role="tablist" aria-label={a.dashboardEyebrow} className={form.tabs}>
        {(["login", "register"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={form.tab} onClick={() => reset({ tab: id })}>
            {a.tabs[id]}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className={form.notice}>
          <Icon name="check" size={18} />
          <span>{notice}</span>
        </div>
      )}
      {demo && (
        <div role="status" className={form.warning}>
          <span>{demo}</span>
        </div>
      )}
      {error && (
        <div role="alert" className={form.error}>
          <span>{error}</span>
        </div>
      )}

      {tab === "login" && (
        <div className={form.form} style={{ gap: 16 }}>
          {view === "form" && (
            <form className={form.form} onSubmit={onLogin}>
              <label className={form.field}>
                {a.identifier}
                <input className={form.input} autoComplete="username" placeholder={a.identifierPlaceholder} value={f.identifier} onChange={set("identifier")} required />
              </label>
              <label className={form.field}>
                {a.password}
                <input className={form.input} type="password" autoComplete="current-password" value={f.password} onChange={set("password")} required />
              </label>
              <Button type="submit" block disabled={busy}>
                {a.signIn}
              </Button>
              <button type="button" className={form.link} onClick={() => { reset(); setView("forgot"); }}>
                {a.forgot}
              </button>
            </form>
          )}
          {view === "forgot" && (
            <form className={form.panel} onSubmit={onForgot}>
              <label className={form.field}>
                {a.identifier}
                <input className={form.input} autoComplete="username" value={f.identifier} onChange={set("identifier")} required />
              </label>
              <span className={form.hint}>{a.forgotHelp}</span>
              <Button type="submit" block disabled={busy}>
                {a.send}
              </Button>
              <button type="button" className={form.link} onClick={() => reset()}>
                {a.back}
              </button>
            </form>
          )}
          {view === "reset" && (
            <form className={form.panel} onSubmit={onReset}>
              <label className={form.field}>
                {a.resetCode}
                <input className={form.input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={f.code} onChange={set("code")} required />
              </label>
              <label className={form.field}>
                {a.newPassword}
                <input className={form.input} type="password" autoComplete="new-password" placeholder={a.passwordHint} value={f.password} onChange={set("password")} required minLength={10} />
              </label>
              <Button type="submit" block disabled={busy}>
                {a.resetSave}
              </Button>
              <button type="button" className={form.link} onClick={() => reset()}>
                {a.back}
              </button>
            </form>
          )}
          <div className={form.divider} aria-hidden="true">
            {a.or}
          </div>
          <Button variant="outline" block onClick={() => social("Google")}>
            {a.google}
          </Button>
          <Button variant="outline" block onClick={() => social("Facebook")}>
            {a.facebook}
          </Button>
        </div>
      )}

      {tab === "register" && (
        <div className={form.form}>
          <div role="radiogroup" aria-label={a.createAccount} className={form.choices}>
            {(["email", "whatsapp", "google", "facebook"] as const).map((id) => (
              <button key={id} type="button" role="radio" aria-checked={way === id} className={form.choice} onClick={() => reset({ way: id })}>
                {a.ways[id]}
              </button>
            ))}
          </div>

          {way === "email" && (
            <form className={form.form} onSubmit={onRegister}>
              <label className={form.field}>
                {a.name}
                <input className={form.input} autoComplete="name" placeholder={a.namePlaceholder} value={f.name} onChange={set("name")} required minLength={2} />
              </label>
              <label className={form.field}>
                {a.email}
                <input className={form.input} type="email" autoComplete="email" value={f.email} onChange={set("email")} required />
              </label>
              <label className={form.field}>
                {a.password}
                <input className={form.input} type="password" autoComplete="new-password" placeholder={a.passwordHint} value={f.password} onChange={set("password")} required minLength={10} />
              </label>
              <Button type="submit" block disabled={busy}>
                {a.createAccount}
              </Button>
            </form>
          )}

          {way === "whatsapp" && (
            <form className={form.form} onSubmit={onWhatsapp}>
              <ol className={form.steps}>
                {a.waSteps.map((label, i) => (
                  <li key={label} data-done={i < waStep}>
                    {label}
                  </li>
                ))}
              </ol>
              {waStep === 1 && (
                <label className={form.field}>
                  {a.waNumber}
                  <span className={form.prefixed}>
                    <span className={form.prefix}>+258</span>
                    <input className={form.input} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="84 123 4567" value={f.phone} onChange={set("phone")} required />
                  </span>
                </label>
              )}
              {waStep === 2 && (
                <label className={form.field}>
                  {a.waCode}
                  <input className={form.input} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} value={f.code} onChange={set("code")} required />
                  <span className={form.hint}>{a.waCodeHelp}</span>
                </label>
              )}
              {waStep === 3 && (
                <>
                  {f.existing && <div className={form.warning}>{t(a.waExisting, { name: f.existing })}</div>}
                  <label className={form.field}>
                    {a.name}
                    <input className={form.input} autoComplete="name" value={f.name} onChange={set("name")} required minLength={2} />
                  </label>
                  <label className={form.field}>
                    {a.password}
                    <input className={form.input} type="password" autoComplete="new-password" placeholder={a.passwordHint} value={f.password} onChange={set("password")} required minLength={10} />
                    <span className={form.hint}>{a.waPasswordHelp}</span>
                  </label>
                </>
              )}
              <Button type="submit" block disabled={busy}>
                {waStep === 1 ? a.waSend : waStep === 2 ? a.waConfirm : a.createAccount}
              </Button>
            </form>
          )}

          {(way === "google" || way === "facebook") && (
            <Button variant="outline" block onClick={() => social(way === "google" ? "Google" : "Facebook")}>
              {way === "google" ? a.google : a.facebook}
            </Button>
          )}
        </div>
      )}

      <span className={form.hint}>{a.noDuplicates}</span>
    </div>
  );
}
