"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useCustomer } from "@/components/account/CustomerProvider";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { mainNav } from "@/data/site";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiClientError, api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import { formatMsisdn, methodFromMsisdn, normalizeMsisdn, OPERATOR_NAMES } from "@/lib/payments/msisdn";
import { formatLongDate, shortWeekday } from "@/lib/time";
import type { BridalBookingDTO, MobileMethod } from "@/types";
import styles from "./Bridal.module.css";

/**
 * EN: "Agendar prova de noiva" of design V3: 1. dresses (with favourites, collection tabs and code search) · 2. package
 *     and extra dresses · 3. day and time · 4. details · 5. payment with the Eterna Bridal terms; summary on the side.
 *     After paying, the page waits for the confirmation (mobile money PIN or card) and shows the booked fitting.
 * PT: "Agendar prova de noiva" do V3: 1. vestidos · 2. pacote e vestidos extra · 3. dia e hora · 4. dados ·
 *     5. pagamento com os termos da Eterna Bridal; resumo ao lado. Depois de pagar, a página espera pela confirmação.
 */

interface Pkg {
  key: string;
  name: string;
  dresses: number;
  minutes: number;
  price: number;
  includes: string;
  soon: boolean;
}
type Method = "card" | "mpesa" | "emola" | "mkesh" | "test";

export function BridalBooking(props: {
  settings: {
    enabled: boolean;
    packages: Pkg[];
    extraMax: number;
    extraPrice: number;
    discountDays: number;
    advanceHours: number;
    cancelHours: number;
    companions: number;
    requireTerms: boolean;
    termsUrl: string | null;
  };
  dresses: { slug: string; code: string; collection: string; image: string | null }[];
  days: { date: string; open: boolean; times: { time: string; free: boolean }[] }[];
  methods: Method[];
  initialPieces: string[];
  customer: { name: string; email: string | null; phone: string | null } | null;
}) {
  const { locale, dict, href } = useI18n();
  const b = dict.bridal;
  const { slugs: favorites } = useFavorites();
  const { customer: live } = useCustomer();
  const signed = live ?? props.customer;
  const S = props.settings;
  const bookable = S.packages.filter((p) => !p.soon);

  const [chosen, setChosen] = useState<string[]>(() => props.initialPieces.filter((s) => props.dresses.some((d) => d.slug === s)));
  const [tab, setTab] = useState("");
  const [query, setQuery] = useState("");
  const [pkgKey, setPkgKey] = useState(bookable[0]?.key ?? "");
  const [extras, setExtras] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(signed?.name ?? "");
  const [email, setEmail] = useState(signed?.email ?? "");
  const [phone, setPhone] = useState(signed?.phone ? formatMsisdn(signed.phone) : "");
  const [wedding, setWedding] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<Method | null>(props.methods.includes("mpesa") ? "mpesa" : (props.methods[0] ?? null));
  const [msisdn, setMsisdn] = useState(signed?.phone ? formatMsisdn(signed.phone) : "");
  const [terms, setTerms] = useState(!S.requireTerms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BridalBookingDTO | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const pkg = S.packages.find((p) => p.key === pkgKey) ?? null;
  const max = (pkg?.dresses ?? 0) + extras;
  const total = pkg ? pkg.price + extras * S.extraPrice : 0;
  const collections = useMemo(() => [...new Set(props.dresses.map((d) => d.collection).filter(Boolean))], [props.dresses]);
  const q = query.trim().toLowerCase();
  const list = props.dresses
    .filter((d) => !tab || d.collection === tab)
    .filter((d) => !q || d.code.toLowerCase().includes(q))
    // EN: Favourites first. PT: Favoritos primeiro.
    .sort((x, y) => Number(favorites.includes(y.slug)) - Number(favorites.includes(x.slug)));
  const mobile = method === "mpesa" || method === "emola" || method === "mkesh";
  const digits = normalizeMsisdn(msisdn);
  const numberOk = !mobile || (!!digits && methodFromMsisdn(digits) === method);
  const ready = !!pkg && chosen.length > 0 && chosen.length <= max && !!date && !!time && name.trim().length >= 2 && !!normalizeMsisdn(phone) && !!method && numberOk;
  const duration = (m: number) => (m % 60 === 0 ? plural(b.hours, m / 60) : t(b.minutes, { count: m }));

  useEffect(() => () => void (poll.current && clearInterval(poll.current)), []);

  function toggle(slug: string) {
    setChosen((c) => {
      if (c.includes(slug)) {
        setLimitHit(false);
        return c.filter((s) => s !== slug);
      }
      if (c.length >= max) {
        setLimitHit(true);
        return c;
      }
      return [...c, slug];
    });
  }

  function follow(token: string) {
    poll.current = setInterval(async () => {
      try {
        const next = await api.bridalFittingPayment(token);
        setBooking(next);
        if (next.paymentStatus !== "pending" && poll.current) {
          clearInterval(poll.current);
          poll.current = null;
          if (next.paymentStatus === "failed") setError(b.failed);
        }
      } catch {
        // EN: try again on the next tick. PT: tenta de novo.
      }
    }, 3000);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !terms || !pkg || !date || !time || !method) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.bookBridalFitting({
        locale,
        productSlugs: chosen,
        packageKey: pkg.key,
        extras,
        date,
        time,
        name: name.trim(),
        email: email.trim(),
        phone,
        weddingDate: wedding,
        notes: notes.trim() || undefined,
        method,
        msisdn: mobile ? msisdn : undefined,
        acceptTerms: terms,
      });
      setBooking(created);
      if (created.paymentStatus === "pending") follow(created.token);
      if (created.paymentStatus === "failed") setError(b.failed);
    } catch (err) {
      setError(err instanceof ApiClientError && err.code === "SLOT_TAKEN" ? b.slotTaken : b.error);
    } finally {
      setBusy(false);
    }
  }

  // ── Booked / Marcada ──
  if (booking?.paymentStatus === "paid") {
    return (
      <div data-theme="bridal" className={styles.theme}>
        <section className={`page-x ${styles.done}`}>
          <Image src="/images/brand/eterna-bridal-logo.svg" alt="Eterna Bridal" width={160} height={60} unoptimized className={styles.logo} />
          <h1 className={styles.display}>
            <RichText text={b.doneTitle} />
          </h1>
          <p className={styles.lead}>
            {formatLongDate(booking.startsAt.slice(0, 10), locale)} · {time} · {b.storeLine}
          </p>
          <p className={styles.muted}>{t(b.doneBody, { total: formatMZN(booking.amount, locale), code: booking.code })}</p>
          <Link href={href(`/fitting/${booking.token}`)} className={styles.btn}>
            {b.seeFitting}
          </Link>
        </section>
      </div>
    );
  }

  const waiting = booking?.paymentStatus === "pending";

  return (
    <div data-theme="bridal" className={styles.theme}>
      <section className={`page-x ${styles.page}`}>
        <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
          <Link href={href("/")}>{dict.nav.homeCrumb}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`${href("/")}#noivas`}>{mainNav[2].label[locale]}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{b.crumb}</span>
        </nav>

        <div className={styles.intro}>
          <div className={styles.introText}>
            <Image src="/images/brand/eterna-bridal-logo.svg" alt="Eterna Bridal" width={160} height={60} unoptimized className={styles.logo} />
            <h1 className={styles.display}>
              <RichText text={b.title} />
            </h1>
            <p className={styles.lead}>{b.lead}</p>
            <p className={styles.muted}>{b.intro}</p>
          </div>
          <div className={styles.prepare}>
            <span className={styles.script}>{b.prepareTitle}</span>
            <ul>
              {b.rules.map((r) => (
                <li key={r}>
                  <Icon name="check" size={15} />
                  <span>{t(r, { companions: S.companions, advance: S.advanceHours, cancel: S.cancelHours })}</span>
                </li>
              ))}
            </ul>
            {S.termsUrl && (
              <a href={S.termsUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                <Icon name="file" size={15} />
                {b.termsPdf}
              </a>
            )}
          </div>
        </div>

        {!S.enabled ? (
          <p className={styles.off}>{b.off}</p>
        ) : (
          <>
            <ol className={styles.steps}>
              {b.steps.map((s, i) => (
                <li key={s}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>

            <form className={styles.layout} onSubmit={submit}>
              <div className={styles.flow}>
                {/* 1. Vestidos */}
                <section>
                  <Step n={1} title={b.dressesTitle} sub={t(b.dressesCount, { n: chosen.length, max })} />
                  <p className={styles.muted}>{b.dressesIntro}</p>
                  <div className={styles.tools}>
                    <label className={styles.search}>
                      <Icon name="search" size={16} />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={b.searchPlaceholder} aria-label={b.searchPlaceholder} />
                    </label>
                    <div className={styles.seg}>
                      {["", ...collections].map((c) => (
                        <button key={c || "all"} type="button" aria-pressed={tab === c} onClick={() => setTab(c)}>
                          {c || b.all}
                        </button>
                      ))}
                    </div>
                  </div>
                  {limitHit && pkg && (
                    <p className={styles.warn}>
                      <Icon name="info" size={18} />
                      {t(b.limit, { pkg: pkg.name, max, extraMax: S.extraMax })}
                    </p>
                  )}
                  {list.length === 0 ? (
                    <p className={styles.muted}>{b.noDresses}</p>
                  ) : (
                    <div className={styles.dresses}>
                      {list.map((d) => {
                        const on = chosen.includes(d.slug);
                        return (
                          <button key={d.slug} type="button" className={styles.dress} aria-pressed={on} onClick={() => toggle(d.slug)}>
                            <span className={styles.dressImage}>
                              {d.image && <Image src={d.image} alt="" fill sizes="(min-width: 1024px) 220px, 45vw" />}
                              {on && (
                                <span className={styles.mark}>
                                  <Icon name="check" size={14} />
                                </span>
                              )}
                            </span>
                            <span className={styles.dressCode}>{d.code}</span>
                            <span className={styles.small}>{d.collection}</span>
                            {favorites.includes(d.slug) && (
                              <span className={styles.badge}>
                                <Icon name="heart" size={12} />
                                {b.favorite}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 2. Pacote */}
                <section>
                  <Step n={2} title={b.packageTitle} />
                  <div className={styles.packages}>
                    {S.packages.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={styles.package}
                        aria-pressed={p.key === pkgKey}
                        aria-disabled={p.soon}
                        onClick={() => {
                          if (p.soon) return;
                          setPkgKey(p.key);
                          setLimitHit(false);
                          setChosen((c) => c.slice(0, p.dresses + extras));
                        }}
                      >
                        <span className={styles.pkgHead}>
                          <span className={styles.pkgName}>{p.name}</span>
                          {p.soon && <span className={styles.badge}>{b.soon}</span>}
                        </span>
                        <span className={styles.small}>{t(b.upTo, { n: p.dresses, duration: duration(p.minutes) })}</span>
                        <span className={styles.pkgPrice}>{formatMZN(p.price, locale)}</span>
                        {p.soon && p.includes && <span className={styles.xs}>{p.includes}</span>}
                      </button>
                    ))}
                  </div>
                  {S.extraMax > 0 && (
                    <div className={styles.extras}>
                      <span>
                        <strong>{b.extrasTitle}</strong> · {t(b.extrasBody, { price: formatMZN(S.extraPrice, locale), max: S.extraMax })}
                      </span>
                      <span className={styles.stepper}>
                        <button type="button" aria-label={b.lessExtra} disabled={extras === 0} onClick={() => setExtras(extras - 1)}>
                          <Icon name="minus" size={14} />
                        </button>
                        <b>{extras}</b>
                        <button type="button" aria-label={b.moreExtra} disabled={extras >= S.extraMax} onClick={() => setExtras(extras + 1)}>
                          <Icon name="plus" size={14} />
                        </button>
                      </span>
                    </div>
                  )}
                  <span className={styles.xs}>{t(b.packagesNote, { companions: S.companions })}</span>
                </section>

                {/* 3. Data e hora */}
                <section>
                  <Step n={3} title={b.dateTitle} />
                  <div className={styles.days}>
                    {props.days.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        className={styles.day}
                        disabled={!d.open}
                        aria-pressed={d.date === date}
                        onClick={() => {
                          setDate(d.date);
                          setTime(null);
                        }}
                      >
                        <span className={styles.xs}>{shortWeekday(d.date, locale)}</span>
                        <span className={styles.dayNum}>{Number(d.date.slice(8))}</span>
                      </button>
                    ))}
                  </div>
                  {date && (
                    <div className={styles.times}>
                      {props.days
                        .find((d) => d.date === date)
                        ?.times.map((x) => (
                          <button key={x.time} type="button" className={styles.time} disabled={!x.free} aria-pressed={x.time === time} onClick={() => setTime(x.time)}>
                            {x.time}
                          </button>
                        ))}
                    </div>
                  )}
                  <span className={styles.xs}>{t(b.dateNote, { advance: S.advanceHours })}</span>
                </section>

                {/* 4. Dados */}
                <section>
                  <Step n={4} title={b.detailsTitle} />
                  <div className={styles.fields}>
                    <label>
                      {b.name}
                      <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
                    </label>
                    <label>
                      {b.email}
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    </label>
                    <label>
                      {b.phone}
                      <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="84 123 4567" required autoComplete="tel" />
                    </label>
                    <label>
                      {b.wedding}
                      <input type="date" value={wedding} onChange={(e) => setWedding(e.target.value)} />
                    </label>
                    <label className={styles.wide}>
                      {b.notes}
                      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={b.notesPlaceholder} />
                    </label>
                  </div>
                </section>

                {/* 5. Pagamento */}
                <section className={styles.pay}>
                  <Step n={5} title={b.payTitle} sub={b.payMethods} />
                  <div className={styles.methods}>
                    {props.methods.map((m) => (
                      <label key={m} className={styles.method} data-on={m === method || undefined}>
                        <input type="radio" name="method" checked={m === method} onChange={() => setMethod(m)} />
                        <span>
                          <span className={styles.methodName}>{dict.checkout.methods[m].title}</span>
                          <span className={styles.xs}>{dict.checkout.methods[m].sub}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {mobile && method && (
                    <div className={styles.phoneBox}>
                      <span className={styles.label}>{t(b.number, { method: OPERATOR_NAMES[method as MobileMethod] })}</span>
                      <span className={styles.phoneInput}>
                        <span>+258</span>
                        <input inputMode="numeric" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="84 123 4567" aria-label={t(b.number, { method: OPERATOR_NAMES[method as MobileMethod] })} />
                      </span>
                      <span className={styles.xs}>{b.pinNote}</span>
                    </div>
                  )}
                  {S.requireTerms && (
                    <label className={styles.terms}>
                      <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
                      <span>
                        <RichText text={t(b.terms, { days: S.discountDays })} />
                      </span>
                    </label>
                  )}
                  {error && (
                    <p role="alert" className={styles.error}>
                      {error}
                    </p>
                  )}
                  {waiting ? (
                    <p role="status" className={styles.waiting}>
                      <Icon name="clock" size={18} />
                      {b.waiting}
                    </p>
                  ) : (
                    <button type="submit" className={styles.submit} disabled={!ready || !terms || busy}>
                      {t(b.pay, { total: formatMZN(total, locale) })}
                    </button>
                  )}
                  {!waiting && (!ready ? <span className={styles.xs}>{b.completeFirst}</span> : !terms && <span className={styles.xs}>{b.acceptFirst}</span>)}
                </section>
              </div>

              <aside className={styles.summary}>
                <span className={styles.eyebrow}>{b.summaryEyebrow}</span>
                <span className={styles.script}>{b.summaryTitle}</span>
                <span className={styles.line}>
                  <Icon name="store" size={16} />
                  {b.storeLine}
                </span>
                <span className={styles.line}>
                  <Icon name="calendar" size={16} />
                  {date && time ? `${formatLongDate(date, locale)} · ${time}` : b.pickDate}
                </span>
                {pkg && (
                  <span className={styles.line}>
                    <Icon name="dress" size={16} />
                    {t(b.packageLine, { pkg: pkg.name, duration: duration(pkg.minutes), n: chosen.length, max })}
                  </span>
                )}
                {chosen.length > 0 && (
                  <span className={styles.chosen}>
                    {chosen.map((slug) => {
                      const d = props.dresses.find((x) => x.slug === slug);
                      return d?.image ? <Image key={slug} src={d.image} alt={d.code} width={54} height={72} /> : null;
                    })}
                  </span>
                )}
                <dl className={styles.totals}>
                  <div>
                    <dt>{t(b.packagePrice, { pkg: pkg?.name ?? "" })}</dt>
                    <dd>{pkg ? formatMZN(pkg.price, locale) : "—"}</dd>
                  </div>
                  <div>
                    <dt>{b.extras}</dt>
                    <dd>{extras ? `${extras} × ${formatMZN(S.extraPrice, locale)}` : "—"}</dd>
                  </div>
                  <div className={styles.grand}>
                    <dt>{b.total}</dt>
                    <dd>{formatMZN(total, locale)}</dd>
                  </div>
                </dl>
                <span className={styles.xs}>{t(b.discountNote, { days: S.discountDays })}</span>
              </aside>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Step({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepNum}>{n}</span>
      <h2 className={styles.stepTitle}>{title}</h2>
      {sub && <span className={styles.small}>{sub}</span>}
    </div>
  );
}
