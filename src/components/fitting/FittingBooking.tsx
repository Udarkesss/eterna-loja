"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCustomer } from "@/components/account/CustomerProvider";
import { accountError } from "@/components/account/errors";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import form from "@/components/ui/Form.module.css";
import { RichText } from "@/components/ui/RichText";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { addDays, formatLongDate, fromMaputo, shortWeekday, toMaputo } from "@/lib/time";
import { BRIDAL_FITTING_KINDS, FITTING_KINDS, type FittingKind, type FittingPublicDTO, type ProductDTO } from "@/types";
import styles from "./Fitting.module.css";

/**
 * EN: "Agendar prova" form. Order of the choices follows the agreed flow: occasion → store (suggested by the
 *     occasion) → day → free time → pieces (favourites) → details. On submit the request is saved (PR-0042) and
 *     WhatsApp opens with the message already written, including the link to the request page.
 * PT: Formulário "Agendar prova": ocasião → loja (sugerida pela ocasião) → dia → hora livre → peças (favoritos) →
 *     dados. Ao enviar, o pedido fica guardado (PR-0042) e o WhatsApp abre com a mensagem já escrita.
 */

interface Props {
  stores: { code: string; name: string; location: string }[];
  schedule: { days: number[]; maxDaysAhead: number; bridalMinutes: number; defaultMinutes: number };
  today: string;
  customer: { name: string; phone: string | null } | null;
  initialPiece: string | null;
}

export function FittingBooking({ stores, schedule, today, customer: serverCustomer, initialPiece }: Props) {
  const { dict, locale, href } = useI18n();
  const f = dict.fitting;
  const { customer } = useCustomer();
  const { slugs: favoriteSlugs } = useFavorites();
  const signedIn = customer ?? serverCustomer;

  const [kind, setKind] = useState<FittingKind>("bride_white");
  const [store, setStore] = useState("22");
  const [date, setDate] = useState<string | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [pieces, setPieces] = useState<string[]>(initialPiece ? [initialPiece] : []);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [name, setName] = useState(signedIn?.name ?? "");
  const [phone, setPhone] = useState(signedIn?.phone ? formatMsisdn(signedIn.phone) : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<FittingPublicDTO | null>(null);

  const bridal = BRIDAL_FITTING_KINDS.includes(kind);
  const duration = bridal ? schedule.bridalMinutes : schedule.defaultMinutes;

  // EN: The occasion suggests the store. PT: A ocasião sugere a loja.
  function pickKind(k: FittingKind) {
    setKind(k);
    setStore(BRIDAL_FITTING_KINDS.includes(k) ? "22" : "02");
  }

  const days = useMemo(() => {
    const list: { date: string; open: boolean }[] = [];
    for (let i = 0; i <= schedule.maxDaysAhead; i++) {
      const d = addDays(today, i);
      list.push({ date: d, open: schedule.days.includes(toMaputo(fromMaputo(d, "12:00")).weekday) });
    }
    return list;
  }, [today, schedule]);

  // EN: Free times for the chosen store/day/occasion. PT: Horas livres para a loja/dia/ocasião.
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setTimes(null);
    setTime(null);
    api
      .fittingSlots(store, date, kind)
      .then((r) => !cancelled && setTimes(r.times))
      .catch(() => !cancelled && setTimes([]));
    return () => {
      cancelled = true;
    };
  }, [store, date, kind]);

  // EN: Pieces to choose from: favourites + the piece that brought her here. PT: Favoritos + a peça de origem.
  const candidateSlugs = useMemo(() => [...new Set([...(initialPiece ? [initialPiece] : []), ...favoriteSlugs])], [initialPiece, favoriteSlugs]);
  useEffect(() => {
    if (!candidateSlugs.length) return setProducts([]);
    api
      .listProducts({ locale, slugs: candidateSlugs })
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [candidateSlugs, locale]);

  const togglePiece = (slug: string) =>
    setPieces((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length < 6 ? [...p, slug] : p));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setBusy(true);
    setError("");
    // EN: Open the tab now (inside the click) so pop-up blockers allow it. PT: Abrir já, dentro do clique.
    const tab = window.open("", "_blank");
    try {
      const created = await api.requestFitting({
        locale,
        name,
        phone,
        kind,
        storeCode: store,
        date,
        time,
        productSlugs: pieces,
        notes: notes || undefined,
      });
      setDone(created);
      if (tab) tab.location.href = created.whatsappUrl;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      tab?.close();
      setError(accountError(err, dict));
      if (date) api.fittingSlots(store, date, kind).then((r) => setTimes(r.times)).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const when = toMaputo(done.startsAt);
    return (
      <div className={`page-x ${styles.done}`}>
        <div className={form.notice}>
          <span>{t(f.receivedBody, { code: done.code })}</span>
        </div>
        <h2 className={styles.doneTitle}>
          <RichText text={f.receivedTitle} />
        </h2>
        <p className={styles.doneWhen}>
          {FITTING_KIND_LABELS[done.kind][locale]} · {formatLongDate(when.date, locale)}, {when.time} · {done.store.location}
        </p>
        <div className={styles.doneActions}>
          <ButtonLink href={done.whatsappUrl}>{f.openWhatsapp}</ButtonLink>
          <ButtonLink href={href(`/fitting/${done.token}`)} variant="outline">
            {f.seeRequest}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form className={`page-x ${styles.layout}`} onSubmit={submit}>
      <div className={styles.steps}>
        <fieldset className={styles.block}>
          <legend className={styles.legend}>
            <span className={styles.num}>1</span>
            {f.occasion}
          </legend>
          <div role="radiogroup" aria-label={f.occasion} className={styles.kinds}>
            {FITTING_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={form.choice} onClick={() => pickKind(k)}>
                {FITTING_KIND_LABELS[k][locale]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.block}>
          <legend className={styles.legend}>
            <span className={styles.num}>2</span>
            {f.store}
          </legend>
          <div role="radiogroup" aria-label={f.store} className={form.choices}>
            {stores.map((s) => {
              const suggested = (s.code === "22") === bridal;
              return (
                <button key={s.code} type="button" role="radio" aria-checked={store === s.code} className={`${form.choice} ${styles.store}`} onClick={() => setStore(s.code)}>
                  <strong>Loja {s.code}</strong>
                  <span>{s.name}</span>
                  {suggested && <span className={styles.suggested}>{bridal ? f.storeHint.bridal : f.storeHint.other}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.block}>
          <legend className={styles.legend}>
            <span className={styles.num}>3</span>
            {f.day} · {f.time}
            <span className={form.hint}>{t(f.minutes, { count: duration })}</span>
          </legend>
          <div className={styles.days} role="radiogroup" aria-label={f.day}>
            {days.map((d) => {
              const [, , dd] = d.date.split("-");
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={date === d.date}
                  aria-label={formatLongDate(d.date, locale)}
                  disabled={!d.open}
                  className={`${form.choice} ${styles.day}`}
                  onClick={() => setDate(d.date)}
                >
                  <span className={styles.dayName}>{shortWeekday(d.date, locale)}</span>
                  <span className={styles.dayNum}>{Number(dd)}</span>
                </button>
              );
            })}
          </div>
          {!date && <p className={form.hint}>{f.pickDay}</p>}
          {date && times === null && <p className={form.hint}>{f.loadingTimes}</p>}
          {date && times?.length === 0 && <p className={form.hint}>{f.noTimes}</p>}
          {date && !!times?.length && (
            <div className={styles.times} role="radiogroup" aria-label={f.time}>
              {times.map((tm) => (
                <button key={tm} type="button" role="radio" aria-checked={time === tm} className={form.choice} onClick={() => setTime(tm)}>
                  {tm}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className={styles.block}>
          <legend className={styles.legend}>
            <span className={styles.num}>4</span>
            {f.pieces}
            <span className={form.hint}>{f.piecesHint}</span>
          </legend>
          {products.length === 0 ? (
            <p className={form.hint}>{f.noPieces}</p>
          ) : (
            <div className={styles.pieces}>
              {products.map((p) => (
                <button key={p.slug} type="button" aria-pressed={pieces.includes(p.slug)} className={styles.piece} onClick={() => togglePiece(p.slug)}>
                  {p.images[0] && <Image src={p.images[0].url} alt="" width={120} height={150} className={styles.pieceImg} />}
                  <span className={styles.pieceCode}>{p.code}</span>
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className={styles.block}>
          <legend className={styles.legend}>
            <span className={styles.num}>5</span>
            {f.you}
          </legend>
          {signedIn && <p className={form.hint}>{t(f.signedInAs, { name: signedIn.name })}</p>}
          <div className={form.row2}>
            <label className={form.field}>
              {f.name}
              <input className={form.input} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </label>
            <label className={form.field}>
              {f.phone}
              <span className={form.prefixed}>
                <span className={form.prefix}>+258</span>
                <input className={form.input} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="84 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </span>
            </label>
          </div>
          <label className={form.field}>
            {f.notes}
            <textarea className={form.textarea} rows={3} placeholder={f.notesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </label>
        </fieldset>
      </div>

      <aside className={styles.summary}>
        <span className="eyebrow">{f.requestEyebrow}</span>
        <dl className={styles.dl}>
          <div>
            <dt>{f.kind}</dt>
            <dd>{FITTING_KIND_LABELS[kind][locale]}</dd>
          </div>
          <div>
            <dt>{f.where}</dt>
            <dd>{stores.find((s) => s.code === store)?.location}</dd>
          </div>
          <div>
            <dt>{f.when}</dt>
            <dd>{date ? `${formatLongDate(date, locale)}${time ? `, ${time}` : ""}` : "—"}</dd>
          </div>
          {pieces.length > 0 && (
            <div>
              <dt>{f.piecesTitle}</dt>
              <dd>{pieces.map((s) => s.toUpperCase()).join(", ")}</dd>
            </div>
          )}
        </dl>
        {error && (
          <div role="alert" className={form.error}>
            {error}
          </div>
        )}
        <Button type="submit" block disabled={busy || !date || !time}>
          {f.submit}
        </Button>
        <span className={form.hint}>{f.privacy}</span>
        {!signedIn && (
          <Link href={href(`/sign-in?next=/${locale}/fitting`)} className={form.link}>
            {dict.account.tabs.login}
          </Link>
        )}
      </aside>
    </form>
  );
}
