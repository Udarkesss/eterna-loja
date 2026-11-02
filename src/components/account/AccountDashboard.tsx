"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { Button, ButtonLink } from "@/components/ui/Button";
import form from "@/components/ui/Form.module.css";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { LOYALTY_LEVELS } from "@/data/help";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { plural, t, type Dictionary } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import { BAR_POINTS, loyaltyOf, MT_PER_POINT, type Loyalty } from "@/lib/loyalty";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { formatLongDate, toMaputo } from "@/lib/time";
import type { CustomerDTO, FittingPublicDTO, IdentityProvider, MyOrderDTO } from "@/types";
import styles from "./Account.module.css";
import { useCustomer } from "./CustomerProvider";
import { accountError } from "./errors";

/**
 * EN: Customer area of design V3 ("Loja · Conta"): side menu with the level badge — O meu nível · As minhas reservas ·
 *     Encomendas · Os meus vouchers · Provas · Favoritos · Dados e formas de entrar (at least one method must stay
 *     linked) — and "Terminar sessão". On phones the menu becomes a row of pills. The section is kept in the address
 *     (#nivel, #encomendas…), so a link can open one directly.
 * PT: Área de cliente do V3: menu lateral com o selo do nível — O meu nível · As minhas reservas · Encomendas · Os meus
 *     vouchers · Provas · Favoritos · Dados e formas de entrar — e "Terminar sessão". No telemóvel o menu passa a uma
 *     fila de pílulas. A secção fica no endereço (#nivel, #encomendas…), para uma ligação abrir uma directamente.
 */

const SECTIONS = ["level", "reservations", "orders", "vouchers", "fittings", "favorites", "details"] as const;
type Section = (typeof SECTIONS)[number];
const HASH: Record<Section, string> = {
  level: "nivel",
  reservations: "reservas",
  orders: "encomendas",
  vouchers: "vouchers",
  fittings: "provas",
  favorites: "favoritos",
  details: "dados",
};

export function AccountDashboard(props: { customer: CustomerDTO; orders: MyOrderDTO[]; fittings: FittingPublicDTO[] }) {
  const { dict, locale, href } = useI18n();
  const a = dict.account;
  const router = useRouter();
  const { signOut, setCustomer } = useCustomer();
  const [customer, setLocal] = useState(props.customer);
  const [section, setSection] = useState<Section>("level");
  const tabs = useRef<HTMLElement>(null);
  const loyalty = useMemo(() => loyaltyOf(props.orders), [props.orders]);
  const first = customer.name.split(" ")[0];
  const level = loyalty.level;

  useEffect(() => {
    const fromHash = () => {
      const found = SECTIONS.find((s) => HASH[s] === window.location.hash.slice(1));
      if (found) setSection(found);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  // EN: On phones the active pill may be off screen: bring it into view. PT: No telemóvel, mostrar a pílula activa.
  useEffect(() => {
    tabs.current?.querySelector("[aria-current]")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [section]);

  const pick = (s: Section) => {
    setSection(s);
    window.history.replaceState(null, "", `#${HASH[s]}`);
  };

  const update = (c: CustomerDTO) => {
    setLocal(c);
    setCustomer(c);
  };

  async function onSignOut() {
    await signOut();
    router.push(href("/"));
    router.refresh();
  }

  const signOutButton = (className: string) => (
    <button type="button" className={className} onClick={onSignOut}>
      <Icon name="logout" size={16} />
      {a.signOut}
    </button>
  );

  return (
    <div className={`page-x ${styles.page}`}>
      <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
        <Link href={href("/")}>{dict.nav.homeCrumb}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{a.dashboardEyebrow}</span>
      </nav>
      <h1 className={styles.display}>
        <span className={styles.onWide}>
          <RichText text={a.title} />
        </span>
        <span className={styles.onPhone}>
          <RichText text={t(a.hello, { name: `*${first}*` })} />
        </span>
      </h1>

      <div className={styles.layout}>
        <aside className={styles.aside}>
          <div className={styles.hello}>
            <span className={styles.subtitle}>{t(a.hello, { name: first })}</span>
            <span className={styles.badge}>
              <span style={{ color: level.color, display: "flex" }}>
                <Icon name={level.icon} size={13} />
              </span>
              {level.name[locale]}
            </span>
          </div>
          <nav ref={tabs} aria-label={a.dashboardEyebrow} className={styles.tabs}>
            {SECTIONS.map((id) => (
              <button key={id} type="button" className={styles.tab} aria-current={section === id ? "page" : undefined} onClick={() => pick(id)}>
                <span className={styles.onWide}>{a.sections[id]}</span>
                <span className={styles.onPhone}>{a.sectionsShort[id]}</span>
              </button>
            ))}
          </nav>
          {signOutButton(`${styles.signOut} ${styles.onWide}`)}
        </aside>

        <div className={styles.main}>
          {section === "level" && <LevelPanel loyalty={loyalty} />}
          {section === "reservations" && (
            <EmptyPanel title={a.sections.reservations} intro={a.reservationsBody} empty={a.noReservations}>
              <Link href={`${href("/como-comprar")}#reservar`} className={styles.link}>
                {a.howToReserve}
              </Link>
            </EmptyPanel>
          )}
          {section === "orders" && <OrdersPanel orders={props.orders} />}
          {section === "vouchers" && <EmptyPanel title={a.sections.vouchers} intro={a.vouchersBody} empty={a.noVouchers} />}
          {section === "fittings" && <FittingsPanel fittings={props.fittings} />}
          {section === "favorites" && (
            <section className={styles.stack}>
              <h2 className={styles.title}>{a.sections.favorites}</h2>
              <FavoritesList />
            </section>
          )}
          {section === "details" && (
            <section className={styles.stack}>
              <h2 className={styles.title}>{a.sections.details}</h2>
              <ProfileForm customer={customer} onSaved={update} />
              <WaysPanel customer={customer} onChange={update} />
            </section>
          )}
          {signOutButton(`${styles.signOut} ${styles.onPhone}`)}
        </div>
      </div>
    </div>
  );
}

/** EN: "O meu nível": this year's level, the year's points towards next year, the four levels. PT: O nível e os pontos. */
function LevelPanel({ loyalty }: { loyalty: Loyalty }) {
  const { dict, locale, href } = useI18n();
  const a = dict.account;
  const { year, level, points, spent, upcoming, missing, nextLevel } = loyalty;
  const pos = (p: number) => `${(Math.min(p, BAR_POINTS) / BAR_POINTS) * 100}%`;

  return (
    <section className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardCol}>
          <span className="eyebrow">{t(a.levelEyebrow, { year })}</span>
          <span className={styles.levelHead}>
            <span style={{ color: level.color, display: "flex" }}>
              <Icon name={level.icon} size={44} />
            </span>
            <span className={styles.levelName}>{level.name[locale]}</span>
          </span>
          <p className={styles.body}>
            <RichText text={level.pct ? t(a.levelDiscount, { pct: level.pct, year }) : t(a.levelNoDiscount, { next: year + 1 })} />
          </p>
          {level.pct > 0 && <p className={styles.small}>{a.levelNote}</p>}
        </div>
        <div className={styles.cardCol}>
          <span className="label">{t(a.purchases, { year })}</span>
          <span className={styles.points}>{plural(a.points, points)}</span>
          <span className={styles.small}>{t(a.spent, { amount: formatMZN(spent, locale) })}</span>
          <div className={styles.bar}>
            <span className={styles.barFill} style={{ width: pos(points) }} />
            {LOYALTY_LEVELS.slice(1).map((l) => (
              <Fragment key={l.key}>
                <span className={styles.mark} style={{ left: pos(l.min) }} />
                <span className={styles.markLabel} style={{ left: pos(l.min) }}>
                  {l.name[locale]} · {l.min}
                </span>
              </Fragment>
            ))}
            <span className={styles.barValue} style={{ left: `clamp(16px, ${pos(points)}, calc(100% - 16px))` }}>
              {t(a.pts, { count: points })}
            </span>
          </div>
          <p className={styles.body14}>
            <RichText
              text={
                upcoming
                  ? t(a.missing, {
                      points: plural(a.points, missing),
                      amount: formatMZN(missing * MT_PER_POINT, locale),
                      level: upcoming.name[locale],
                      next: year + 1,
                    })
                  : t(a.top, { level: nextLevel.name[locale], next: year + 1 })
              }
            />
          </p>
          <span className={styles.xs}>{t(a.review, { year })}</span>
        </div>
      </div>

      <div className={styles.levels}>
        {LOYALTY_LEVELS.map((l) => (
          <div key={l.key} className={styles.level} aria-current={l.key === level.key ? "true" : undefined}>
            <span className={styles.levelTitle}>
              <span style={{ color: l.color, display: "flex" }}>
                <Icon name={l.icon} size={22} />
              </span>
              {l.name[locale]}
            </span>
            <span className={styles.xs}>{l.max == null ? t(a.levelFrom, { min: l.min }) : t(a.levelRange, { min: l.min, max: l.max })}</span>
            <span className={styles.pct}>{l.pct}%</span>
          </div>
        ))}
      </div>
      <Link href={href("/fidelidade")} className={styles.link}>
        {a.howItWorks}
      </Link>
    </section>
  );
}

/** EN: Reservations and vouchers until those modules are on: title, how it works, empty state. PT: Estado vazio. */
function EmptyPanel({ title, intro, empty, children }: { title: string; intro: string; empty: string; children?: ReactNode }) {
  return (
    <section className={styles.stack}>
      <div className={styles.panelHead}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.small}>{intro}</p>
      </div>
      <p className={styles.empty}>{empty}</p>
      {children}
    </section>
  );
}

/** EN: State of an order in one line, for the table. PT: Estado de uma encomenda numa linha, para a tabela. */
function orderState(o: MyOrderDTO, a: Dictionary["account"]): { label: string; tone: "ok" | "warn" | "danger" | "muted" } {
  if (o.fulfillmentStatus === "cancelled") return { label: a.state.cancelled, tone: "muted" };
  if (o.paymentStatus !== "paid") return { label: a.payment[o.paymentStatus], tone: o.paymentStatus === "pending" ? "warn" : "danger" };
  switch (o.fulfillmentStatus) {
    case "pending":
    case "assigned":
      return { label: o.fulfillmentType === "pickup" ? a.state.preparingPickup : a.state.preparingDelivery, tone: "warn" };
    case "ready":
      return { label: a.state.ready, tone: "ok" };
    case "collected":
      return { label: a.state.collected, tone: "ok" };
    case "in_transit":
      return { label: a.state.onTheWay, tone: "warn" };
    default:
      return { label: a.state.delivered, tone: "ok" };
  }
}

function OrdersPanel({ orders }: { orders: MyOrderDTO[] }) {
  const { dict, locale, href } = useI18n();
  const a = dict.account;
  const h = a.ordersTable;
  return (
    <section className={styles.stack}>
      <h2 className={styles.title}>{a.sections.orders}</h2>
      {orders.length === 0 ? (
        <p className={styles.empty}>{a.noOrders}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{h.number}</th>
              <th>{h.date}</th>
              <th>{h.pieces}</th>
              <th>{h.total}</th>
              <th>{h.state}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const state = orderState(o, a);
              return (
                <tr key={o.id}>
                  <td>
                    <Link href={href(`/order/${o.id}`)} className={styles.orderLink}>
                      {o.number}
                    </Link>
                  </td>
                  <td>{formatLongDate(toMaputo(o.createdAt).date, locale)}</td>
                  <td>{o.items.map((i) => i.code).join(", ")}</td>
                  <td className={styles.num}>{formatMZN(o.total, locale)}</td>
                  <td>
                    <span className={styles.state} data-tone={state.tone}>
                      {state.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FittingsPanel({ fittings }: { fittings: FittingPublicDTO[] }) {
  const { dict, locale, href } = useI18n();
  const a = dict.account;
  return (
    <section className={styles.stack}>
      <h2 className={styles.title}>{a.sections.fittings}</h2>
      {fittings.length === 0 && <p className={styles.empty}>{a.noFittings}</p>}
      <div className={styles.list}>
        {fittings.map((f) => {
          const when = toMaputo(f.startsAt);
          return (
            <Link key={f.token} href={href(`/fitting/${f.token}`)} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{FITTING_KIND_LABELS[f.kind][locale]}</span>
                <span className={styles.rowSub}>
                  {formatLongDate(when.date, locale)}, {when.time} · Loja {f.store.code} · {f.code}
                </span>
              </span>
              <span className={styles.chip} data-tone={f.status}>
                {dict.fitting.status[f.status]}
              </span>
            </Link>
          );
        })}
      </div>
      <div>
        <ButtonLink href={href("/fitting")}>{a.bookFitting}</ButtonLink>
      </div>
    </section>
  );
}

function ProfileForm({ customer, onSaved }: { customer: CustomerDTO; onSaved: (c: CustomerDTO) => void }) {
  const { dict } = useI18n();
  const a = dict.account;
  const [name, setName] = useState(customer.name);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      onSaved(await api.updateMe({ name }));
      setStatus({ ok: true, text: a.saved });
    } catch (err) {
      setStatus({ ok: false, text: accountError(err, dict) });
    }
  }

  return (
    <form className={`${form.form} ${styles.narrow}`} onSubmit={submit}>
      {status && <div className={status.ok ? form.notice : form.error}>{status.text}</div>}
      <label className={form.field}>
        {a.name}
        <input className={form.input} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
      </label>
      {customer.email && (
        <label className={form.field}>
          {a.email}
          <input className={form.input} value={customer.email} readOnly />
        </label>
      )}
      {customer.phone && (
        <label className={form.field}>
          {a.waNumber}
          <input className={form.input} value={`+258 ${formatMsisdn(customer.phone)}`} readOnly />
        </label>
      )}
      <div>
        <Button type="submit">{a.save}</Button>
      </div>
    </form>
  );
}

function WaysPanel({ customer, onChange }: { customer: CustomerDTO; onChange: (c: CustomerDTO) => void }) {
  const { dict } = useI18n();
  const a = dict.account;
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const linked = (p: IdentityProvider) => customer.identities.find((i) => i.provider === p);
  const count = customer.identities.length;

  async function unlink(p: IdentityProvider) {
    try {
      onChange(await api.unlinkIdentity(p));
      setNotice({ ok: true, text: t(a.unlinked, { way: a.wayTitles[p] }) });
    } catch (err) {
      setNotice({ ok: false, text: accountError(err, dict) });
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await api.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      setNotice({ ok: true, text: a.passwordChanged });
    } catch (err) {
      setNotice({ ok: false, text: accountError(err, dict) });
    }
  }

  return (
    <section className={`${form.form} ${styles.narrow}`}>
      <p className={form.hint}>{a.waysIntro}</p>
      {notice && <div className={notice.ok ? form.notice : form.error}>{notice.text}</div>}
      <ul className={styles.ways}>
        {(["email", "whatsapp", "google", "facebook"] as const).map((p) => {
          const id = linked(p);
          const last = !!id && count === 1;
          return (
            <li key={p} className={styles.way}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{a.wayTitles[p]}</span>
                <span className={styles.rowSub} data-on={!!id}>
                  {id ? id.label : a.notLinked}
                </span>
              </span>
              {id ? (
                <button type="button" className={styles.wayBtn} data-danger disabled={last} onClick={() => unlink(p)} aria-label={`${a.unlink} ${a.wayTitles[p]}`}>
                  {a.unlink}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.wayBtn}
                  onClick={() => setNotice({ ok: true, text: t(a.socialSoon, { provider: a.wayTitles[p] }) })}
                  aria-label={`${a.link} ${a.wayTitles[p]}`}
                >
                  {a.link}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {linked("whatsapp") && <span className={form.hint}>{a.waConfirmedNote}</span>}

      {customer.hasPassword && (
        <form className={form.panel} onSubmit={changePassword}>
          <strong className={styles.rowTitle}>{a.changePassword}</strong>
          <label className={form.field}>
            {a.currentPassword}
            <input className={form.input} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </label>
          <label className={form.field}>
            {a.newPassword}
            <input className={form.input} type="password" autoComplete="new-password" placeholder={a.passwordHint} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={10} />
          </label>
          <div>
            <Button type="submit" variant="outline">
              {a.save}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
