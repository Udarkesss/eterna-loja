"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./ChatWidget.module.css";

/**
 * EN: The store assistant of design V3-Chat: a round button at the bottom right of every store page opens the window
 *     ("Assistente Eterna · Responde já"). It answers at once with the site's data and passes the conversation to a
 *     person when asked or when it doesn't know ("Continuar no WhatsApp" / "Deixar mensagem aqui"). The conversation
 *     stays in this browser; the team's replies appear in the window.
 * PT: O assistente da loja do V3: um botão redondo no canto inferior direito abre a janela. Responde logo com os dados
 *     do site e passa a conversa a uma pessoa quando a cliente pede ou quando não sabe. A conversa fica neste browser;
 *     as respostas da equipa aparecem na janela.
 */

type Msg = { id: string; from: "customer" | "bot" | "team"; text: string; action: { label: string; href: string } | null; at: string };
const KEY = "eterna.chat";

export function ChatWidget({ alwaysHuman }: { alwaysHuman: boolean }) {
  const { dict, locale } = useI18n();
  const t = dict.chat;
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [log, setLog] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [human, setHuman] = useState(false);
  const [unsure, setUnsure] = useState(false);
  const [withTeam, setWithTeam] = useState(false);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const last = log[log.length - 1]?.at ?? null;

  // EN: Restore the conversation of this browser. PT: Recuperar a conversa deste browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setToken(saved);
    } catch {
      /* EN: storage blocked. PT: armazenamento bloqueado. */
    }
  }, []);

  const load = useCallback(
    async (since: string | null) => {
      if (!token) return;
      const r = await fetch(`/api/v1/chat?token=${encodeURIComponent(token)}${since ? `&since=${encodeURIComponent(since)}` : ""}`).catch(() => null);
      if (r?.status === 404) {
        setToken(null);
        try {
          localStorage.removeItem(KEY);
        } catch {}
        return;
      }
      if (!r?.ok) return;
      const { data } = (await r.json()) as { data: { messages: Msg[]; human: boolean; withTeam: boolean } };
      if (data.messages.length) setLog((l) => (since ? [...l, ...data.messages.filter((m) => !l.some((x) => x.id === m.id))] : data.messages.slice(1)));
      setWithTeam(data.withTeam);
    },
    [token],
  );

  useEffect(() => {
    if (open && token && !log.length) void load(null);
  }, [open, token, log.length, load]);

  // EN: While the conversation is with the team, check for replies. PT: Com a equipa, procurar respostas.
  useEffect(() => {
    if (!open || !token || !(human || withTeam)) return;
    const id = setInterval(() => void load(last), 8000);
    return () => clearInterval(id);
  }, [open, token, human, withTeam, last, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fab.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(false);
    setDraft("");
    const r = await fetch("/api/v1/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, text: q, locale }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setDraft(q);
      return setError(true);
    }
    const { data } = (await r.json()) as { data: { token: string; messages: Msg[]; human: boolean; unsure: boolean; withTeam: boolean } };
    if (data.token !== token) {
      setToken(data.token);
      try {
        localStorage.setItem(KEY, data.token);
      } catch {}
    }
    setLog((l) => [...l, ...data.messages]);
    setHuman(data.human && !data.withTeam);
    setUnsure(data.unsure);
    setWithTeam(data.withTeam);
  };

  const handoff = async (mode: "here" | "whatsapp") => {
    if (!token) return;
    const win = mode === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const r = await fetch("/api/v1/chat/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, mode }) }).catch(() => null);
    if (!r?.ok) {
      win?.close();
      return setError(true);
    }
    const { data } = (await r.json()) as { data: { messages: Msg[]; whatsappUrl?: string } };
    if (data.whatsappUrl && win) win.location.href = data.whatsappUrl;
    setLog((l) => [...l, ...data.messages]);
    if (mode === "here") {
      setHuman(false);
      setWithTeam(true);
      input.current?.focus();
    }
  };

  const restart = () => {
    setToken(null);
    setLog([]);
    setHuman(false);
    setUnsure(false);
    setWithTeam(false);
    setError(false);
    try {
      localStorage.removeItem(KEY);
    } catch {}
  };

  const chips = [
    ["price", t.chips.price, t.questions.price],
    ["sizes", t.chips.sizes, t.questions.sizes],
    ["reserve", t.chips.reserve, t.questions.reserve],
    ["fitting", t.chips.fitting, t.questions.fitting],
    ["order", t.chips.order, t.questions.order],
  ] as const;

  if (!open)
    return (
      <button ref={fab} type="button" className={styles.fab} aria-label={t.open} onClick={() => setOpen(true)}>
        <Icon name="whatsapp" size={26} />
      </button>
    );

  // EN: Newest at the bottom (the list is reversed with column-reverse). PT: As mais recentes em baixo.
  const shown = [{ id: "hello", from: "bot" as const, text: t.greeting, action: null, at: "" }, ...log];
  return (
    <div className={styles.window} role="dialog" aria-label={t.title}>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          E
        </span>
        <span className={styles.titles}>
          <b>{t.title}</b>
          <span className={styles.status}>
            <span className={styles.dot} aria-hidden="true" />
            {t.status}
          </span>
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label={t.close}
          onClick={() => {
            setOpen(false);
            setTimeout(() => fab.current?.focus(), 0);
          }}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className={styles.messages} aria-live="polite">
        {unsure && !human && (
          <div className={styles.actions}>
            <button type="button" className={styles.act} onClick={() => void ask(t.humanAsk)}>
              {t.human}
            </button>
          </div>
        )}
        {human && (
          <div className={styles.actions} style={{ flexDirection: "column" }}>
            <button type="button" className={`${styles.act} ${styles.wa}`} onClick={() => void handoff("whatsapp")}>
              <Icon name="whatsapp" size={15} />
              {t.whatsapp}
            </button>
            <button type="button" className={styles.act} onClick={() => void handoff("here")}>
              <Icon name="mail" size={15} />
              {t.here}
            </button>
            <span className={styles.note}>{t.offHours}</span>
          </div>
        )}
        {[...shown].reverse().map((m) => (
          <div key={m.id} className={styles.item}>
            {m.from === "team" && <span className={styles.who}>{t.team}</span>}
            <div className={m.from === "customer" ? styles.me : m.from === "team" ? styles.team : styles.bot}>{m.text}</div>
            {m.action && (
              <Link href={m.action.href} className={styles.act}>
                {m.action.label}
                <Icon name="arrowRight" size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className={styles.chips}>
        {chips.map(([k, label, q]) => (
          <button key={k} type="button" className={styles.chip} disabled={busy} onClick={() => void ask(q)}>
            {label}
          </button>
        ))}
        <button type="button" className={styles.chip} onClick={() => input.current?.focus()}>
          {t.chips.other}
        </button>
        {(alwaysHuman || unsure) && !human && !withTeam && (
          <button type="button" className={`${styles.chip} ${styles.hum}`} disabled={busy} onClick={() => void ask(t.humanAsk)}>
            <Icon name="user" size={13} />
            {t.human}
          </button>
        )}
      </div>
      {error && (
        <span role="alert" className={styles.error}>
          {t.error}
        </span>
      )}
      <form
        className={styles.input}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <input ref={input} placeholder={t.placeholder} aria-label={t.ask} value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className={styles.send} aria-label={t.send} disabled={busy || !draft.trim()}>
          <Icon name="arrowUp" size={18} />
        </button>
      </form>
      <button type="button" className={styles.restart} onClick={restart}>
        {t.restart}
      </button>
    </div>
  );
}
