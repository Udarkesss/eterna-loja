"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { describeLine, useCartProducts } from "@/components/cart/useCartProducts";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { whatsappLink } from "@/data/site";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiClientError, api } from "@/lib/api-client";
import { cartTotal } from "@/lib/cart";
import { formatMZN } from "@/lib/format";
import { methodFromMsisdn, normalizeMsisdn, OPERATOR_NAMES } from "@/lib/payments/msisdn";
import { createOrderSchema, type CreateOrderInput } from "@/lib/validation";
import type { CheckoutOptionsDTO, MobileMethod, OrderStatusDTO, PaymentMethod } from "@/types";
import type { MapPoint } from "./DeliveryMap";
import styles from "./Checkout.module.css";

const DeliveryMap = dynamic(() => import("./DeliveryMap").then((m) => m.DeliveryMap), { ssr: false });

const MOBILE: readonly PaymentMethod[] = ["mpesa", "emola", "mkesh"];
const isMobile = (m: PaymentMethod | null): m is MobileMethod => !!m && MOBILE.includes(m);
const METHOD_ICON: Record<PaymentMethod, IconName> = {
  card: "card",
  mpesa: "device",
  emola: "device",
  mkesh: "device",
  transfer: "bank",
  cod: "cash",
};

type Phase = "form" | "processing" | "pending" | "success" | "failed";

/** EN: Digits → "84 123 4567" while typing (design). PT: Dígitos → "84 123 4567" ao escrever. */
function formatPhone(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("258")) d = d.slice(3);
  d = d.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join(" ");
}

/**
 * EN: Checkout — design "Checkout · 6 métodos de pagamento". Card details are validated here only to match the
 *     design; they are NEVER sent to our server (phase 6 swaps the fields for the gateway's secure fields).
 * PT: Checkout — design "Checkout · 6 métodos de pagamento". Os dados do cartão só são validados aqui para seguir o
 *     design; NUNCA são enviados ao nosso servidor (na fase 6 são trocados pelos campos seguros do gateway).
 */
export function CheckoutView() {
  const { locale, dict, href } = useI18n();
  const c = dict.checkout;
  const { clear } = useCart();
  const { lines, products, loading } = useCartProducts();

  const [options, setOptions] = useState<CheckoutOptionsDTO | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [order, setOrder] = useState<OrderStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Form state / Estado do formulário ──
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("delivery");
  const [storeCode, setStoreCode] = useState("02");
  const [city, setCity] = useState(c.cities[0]);
  const [neighbourhood, setNeighbourhood] = useState("");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });
  const [file, setFile] = useState<File | null>(null);
  const [changeFor, setChangeFor] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    api.checkoutOptions(locale).then(setOptions).catch(() => setOptions({ methods: [], pickupStores: [], zones: [] }));
  }, [locale]);

  // ── Totals / Totais ──
  const priceOf = (slug: string) => {
    const p = products[slug];
    return p ? (p.salePrice ?? p.price) : undefined;
  };
  const subtotal = cartTotal(lines, priceOf);
  const zone =
    delivery === "delivery"
      ? options?.zones.find((z) => z.neighbourhoods.some((n) => n.toLowerCase() === neighbourhood.trim().toLowerCase()))
      : undefined;
  const fee = delivery === "pickup" ? 0 : (zone?.fee ?? 0);
  const total = subtotal + fee;
  const totalLabel = formatMZN(order?.total ?? total, locale);
  const shipLabel = delivery === "pickup" ? c.free : zone ? (zone.fee != null ? formatMZN(zone.fee, locale) : c.feeToSet) : c.byZone;

  // ── Phone checks (design) / Verificação do número ──
  const digits = phone.replace(/\D/g, "");
  const detected = methodFromMsisdn(digits);
  const phoneValid = !!normalizeMsisdn(digits);
  let phoneError = "";
  let switchTo: MobileMethod | null = null;
  if (isMobile(method) && (touched || digits.length >= 9)) {
    if (!digits.length) phoneError = c.phone.empty;
    else if (!phoneValid) phoneError = c.phone.invalid;
    else if (detected && detected !== method) {
      phoneError = t(c.phone.mismatch, { operator: OPERATOR_NAMES[detected], method: c.methods[detected].name });
      if (options?.methods.includes(detected)) switchTo = detected;
    }
  }

  const cardDigits = card.number.replace(/\D/g, "");
  const cardBrand = /^4/.test(cardDigits) ? "Visa" : /^(5[1-5]|2[2-7])/.test(cardDigits) ? "Mastercard" : "";
  const cardOk =
    cardDigits.length === 16 && /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp) && /^\d{3}$/.test(card.cvc) && card.name.trim().length > 2;

  const methodReady =
    method === "card" ? cardOk : isMobile(method) ? phoneValid && detected === method : method === "transfer" ? !!file : method === "cod";
  const payLabel = !method
    ? c.chooseMethod
    : method === "card"
      ? t(c.payCard, { total: totalLabel })
      : method === "transfer"
        ? c.sendProof
        : method === "cod"
          ? c.confirmOrder
          : t(c.payWith, { total: totalLabel, method: c.methods[method].name });

  // ── Status polling / Consulta do estado ──
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPolling, []);

  const follow = useCallback(
    (initial: OrderStatusDTO) => {
      stopPolling();
      poll.current = setInterval(async () => {
        try {
          const next = await api.getOrder(initial.id);
          setOrder(next);
          if (next.paymentStatus === "paid") {
            stopPolling();
            clear();
            setPhase("success");
          } else if (next.paymentStatus !== "pending") {
            stopPolling();
            setPhase("failed");
          }
        } catch {
          // EN: temporary network error: try again next tick. PT: erro de rede temporário.
        }
      }, 3000);
    },
    [clear],
  );

  // EN: Each new state starts at the top of the page. PT: Cada novo estado começa no topo da página.
  useEffect(() => {
    if (phase !== "form") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  // EN: Countdown to the mobile request expiry. PT: Contagem até o pedido expirar.
  useEffect(() => {
    if (phase !== "pending" || !order?.paymentExpiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(order.paymentExpiresAt!) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, order?.paymentExpiresAt]);

  function buildInput(): CreateOrderInput | null {
    if (!method) return null;
    const payment =
      method === "card"
        ? { method }
        : isMobile(method)
          ? { method, msisdn: digits }
          : method === "transfer"
            ? { method }
            : { method, changeFor: changeFor || undefined };
    const input = {
      locale,
      lines,
      contact: { name, email },
      fulfillment:
        delivery === "pickup"
          ? { type: "pickup" as const, storeCode }
          : { type: "delivery" as const, city, neighbourhood, address, lat: point?.lat, lng: point?.lng },
      payment,
      discountCode: discountCode || undefined,
    };
    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      setError(dict.errors.VALIDATION_ERROR);
      return null;
    }
    return parsed.data;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setTouched(true);
    setError(null);
    if (!methodReady) {
      if (method === "card") setError(dict.errors.cardInvalid);
      if (method === "transfer") setError(dict.errors.fileMissing);
      return;
    }
    const input = buildInput();
    if (!input) return;

    setSubmitting(true);
    try {
      let created = await api.createOrder(input);
      if (method === "transfer" && file) created = await api.uploadTransferProof(created.id, file);
      setOrder(created);

      if (created.paymentStatus === "paid" || method === "transfer" || method === "cod") {
        clear();
        setPhase("success");
      } else if (created.paymentStatus === "pending") {
        setPhase(method === "card" ? "processing" : "pending");
        follow(created);
      } else {
        setPhase("failed");
      }
    } catch (err) {
      setError(dict.errors[err instanceof ApiClientError ? err.code : "INTERNAL_ERROR"]);
    } finally {
      setSubmitting(false);
    }
  }

  async function backToForm() {
    stopPolling();
    if (order && order.paymentStatus === "pending") await api.cancelOrderPayment(order.id).catch(() => undefined);
    setOrder(null);
    setMethod(null);
    setPhone("");
    setTouched(false);
    setPhase("form");
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── Render ──
  if (loading || !options) return <p className={`page-x ${styles.loading}`}>{dict.common.loading}</p>;

  if (!lines.length && phase === "form") {
    return (
      <div className={`page-x ${styles.emptyCart}`}>
        <p className={styles.emptyTitle}>{dict.cart.empty}</p>
        <ButtonLink href={href("/")} variant="outline">
          {dict.cart.continue}
        </ButtonLink>
      </div>
    );
  }

  const stepIndex = phase === "success" ? 3 : 2;
  const methodName = order ? c.methods[order.paymentMethod].name : method ? c.methods[method].name : "";

  return (
    <>
      <ol aria-label={c.stepsLabel} className={`page-x ${styles.steps}`}>
        {c.steps.map((label, i) => (
          <li key={label} aria-current={i === stepIndex ? "step" : undefined} className={i <= stepIndex ? styles.stepOn : styles.stepOff}>
            <span className={`${styles.dot} ${i < stepIndex ? styles.dotDone : i === stepIndex ? styles.dotCurrent : ""}`}>
              {i < stepIndex ? "✓" : i + 1}
            </span>
            {label}
            {i < c.steps.length - 1 && <span className={styles.stepLine} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <section className={`page-x ${styles.layout}`}>
        <div>
          {phase === "form" && (
            <form onSubmit={submit} className={styles.form} noValidate>
              <h1 className={styles.title}>
                <RichText text={c.title} />
              </h1>

              {/* 1. Contacto */}
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>1.</span> {c.contact}
                </legend>
                <div className={styles.two}>
                  <label className={styles.field}>
                    {c.name}
                    <input className={styles.input} autoComplete="name" placeholder={c.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldHead}>
                      {c.email}
                      <span className={styles.hint}>{c.emailHint}</span>
                    </span>
                    <input className={styles.input} type="email" autoComplete="email" placeholder={c.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                </div>
              </fieldset>

              {/* 2. Entrega */}
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>2.</span> {c.delivery}
                </legend>
                <div className={styles.two}>
                  <label className={`${styles.option} ${delivery === "pickup" ? styles.optionOn : ""}`}>
                    <input type="radio" name="delivery" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} />
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{c.pickupTitle}</span>
                      <span className={styles.optionSub}>{t(c.pickupSub, { store: storeCode })}</span>
                    </span>
                    <span className={styles.optionPrice}>{c.free}</span>
                  </label>
                  <label className={`${styles.option} ${delivery === "delivery" ? styles.optionOn : ""}`}>
                    <input type="radio" name="delivery" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} />
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{c.homeTitle}</span>
                      <span className={styles.optionSub}>{c.homeSub}</span>
                    </span>
                    <span className={styles.optionPrice}>{c.byZone}</span>
                  </label>
                </div>

                {delivery === "pickup" && options.pickupStores.length > 1 && (
                  <div className={styles.storeChoice}>
                    {options.pickupStores.map((s) => (
                      <label key={s.code} className={styles.radioLine}>
                        <input type="radio" name="store" checked={storeCode === s.code} onChange={() => setStoreCode(s.code)} />
                        {s.name} · {s.location}
                      </label>
                    ))}
                  </div>
                )}

                {delivery === "delivery" && (
                  <>
                    <DeliveryMap onChange={setPoint} />
                    <div className={`${styles.zone} ${zone ? styles.zoneOk : styles.zoneUnknown}`}>
                      <Icon name={zone ? "check" : "pin"} size={18} />
                      <span className={styles.grow}>
                        {zone ? (
                          <RichText
                            text={t(c.zoneLine, {
                              zone: zone.name,
                              fee: zone.fee != null ? formatMZN(zone.fee, locale) : c.feeToSet,
                              eta: zone.eta,
                            })}
                          />
                        ) : (
                          c.zoneUnknown
                        )}
                      </span>
                    </div>
                    <div className={styles.two}>
                      <label className={styles.field}>
                        {c.city}
                        <select className={styles.input} value={city} onChange={(e) => setCity(e.target.value)}>
                          {c.cities.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        {c.neighbourhood}
                        <input
                          className={styles.input}
                          list="neighbourhoods"
                          placeholder={c.neighbourhoodPlaceholder}
                          value={neighbourhood}
                          onChange={(e) => setNeighbourhood(e.target.value)}
                        />
                        <datalist id="neighbourhoods">
                          {options.zones.flatMap((z) => z.neighbourhoods).map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </label>
                      <label className={`${styles.field} ${styles.full}`}>
                        {c.address}
                        <input
                          className={styles.input}
                          autoComplete="street-address"
                          placeholder={c.addressPlaceholder}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                        />
                      </label>
                    </div>
                  </>
                )}
              </fieldset>

              {/* 3. Pagamento */}
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>3.</span> {c.payment}
                </legend>
                <div role="radiogroup" aria-label={c.methodGroup} className={styles.methods}>
                  {options.methods.map((m) => {
                    const disabled = m === "cod" && delivery !== "delivery";
                    const on = method === m && !disabled;
                    return (
                      <div key={m} className={`${styles.method} ${on ? styles.methodOn : ""}`}>
                        <label className={styles.methodHead} style={{ opacity: disabled ? 0.55 : 1 }}>
                          <input
                            type="radio"
                            name="method"
                            checked={on}
                            disabled={disabled}
                            onChange={() => {
                              setMethod(m);
                              setTouched(false);
                            }}
                          />
                          <Icon name={METHOD_ICON[m]} />
                          <span className={styles.optionText}>
                            <span className={styles.methodTitle}>{c.methods[m].title}</span>
                            <span className={styles.optionSub}>{disabled ? c.codOnlyDelivery : c.methods[m].sub}</span>
                          </span>
                          <MethodLogo method={m} />
                        </label>

                        {on && m === "card" && (
                          <div className={styles.methodBody}>
                            <label className={styles.field}>
                              {c.card.number}
                              <span className={styles.cardNumber}>
                                <input
                                  className={styles.input}
                                  inputMode="numeric"
                                  autoComplete="cc-number"
                                  placeholder="0000 0000 0000 0000"
                                  value={cardDigits.slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ")}
                                  onChange={(e) => setCard({ ...card, number: e.target.value })}
                                />
                                <span className={styles.brand}>{cardBrand}</span>
                              </span>
                            </label>
                            <div className={styles.two}>
                              <label className={styles.field}>
                                {c.card.expiry}
                                <input
                                  className={styles.input}
                                  inputMode="numeric"
                                  autoComplete="cc-exp"
                                  placeholder={c.card.expiryPlaceholder}
                                  value={card.exp}
                                  onChange={(e) => {
                                    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                                    if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                                    setCard({ ...card, exp: v });
                                  }}
                                />
                              </label>
                              <label className={styles.field}>
                                <span className={styles.fieldHead}>
                                  {c.card.cvc}
                                  <span className={styles.help} title={c.card.cvcHelp} aria-label={c.card.cvcHelp}>
                                    ?
                                  </span>
                                </span>
                                <input
                                  className={styles.input}
                                  inputMode="numeric"
                                  autoComplete="cc-csc"
                                  placeholder={c.card.cvcPlaceholder}
                                  value={card.cvc}
                                  onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                                />
                              </label>
                            </div>
                            <label className={styles.field}>
                              {c.card.name}
                              <input
                                className={styles.input}
                                autoComplete="cc-name"
                                placeholder={c.card.namePlaceholder}
                                value={card.name}
                                onChange={(e) => setCard({ ...card, name: e.target.value })}
                              />
                            </label>
                            <div className={styles.note}>
                              <Icon name="lock" size={18} />
                              <span>{c.card.note}</span>
                            </div>
                          </div>
                        )}

                        {on && isMobile(m) && (
                          <div className={styles.methodBody}>
                            <div className={styles.phoneBlock}>
                              <label htmlFor="tel" className="label">
                                {t(c.phone.label, { method: c.methods[m].name })}
                              </label>
                              <div className={`${styles.phone} ${phoneError ? styles.phoneError : ""}`}>
                                <span className={styles.prefix}>+258</span>
                                <input
                                  id="tel"
                                  type="tel"
                                  inputMode="numeric"
                                  autoComplete="tel-national"
                                  placeholder="84 123 4567"
                                  value={formatPhone(phone)}
                                  onChange={(e) => setPhone(e.target.value)}
                                  onBlur={() => setTouched(true)}
                                  aria-invalid={!!phoneError}
                                  aria-describedby="tel-help"
                                />
                                {phoneValid && detected && <span className={styles.detected}>{c.phone.detected[detected]}</span>}
                              </div>
                              {phoneError ? (
                                <div id="tel-help" role="alert" className={styles.phoneErrorText}>
                                  <Icon name="alert" size={18} />
                                  <span className={styles.grow}>
                                    <strong>{c.phone.errorPrefix}</strong> {phoneError}
                                  </span>
                                  {switchTo && (
                                    <button type="button" className={styles.switch} onClick={() => setMethod(switchTo)}>
                                      {t(c.phone.switchTo, { method: c.methods[switchTo].name })}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span id="tel-help" className={styles.optionSub}>
                                  {t(c.phone.help, { method: c.methods[m].name })}
                                </span>
                              )}
                            </div>
                            <div className={styles.note}>
                              <Icon name="lock" size={18} />
                              <span>
                                <RichText text={c.pinNotice} />
                              </span>
                            </div>
                          </div>
                        )}

                        {on && m === "transfer" && (
                          <div className={styles.methodBody}>
                            <dl className={styles.bank}>
                              {[
                                [c.transfer.bank, c.transfer.bankValue, false],
                                [c.transfer.holder, c.transfer.holderValue, false],
                                [c.transfer.nib, c.transfer.nibValue, true],
                                [c.transfer.reference, c.transfer.referenceValue, false],
                                [c.transfer.amount, totalLabel, false],
                              ].map(([label, value, copyable]) => (
                                <div key={label as string} className={styles.bankRow}>
                                  <dt>{label}</dt>
                                  <dd>{value}</dd>
                                  {copyable && (
                                    <button type="button" className={styles.copy} onClick={() => copy(value as string)}>
                                      {copied === value ? c.transfer.copied : c.transfer.copy}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </dl>
                            <label className={styles.field}>
                              {c.transfer.proof}
                              <span className={styles.upload}>
                                <Icon name="upload" />
                                <span className={styles.optionText}>
                                  <span className={styles.optionTitle}>{file?.name ?? c.transfer.chooseFile}</span>
                                  <span className={styles.optionSub}>{c.transfer.fileHint}</span>
                                </span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className={styles.fileInput}
                                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                />
                              </span>
                            </label>
                            <span className={styles.optionSub}>{c.transfer.note}</span>
                          </div>
                        )}

                        {on && m === "cod" && (
                          <div className={styles.methodBody}>
                            <span className={styles.codText}>
                              <RichText text={t(c.cod.body, { total: totalLabel })} />
                            </span>
                            <label className={styles.field}>
                              {c.cod.change}
                              <span className={styles.hintBlock}>{c.cod.changeHint}</span>
                              <input
                                className={styles.input}
                                inputMode="numeric"
                                placeholder={c.cod.changePlaceholder}
                                value={changeFor}
                                onChange={(e) => setChangeFor(e.target.value)}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <p role="alert" className={styles.formError}>
                    {error}
                  </p>
                )}
                <button type="submit" className={styles.pay} disabled={!methodReady || submitting}>
                  {submitting ? c.sending : payLabel}
                </button>
                <span className={styles.terms}>
                  {c.terms.split(/(\{terms\}|\{policy\})/).map((part, i) =>
                    part === "{terms}" ? (
                      <Link key={i} href={href("/info/termos")} className="underline">
                        {c.termsLink}
                      </Link>
                    ) : part === "{policy}" ? (
                      <Link key={i} href={href("/info/trocas-devolucoes")} className="underline">
                        {c.policyLink}
                      </Link>
                    ) : (
                      part
                    ),
                  )}
                </span>
              </fieldset>
            </form>
          )}

          {phase === "processing" && (
            <div role="status" aria-live="polite" className={`${styles.stateBox} ${styles.stateNeutral}`}>
              <span className={styles.stateTag}>
                <Icon name="clock" size={18} />
                {c.processing.tag}
              </span>
              <h1 className={styles.stateTitle}>
                <RichText text={c.processing.title} />
              </h1>
              <p className={styles.stateBody}>{c.processing.body}</p>
            </div>
          )}

          {phase === "pending" && order && (
            <div role="status" aria-live="polite" className={styles.stateStack}>
              <div className={`${styles.stateBox} ${styles.stateWarning}`}>
                <span className={styles.stateTag}>
                  <Icon name="clock" size={18} className={styles.pulse} />
                  {c.pending.tag}
                </span>
                <h1 className={styles.stateTitle}>
                  <RichText text={c.pending.title} />
                </h1>
                <p className={styles.stateBody}>
                  <RichText text={t(c.pending.body, { method: methodName, phone: order.msisdnMasked ?? "", total: totalLabel })} />
                </p>
                <div className={styles.countdown}>
                  <span className={styles.countdownValue}>
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                  <span className={styles.optionSub}>{c.pending.countdown}</span>
                </div>
              </div>
              <ol className={styles.pinSteps}>
                {c.pending.steps.map((step, i) => (
                  <li key={i}>
                    <span className={styles.roman}>{["I.", "II.", "III."][i]}</span>
                    <span>{t(step, { method: methodName })}</span>
                  </li>
                ))}
              </ol>
              <div className={styles.row}>
                <button type="button" className={styles.secondary} onClick={backToForm}>
                  {c.pending.cancel}
                </button>
                <span className={styles.optionSub}>{c.pending.noSignal}</span>
              </div>
            </div>
          )}

          {phase === "success" && order && <SuccessState order={order} totalLabel={totalLabel} hasProof={!!file} />}

          {phase === "failed" && order && (
            <div role="alert" className={styles.stateStack}>
              <div className={`${styles.stateBox} ${order.paymentStatus === "expired" ? styles.stateWarning : styles.stateDanger}`}>
                <span className={styles.stateTag}>
                  <Icon name={order.paymentStatus === "expired" ? "clock" : "alert"} size={18} />
                  {order.paymentStatus === "expired" ? dict.checkout.failed.expiredTag : dict.checkout.failed.declinedTag}
                </span>
                <h1 className={styles.stateTitle}>
                  {order.paymentStatus === "expired" ? dict.checkout.failed.expiredTitle : dict.checkout.failed.declinedTitle}
                </h1>
                <p className={styles.stateBody}>
                  {order.paymentStatus === "expired"
                    ? dict.checkout.failed.expiredBody
                    : order.paymentMethod === "card"
                      ? dict.checkout.failed.declinedCard
                      : dict.checkout.failed.declinedMobile}
                </p>
              </div>
              <div className={styles.row}>
                <button type="button" className={styles.primary} onClick={() => submit()}>
                  {dict.checkout.failed.retry}
                </button>
                <button type="button" className={styles.secondaryLarge} onClick={backToForm}>
                  {dict.checkout.failed.otherMethod}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Resumo da encomenda */}
        <aside aria-label={c.summary.title} className={styles.summary}>
          <h2 className={styles.summaryTitle}>{c.summary.title}</h2>
          <ul className={styles.items}>
            {lines.map((line) => {
              const { product, variant, colorName, image } = describeLine(line, products);
              return (
                <li key={line.variantId} className={styles.item}>
                  <span className={styles.itemImage}>
                    {image && <Image src={image.url} alt={image.alt} fill sizes="72px" className={styles.cover} />}
                  </span>
                  <div className={styles.itemText}>
                    <span className={styles.itemCode}>{product?.code ?? line.slug}</span>
                    <span className={styles.optionSub}>{[colorName, variant?.size].filter(Boolean).join(" · ")}</span>
                    <span className={styles.optionSub}>{t(dict.cart.qty, { n: line.quantity })}</span>
                  </div>
                  <span className={styles.itemPrice}>{formatMZN((priceOf(line.slug) ?? 0) * line.quantity, locale)}</span>
                </li>
              );
            })}
          </ul>
          <div className={styles.discount}>
            <label htmlFor="cupao" className="visually-hidden">
              {c.summary.discountCode}
            </label>
            <input
              id="cupao"
              className={styles.discountInput}
              placeholder={c.summary.discountCode}
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            />
            <button type="button" className={styles.apply} title={c.summary.discountNote}>
              {c.summary.apply}
            </button>
          </div>
          <dl className={styles.totals}>
            <div>
              <dt>{c.summary.subtotal}</dt>
              <dd>{formatMZN(subtotal, locale)}</dd>
            </div>
            <div>
              <dt>{c.summary.delivery}</dt>
              <dd>{shipLabel}</dd>
            </div>
            <div className={styles.grand}>
              <dt className="label">{c.summary.total}</dt>
              <dd>{totalLabel}</dd>
            </div>
          </dl>
          <ul className={styles.notes}>
            <li>
              <Icon name="lock" size={16} />
              {c.summary.notes[0]}
            </li>
            <li>
              <Icon name="return" size={16} />
              {c.summary.notes[1]}
            </li>
            <li>
              <Icon name="whatsapp" size={16} />
              <span>
                {c.summary.questions}{" "}
                <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="underline">
                  WhatsApp +258 82 487 6300
                </a>
              </span>
            </li>
          </ul>
        </aside>
      </section>
    </>
  );
}

function MethodLogo({ method }: { method: PaymentMethod }) {
  if (method === "card") {
    return (
      <span className={styles.logos}>
        <span role="img" aria-label="Visa" className={styles.visa}>
          VISA
        </span>
        <span role="img" aria-label="Mastercard" className={styles.mastercard}>
          <svg width="29" height="19" viewBox="0 0 34 22" aria-hidden="true">
            <circle cx="12" cy="11" r="9" fill="#EB001B" />
            <circle cx="22" cy="11" r="9" fill="#F79E1B" fillOpacity="0.9" />
          </svg>
        </span>
      </span>
    );
  }
  if (!isMobile(method)) return <span className={styles.logos} />;
  return (
    <span className={styles.logos}>
      <span className={`${styles.opLogo} ${styles[`op-${method}`]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- EN: tiny logo. PT: logótipo pequeno. */}
        <img src={`/images/payments/${method}-logo.png`} alt="" />
      </span>
    </span>
  );
}

/** EN: "Obrigada. A sua encomenda foi registada." with the design's three variants. PT: Três variantes do design. */
function SuccessState({ order, totalLabel, hasProof }: { order: OrderStatusDTO; totalLabel: string; hasProof: boolean }) {
  const { dict, href } = useI18n();
  const s = dict.checkout.success;
  const m = order.paymentMethod;
  const methodName = dict.checkout.methods[m].name;

  const [tone, tag, body, refLabel, refValue] =
    m === "transfer"
      ? ["warning", hasProof ? s.transferTag : s.transferWaiting, hasProof ? s.transferBody : s.transferWaitingBody, s.proof, hasProof ? "✓" : "—"]
      : m === "cod"
        ? ["success", s.codTag, t(s.codBody, { total: totalLabel }), s.payment, s.cash]
        : m === "card"
          ? ["success", s.paidTag, t(s.cardBody, { total: totalLabel }), s.authorisation, "[Código de autorização]"]
          : ["success", s.paidTag, t(s.paidBody, { total: totalLabel, method: methodName }), t(s.reference, { method: methodName }), "[ID da transacção]"];

  const isPickup = order.fulfillmentType === "pickup";

  return (
    <div role="status" className={styles.stateStack}>
      <div className={`${styles.stateBox} ${tone === "warning" ? styles.stateWarning : styles.stateSuccess}`}>
        <span className={styles.stateTag}>
          <Icon name={tone === "warning" ? "clock" : "check"} size={18} />
          {tag}
        </span>
        <h1 className={styles.successTitle}>
          <RichText text={s.title} />
        </h1>
        <p className={styles.stateBody}>{body}</p>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{s.order}</dt>
          <dd className={styles.factSerif}>{order.number}</dd>
        </div>
        <div>
          <dt>{refLabel}</dt>
          <dd className={styles.factSerif}>{refValue}</dd>
        </div>
        <div>
          <dt>{isPickup ? s.pickupTitle : s.deliveryTitle}</dt>
          <dd>{isPickup ? t(s.pickupNext, { store: order.pickupStore?.code ?? "02" }) : s.deliveryNext}</dd>
        </div>
      </dl>
      <div className={styles.row}>
        <ButtonLink href={href("/")}>{s.continue}</ButtonLink>
        <ButtonLink href={href(`/order/${order.id}`)} variant="outline">
          {s.track}
        </ButtonLink>
        <ButtonLink href={whatsappLink(`${dict.checkout.success.order} ${order.number}`)} variant="outline">
          {dict.common.whatsapp}
        </ButtonLink>
      </div>
    </div>
  );
}
