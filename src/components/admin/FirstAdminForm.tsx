"use client";

import { useActionState } from "react";
import { setupFirstAdmin, type AuthState } from "@/app/gestao/actions/auth";
import btn from "@/components/ui/Button.module.css";
import form from "@/components/ui/Form.module.css";

/** EN: Form for the first Superadministrador. PT: Formulário do primeiro Superadministrador. */
export function FirstAdminForm() {
  const [state, action, pending] = useActionState(setupFirstAdmin, {} as AuthState);
  return (
    <form action={action} className={form.form}>
      {state.error && (
        <div role="alert" className={form.error}>
          {state.error}
        </div>
      )}
      <label className={form.field}>
        Nome completo
        <input className={form.input} name="name" autoComplete="name" required minLength={2} />
      </label>
      <div className={form.row2}>
        <label className={form.field}>
          Nome de utilizador
          <input className={form.input} name="username" autoComplete="username" placeholder="ex.: direccao" required />
        </label>
        <label className={form.field}>
          WhatsApp
          <input className={form.input} name="phone" type="tel" inputMode="numeric" placeholder="84 123 4567" required />
        </label>
      </div>
      <label className={form.field}>
        E-mail (opcional)
        <input className={form.input} name="email" type="email" autoComplete="email" />
      </label>
      <div className={form.row2}>
        <label className={form.field}>
          Palavra-passe
          <input className={form.input} name="password" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <label className={form.field}>
          Repetir
          <input className={form.input} name="repeat" type="password" autoComplete="new-password" minLength={10} required />
        </label>
      </div>
      <span className={form.hint}>Mínimo 10 caracteres. Guarde-a num sítio seguro: ninguém da Eterna a consegue ver.</span>
      <button type="submit" className={`${btn.button} ${btn.primary} ${btn.block}`} disabled={pending}>
        Criar e entrar
      </button>
    </form>
  );
}
