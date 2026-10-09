"use client";

import { useState, useTransition, type FormEvent } from "react";
import { changePasswordAction, updateProfileAction } from "@/app/gestao/actions/driver";
import s from "./driver.module.css";

interface Props {
  initial: { phone: string; email: string; vehicleType: string; vehiclePlate: string };
  isDriver: boolean;
}

/**
 * EN: Driver profile form. Changing the WhatsApp number or e-mail asks for the current password.
 * PT: Formulário do perfil. Mudar o WhatsApp ou o e-mail pede a palavra-passe actual.
 */
export function DriverProfile({ initial, isDriver }: Props) {
  const [f, setF] = useState({ ...initial, password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: "", password: "", repeat: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const digits = (v: string) => v.replace(/\D/g, "");
  const contactChanged = digits(f.phone) !== digits(initial.phone) || f.email.trim().toLowerCase() !== initial.email.toLowerCase();

  function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await updateProfileAction(f);
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) setF((x) => ({ ...x, password: "" }));
    });
  }

  function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    start(async () => {
      const r = await changePasswordAction(pw);
      setPwMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) setPw({ current: "", password: "", repeat: "" });
    });
  }

  return (
    <>
      <form className={s.section} onSubmit={save}>
        <h2 className={s.h2}>Contactos</h2>
        <label className={s.label}>
          WhatsApp
          <span className={s.prefix}>
            +258
            <input className={s.input} inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="84 123 4567" required />
          </span>
        </label>
        <span className={s.muted}>É para aqui que a loja envia as entregas novas e os códigos de acesso.</span>
        <label className={s.label}>
          E-mail (opcional)
          <input className={s.input} type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        {isDriver && (
          <div className={s.row21}>
            <label className={s.label}>
              Veículo
              <select className={s.input} value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}>
                <option value="">—</option>
                <option>Mota</option>
                <option>Carro</option>
                <option>Bicicleta</option>
              </select>
            </label>
            <label className={s.label}>
              Matrícula
              <input className={s.input} value={f.vehiclePlate} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value })} />
            </label>
          </div>
        )}
        {contactChanged && (
          <label className={s.label}>
            Palavra-passe actual
            <input className={s.input} type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          </label>
        )}
        {msg && <p className={msg.ok ? s.ok : s.error}>{msg.text}</p>}
        <button type="submit" className={s.btn} disabled={pending}>
          Guardar
        </button>
      </form>

      <form className={s.section} onSubmit={savePassword}>
        <h2 className={s.h2}>Palavra-passe</h2>
        <label className={s.label}>
          Actual
          <input className={s.input} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        </label>
        <label className={s.label}>
          Nova
          <input className={s.input} type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required />
        </label>
        <label className={s.label}>
          Repetir a nova
          <input className={s.input} type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} required />
        </label>
        {pwMsg && <p className={pwMsg.ok ? s.ok : s.error}>{pwMsg.text}</p>}
        <button type="submit" className={s.btnOutline} disabled={pending}>
          Mudar palavra-passe
        </button>
      </form>
    </>
  );
}
