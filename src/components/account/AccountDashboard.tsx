"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { Button, ButtonLink } from "@/components/ui/Button";
import form from "@/components/ui/Form.module.css";
import { RichText } from "@/components/ui/RichText";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { formatLongDate, toMaputo } from "@/lib/time";
import type { CustomerDTO, FittingPublicDTO, IdentityProvider, MyOrderDTO } from "@/types";
import styles from "./Account.module.css";
import { useCustomer } from "./CustomerProvider";
import { accountError } from "./errors";

/**
 * EN: Customer area. Sections: orders, fittings, favourites, personal details, "Formas de entrar"
 *     (design: at least one method must stay linked) and change password.
 * PT: Área de cliente. Secções: encomendas, provas, favoritos, dados pessoais, "Formas de entrar"
 *     (tem de ficar sempre pelo menos uma) e alterar palavra-passe.
 */

const SECTIONS = ["orders", "fittings", "favorites", "profile", "ways"] as const;
type Section = (typeof SECTIONS)[number];

export function AccountDashboard(props: { customer: CustomerDTO; orders: MyOrderDTO[]; fittings: FittingPublicDTO[] }) {
  const { dict, locale, href } = useI18n();
  const a = dict.account;
  const router = useRouter();
  const { signOut, setCustomer } = useCustomer();
  const [customer, setLocal] = useState(props.customer);
  const [section, setSection] = useState<Section>("orders");

  const update = (c: CustomerDTO) => {
    setLocal(c);
    setCustomer(c);
  };

  async function onSignOut() {
    await signOut();
    router.push(href("/"));
    router.refresh();
  }

  return (
    <div className={`page-x ${styles.wrap}`}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <span className="eyebrow">{a.dashboardEyebrow}</span>
          <h1 className={styles.title}>
            <RichText text={t(a.hello, { name: `*${customer.name.split(" ")[0]}*` })} />
          </h1>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          {a.signOut}
        </Button>
      </header>

      <div role="tablist" aria-label={a.dashboardEyebrow} className={`${form.tabs} ${styles.tabs}`}>
        {SECTIONS.map((id) => (
          <button key={id} role="tab" aria-selected={section === id} className={form.tab} onClick={() => setSection(id)}>
            {a.sections[id]}
          </button>
        ))}
      </div>

      {section === "orders" && (
        <section className={styles.list}>
          {props.orders.length === 0 && <p className={styles.empty}>{a.noOrders}</p>}
          {props.orders.map((o) => (
            <Link key={o.id} href={href(`/order/${o.id}`)} className={styles.row}>
              <span className={styles.thumbs}>
                {o.items.slice(0, 3).map((i, n) =>
                  i.imageUrl ? <Image key={n} src={i.imageUrl} alt="" width={48} height={60} className={styles.thumb} /> : null,
                )}
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{o.number}</span>
                <span className={styles.rowSub}>
                  {formatLongDate(toMaputo(o.createdAt).date, locale)} · {o.items.map((i) => i.code).join(", ")}
                </span>
              </span>
              <span className={styles.rowSide}>
                <span>{formatMZN(o.total, locale)}</span>
                <span className={styles.chip} data-tone={o.paymentStatus}>
                  {a.payment[o.paymentStatus]}
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}

      {section === "fittings" && (
        <section className={styles.list}>
          {props.fittings.length === 0 && <p className={styles.empty}>{a.noFittings}</p>}
          {props.fittings.map((f) => {
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
          <div>
            <ButtonLink href={href("/fitting")}>{a.bookFitting}</ButtonLink>
          </div>
        </section>
      )}

      {section === "favorites" && (
        <section>
          <FavoritesList />
        </section>
      )}

      {section === "profile" && <ProfileForm customer={customer} onSaved={update} />}
      {section === "ways" && <WaysPanel customer={customer} onChange={update} />}
    </div>
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
