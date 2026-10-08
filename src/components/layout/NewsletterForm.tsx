"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import styles from "./Footer.module.css";

/** EN: Footer "Receba as novidades". PT: "Receba as novidades" do rodapé. */
export function NewsletterForm() {
  const { locale, dict } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    try {
      await api.subscribeNewsletter(email, locale);
      setState("done");
      setEmail("");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <form className={styles.newsletter} onSubmit={submit}>
        <label htmlFor="nl-email" className="visually-hidden">
          {dict.footer.emailLabel}
        </label>
        <input
          id="nl-email"
          type="email"
          required
          autoComplete="email"
          placeholder={dict.footer.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state === "error" || undefined}
        />
        <button type="submit" disabled={state === "sending"}>
          {dict.footer.subscribe}
        </button>
      </form>
      <p role="status" className={styles.newsletterStatus}>
        {state === "done" && dict.footer.subscribed}
        {state === "error" && dict.errors.emailInvalid}
      </p>
    </>
  );
}
