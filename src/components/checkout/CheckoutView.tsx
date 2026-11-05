"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { describeLine, useCartProducts } from "@/components/cart/useCartProducts";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { whatsappLink } from "@/data/site";
import { useCustomer } from "@/components/account/CustomerProvider";
import { plural, t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiClientError, api } from "@/lib/api-client";
import { cartTotal, nowLines } from "@/lib/cart";
import { formatMZN } from "@/lib/format";
import { combineDiscounts, levelDiscount } from "@/lib/discounts";
import { MT_PER_POINT } from "@/lib/loyalty";
import { sizeParts } from "@/lib/sizes";
import { methodFromMsisdn, normalizeMsisdn, OPERATOR_NAMES } from "@/lib/payments/msisdn";
import { createOrderSchema, type CreateOrderInput } from "@/lib/validation";
import type { CheckoutOptionsDTO, MobileMethod, OrderStatusDTO, PaymentMethod, ProductDTO } from "@/types";
import type { MapAddress, MapPoint } from "./DeliveryMap";
import { DEFAULT_PRICING, deliveryFee } from "@/lib/delivery";
import styles from "./Checkout.module.css";
import confirm from "./Confirmation.module.css";

const DeliveryMap = dynamic(() => import("./DeliveryMap").then((m) => m.DeliveryMap), { ssr: false });

const MOBILE: readonly PaymentMethod[] = ["mpesa", "emola", "mkesh"];
const isMobile = (m: PaymentMethod | null): m is MobileMethod => !!m && MOBILE.includes(m);
const METHOD_ICON: Record<PaymentMethod, IconName> = {
  card: "card",
  paypal: "card",
  mpesa: "device",
  emola: "device",
  mkesh: "device",
  transfer: "bank",
  cod: "cash",
  test: "check",
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
/**
 * EN: "Reservar esta peça" (design V3-Checkout-Reserva): the same checkout with one piece, no delivery and no voucher;
 *     the customer pays the deposit and collects in the piece's store.
 * PT: "Reservar esta peça" (V3-Checkout-Reserva): o mesmo checkout com uma peça, sem entrega nem voucher; a cliente paga
 *     o sinal e levanta na loja da peça.
 */
export interface ReserveInfo {
  product: ProductDTO;
  variantId: string;
  storeCode: string;
  depositPct: number;
  days: number; // EN: this piece. PT: desta peça.
  baseDays: number;
  bridalDays: number;
  until: string; // EN: "25 de novembro de 2026". PT: "25 de novembro de 2026".
}

export function CheckoutView({ reserve }: { reserve?: ReserveInfo } = {}) {
  const { locale, dict, href } = useI18n();
  const c = dict.checkout;
  const r = c.reserve;
  const router = useRouter();
  const { clearBought: clear } = useCart();
  const cart = useCartProducts();
  const reserveSlug = reserve?.product.slug;
  const reserveVariant = reserve?.variantId;
  // EN: Only the pieces chosen for now; the rest stays in the cart. PT: Só as peças escolhidas para agora.
  const lines = useMemo(
    () => (reserveSlug && reserveVariant ? [{ slug: reserveSlug, variantId: reserveVariant, quantity: 1 }] : nowLines(cart.lines)),
    [cart.lines, reserveSlug, reserveVariant],
  );
  const products = useMemo(() => (reserve ? { [reserve.product.slug]: reserve.product } : cart.products), [reserve, cart.products]);
  const loading = reserve ? false : cart.loading;

  const [options, setOptions] = useState<CheckoutOptionsDTO | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [order, setOrder] = useState<OrderStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Form state / Estado do formulário ──
  const { customer } = useCustomer();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // EN: WhatsApp for the receipt and the "pronta a levantar" notice (design V3). PT: WhatsApp para o recibo e os avisos.
  const [wa, setWa] = useState("");
  const [waReceipt, setWaReceipt] = useState(true);
  const [waTouched, setWaTouched] = useState(false);
  const [terms, setTerms] = useState(false);
  // EN: Signed in: details already filled in (design V3). PT: Com sessão, dados já preenchidos.
  useEffect(() => {
    if (!customer) return;
    setName((n) => n || customer.name);
    setEmail((e) => e || customer.email || "");
    setWa((w) => w || customer.phone || "");
  }, [customer]);
  // EN: Collection in store by default; home delivery only with the delivery module on. PT: Levantamento por defeito.
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [storeCode, setStoreCode] = useState("02");
  const [city, setCity] = useState(c.cities[0]);
  const [neighbourhood, setNeighbourhood] = useState("");
  const [address, setAddress] = useState("");

  /**
   * EN: Fills city, neighbourhood and address from the map pin. The neighbourhood is matched to our delivery-zone list
   *     ("Polana Cimento A" → "Polana Cimento") so the zone and fee appear at once. The customer can still edit everything.
   * PT: Preenche cidade, bairro e morada a partir do pino. O bairro é ligado à lista das zonas de entrega para a zona e o
   *     preço aparecerem logo. A cliente pode sempre corrigir.
   */
  function fillFromMap(found: MapAddress) {
    const known = (options?.zones ?? []).flatMap((z) => z.neighbourhoods);
    const name = found.neighbourhood.toLowerCase();
    const match = known.find((n) => name === n.toLowerCase() || name.startsWith(n.toLowerCase()) || n.toLowerCase().startsWith(name));
    if (found.neighbourhood) setNeighbourhood(match ?? found.neighbourhood);
    if (found.street) setAddress(found.street);
    const cityMatch = c.cities.slice(0, -1).find((x) => found.city.toLowerCase().includes(x.toLowerCase()));
    if (found.city) setCity(cityMatch ?? c.cities[c.cities.length - 1]);
  }
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });
  const [file, setFile] = useState<File | null>(null);
  const [changeFor, setChangeFor] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  // EN: Voucher checked by "Aplicar" (the order checks it again). PT: Voucher verificado em "Aplicar" (a encomenda verifica de novo).
  const [voucher, setVoucher] = useState<{ code: string; amount: number; stacks: boolean } | null>(null);
  const [voucherMsg, setVoucherMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    api.checkoutOptions(locale).then(setOptions).catch(() => setOptions({ methods: [], pickupStores: [], zones: [], pricing: DEFAULT_PRICING, delivery: false, level: null, levelDisplay: "plain", vouchers: false, myVouchers: [], loyalty: { on: true, mtPerPoint: MT_PER_POINT, stack: false, onReservations: true } }));
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
  // EN: Same rule as the server (src/lib/delivery.ts). PT: A mesma regra do servidor.
  const pricing = options?.pricing ?? DEFAULT_PRICING;
  const feeValue = delivery === "pickup" ? 0 : deliveryFee(pricing, zone?.fee, point);
  const fee = feeValue ?? 0;
  const level = options?.level ?? null;
  // EN: Same rule as the server: the larger of sale/campaign and level. PT: A mesma regra do servidor.
  const rules = options?.loyalty;
  // EN: Same rules as the server (Definições · Programa de fidelidade). PT: As mesmas regras do servidor.
  const levelAmount =
    level && (!reserve || rules?.onReservations !== false)
      ? levelDiscount(
          lines
            .filter((l) => products[l.slug] && (rules?.onReservations !== false || !products[l.slug].bridal))
            .map((l) => ({ price: products[l.slug].price, unit: priceOf(l.slug) ?? 0, quantity: l.quantity })),
          level.pct,
          !!rules?.stack,
        )
      : 0;
  const mtPerPoint = rules ? (rules.on ? rules.mtPerPoint : 0) : MT_PER_POINT;
  const discounts = combineDiscounts(levelAmount, voucher);
  const total = subtotal - Math.min(subtotal, discounts.total) + fee;
  const pieces = lines.reduce((n, l) => n + l.quantity, 0);
  // EN: Reservation: customer discount on a piece not on sale, then the deposit. PT: Reserva: desconto de cliente, depois o sinal.
  const reserveDiscount = reserve && level ? levelAmount : 0;
  const reserveFinal = subtotal - reserveDiscount;
  const deposit = reserve ? Math.round((reserveFinal * reserve.depositPct) / 100) : 0;
  const totalLabel = formatMZN(order?.total ?? (reserve ? deposit : total), locale);
  const known = delivery === "pickup" || pricing.mode !== "zone" || !!zone;
  async function applyVoucher(code: string) {
    const clean = code.trim().toUpperCase();
    if (clean.length < 2) return;
    setChecking(true);
    try {
      const r = await api.checkVoucher(clean, subtotal);
      if (r.ok) {
        setVoucher({ code: r.code, amount: r.amount, stacks: r.stacks });
        const wins = combineDiscounts(levelAmount, { amount: r.amount, stacks: r.stacks }).voucher > 0;
        setVoucherMsg({ ok: true, text: wins ? t(c.summary.voucherApplied, { code: r.code }) : c.summary.voucherLevelWins });
      } else {
        setVoucher(null);
        setVoucherMsg({ ok: false, text: t(c.summary.voucherErrors[r.error], { min: formatMZN(r.min ?? 0, locale) }) });
      }
    } catch {
      setVoucherMsg({ ok: false, text: dict.errors.VALIDATION_ERROR });
    } finally {
      setChecking(false);
    }
  }
  function removeVoucher() {
    setVoucher(null);
    setVoucherMsg(null);
    setDiscountCode("");
  }
  // EN: The cart changed: check the voucher again (minimum purchase, percentage). PT: O carrinho mudou: verificar de novo.
  const appliedCode = voucher?.code;
  useEffect(() => {
    if (appliedCode) void applyVoucher(appliedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, appliedCode]);

  const shipLabel = delivery === "pickup" ? c.free : !known ? c.byZone : feeValue != null ? formatMZN(feeValue, locale) : c.feeToSet;

  const waValid = !!normalizeMsisdn(wa.replace(/\D/g, ""));
  const waError = waTouched && !waValid ? c.whatsappInvalid : "";

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
    method === "card"
      ? cardOk
      : isMobile(method)
        ? phoneValid && detected === method
        : method === "transfer"
          ? !!file
          : method === "cod" || method === "paypal" || method === "test";
  const payLabel = !method
    ? c.chooseMethod
    : reserve && method !== "transfer"
      ? t(r.pay, { total: totalLabel })
      : method === "card"
      ? t(c.payCard, { total: totalLabel })
      : method === "transfer"
        ? c.sendProof
        : method === "cod" || method === "test"
          ? c.confirmOrder
          : t(c.payWith, { total: totalLabel, method: c.methods[method].name });

  // EN: Paid (or proof sent): a reservation opens its confirmation, a purchase shows the success state.
  // PT: Pago (ou comprovativo enviado): a reserva abre a sua confirmação, a compra mostra o estado de sucesso.
  const finish = useRef<(o: OrderStatusDTO) => void>(() => undefined);
  finish.current = (o: OrderStatusDTO) => {
    if (o.reservationToken) {
      router.replace(href(`/reserva/${o.reservationToken}`));
      return;
    }
    clear();
    setPhase("success");
  };

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
            finish.current(next);
          } else if (next.paymentStatus !== "pending") {
            stopPolling();
            setPhase("failed");
          }
        } catch {
          // EN: temporary network error: try again next tick. PT: erro de rede temporário.
        }
      }, 3000);
    },
    [],
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
      method === "card" || method === "paypal" || method === "test"
        ? { method }
        : isMobile(method)
          ? { method, msisdn: digits }
          : method === "transfer"
            ? { method }
            : { method, changeFor: changeFor || undefined };
    const input = {
      locale,
      lines,
      contact: { name, email, phone: wa.replace(/\D/g, ""), whatsapp: waReceipt },
      fulfillment:
        reserve
          ? { type: "pickup" as const, storeCode: reserve.storeCode }
          : delivery === "pickup"
          ? { type: "pickup" as const, storeCode }
          : { type: "delivery" as const, city, neighbourhood, address, lat: point?.lat, lng: point?.lng },
      payment,
      discountCode: reserve ? undefined : voucher?.code,
      reserve: reserve ? true : undefined,
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
    setWaTouched(true);
    setError(null);
    if (!waValid) {
      setError(c.whatsappInvalid);
      return;
    }
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
        finish.current(created);
      } else if (created.paymentStatus === "pending") {
        setPhase(method === "card" || method === "paypal" ? "processing" : "pending");
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

  // EN: "Confirmação" of design V3 takes the whole page. PT: A confirmação do V3 ocupa a página toda.
  if (phase === "success" && order) return <SuccessState order={order} totalLabel={totalLabel} hasProof={!!file} />;

  const stepIndex = 3;
  const methodName = order ? c.methods[order.paymentMethod].name : method ? c.methods[method].name : "";

  return (
    <>
      {!reserve && (
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
      )}

      <section className={`page-x ${styles.layout}`}>
        <div>
          {phase === "form" && (
            <form onSubmit={submit} className={styles.form} noValidate>
              {reserve ? (
                <>
                  <div className={styles.reserveHead}>
                    <span className="eyebrow">{r.eyebrow}</span>
                    <h1 className={styles.title}>
                      <RichText text={r.title} />
                    </h1>
                  </div>
                  <ReservePiece reserve={reserve} />
                  <div className={styles.reserveRules}>
                    <span className="label">{r.rulesTitle}</span>
                    <ul>
                      {r.rules.map((rule, i) => (
                        <li key={i}>
                          <Icon name={RULE_ICONS[i]} size={18} />
                          <span>
                            <RichText text={t(rule, { days: reserve.baseDays, bridal: reserve.bridalDays, pct: reserve.depositPct, rest: 100 - reserve.depositPct })} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <h1 className={styles.title}>
                  <RichText text={c.title} />
                </h1>
              )}

              {/* 1. Contacto */}
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>{reserve ? "2." : "1."}</span> {c.contact}
                </legend>
                {customer && (
                  <p className={styles.signedIn}>
                    <Icon name="user" size={18} />
                    <span>
                      <RichText text={t(c.signedIn, { name: customer.name, level: level?.name ?? "" })} />
                    </span>
                  </p>
                )}
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
                <label className={styles.field}>
                  {c.whatsapp}
                  <div className={`${styles.phone} ${waError ? styles.phoneError : ""}`}>
                    <span className={styles.prefix}>+258</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="84 123 4567"
                      value={formatPhone(wa)}
                      onChange={(e) => setWa(e.target.value)}
                      onBlur={() => setWaTouched(true)}
                      aria-invalid={!!waError}
                      required
                    />
                  </div>
                  {waError && (
                    <span role="alert" className={styles.phoneErrorText}>
                      {waError}
                    </span>
                  )}
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={waReceipt} onChange={(e) => setWaReceipt(e.target.checked)} />
                  <span>{c.whatsappReceipt}</span>
                </label>
              </fieldset>

              {/* 2. Entrega */}
              {!reserve && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>2.</span> {options.delivery ? c.delivery : c.pickupOnly}
                </legend>
                <div className={options.delivery ? styles.two : undefined}>
                  <label className={`${styles.option} ${delivery === "pickup" ? styles.optionOn : ""}`}>
                    <input type="radio" name="delivery" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} />
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{c.pickupTitle}</span>
                      <span className={styles.optionSub}>{t(c.pickupSub, { store: storeCode })}</span>
                    </span>
                    <span className={styles.optionPrice}>{c.free}</span>
                  </label>
                  {options.delivery && (
                    <label className={`${styles.option} ${delivery === "delivery" ? styles.optionOn : ""}`}>
                      <input type="radio" name="delivery" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} />
                      <span className={styles.optionText}>
                        <span className={styles.optionTitle}>{c.homeTitle}</span>
                        <span className={styles.optionSub}>{c.homeSub}</span>
                      </span>
                      <span className={styles.optionPrice}>{c.byZone}</span>
                    </label>
                  )}
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
                    <DeliveryMap onChange={setPoint} onAddress={fillFromMap} />
                    <div className={`${styles.zone} ${zone ? styles.zoneOk : styles.zoneUnknown}`}>
                      <Icon name={zone ? "check" : "pin"} size={18} />
                      <span className={styles.grow}>
                        {zone ? (
                          <RichText
                            text={t(c.zoneLine, {
                              zone: zone.name,
                              fee: feeValue != null ? formatMZN(feeValue, locale) : c.feeToSet,
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
              )}

              {/* 3. Pagamento */}
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  <span className={styles.num}>3.</span> {reserve ? r.payTitle : c.payment}
                </legend>
                <div role="radiogroup" aria-label={c.methodGroup} className={styles.methods}>
                  {options.methods.filter((m) => !reserve || m !== "cod").map((m) => {
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
                <label className={styles.acceptBox}>
                  <input type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
                  <span>
                    <RichText text={reserve ? r.terms : t(c.acceptTerms, { finalSale: dict.product.finalSale })} />
                  </span>
                </label>
                <button type="submit" className={styles.pay} disabled={!methodReady || !terms || !waValid || submitting}>
                  {submitting ? c.sending : payLabel}
                </button>
                {!terms && <span className={styles.terms}>{c.acceptFirst}</span>}
                <Link href={`${href("/como-comprar")}${reserve ? "#reservar" : "#trocas"}`} className={`${styles.terms} underline`}>
                  {c.readTerms}
                </Link>
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
              {/* EN: Design V3-Estado: the PIN warning and help. PT: Aviso do PIN e ajuda (V3). */}
              <p className={styles.optionSub}>
                <Icon name="lock" size={14} /> {c.pending.neverPin}
              </p>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={styles.optionSub} style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>
                {c.pending.help}
              </a>
            </div>
          )}


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
          <h2 className={styles.summaryTitle}>{reserve ? r.summaryTitle : c.summary.title}</h2>
          <ul className={styles.items}>
            {lines.map((line) => {
              const { product, variant, colorName, image } = describeLine(line, products);
              return (
                <li key={line.variantId} className={styles.item}>
                  <span className={styles.itemImage}>
                    {image && <Image src={image.url} alt={image.alt} fill sizes="72px" className={styles.cover} />}
                  </span>
                  <div className={styles.itemText}>
                    <span className={styles.itemCode}>{[product?.code ?? line.slug.toUpperCase(), product?.type?.name].filter(Boolean).join(" · ")}</span>
                    <span className={styles.optionSub}>
                      {[colorName, variant && [sizeParts(variant.size).detail, sizeParts(variant.size).letter].filter(Boolean).join(" · "), line.quantity > 1 && t(dict.cart.qty, { n: line.quantity })]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className={styles.itemPrice}>{formatMZN((priceOf(line.slug) ?? 0) * line.quantity, locale)}</span>
                </li>
              );
            })}
          </ul>
          {reserve ? (
            <>
              <dl className={styles.totals}>
                <div>
                  <dt>{r.piecePrice}</dt>
                  <dd>{formatMZN(subtotal, locale)}</dd>
                </div>
                {reserveDiscount > 0 && level && (
                  <div className={styles.saving}>
                    <dt>
                      <Icon name="gem" size={16} />
                      {options?.levelDisplay === "named" ? t(c.summary.levelDiscountNamed, { level: level.name, pct: level.pct }) : t(c.summary.levelDiscount, { pct: level.pct })}
                    </dt>
                    <dd>−{formatMZN(reserveDiscount, locale)}</dd>
                  </div>
                )}
                <div>
                  <dt>{r.finalPrice}</dt>
                  <dd>{formatMZN(reserveFinal, locale)}</dd>
                </div>
                <div>
                  <dt>{t(r.depositLine, { pct: reserve.depositPct })}</dt>
                  <dd>{formatMZN(deposit, locale)}</dd>
                </div>
                <div>
                  <dt>{r.restLine}</dt>
                  <dd>{formatMZN(reserveFinal - deposit, locale)}</dd>
                </div>
                <div className={styles.grand}>
                  <dt className="label">{c.summary.total}</dt>
                  <dd>{totalLabel}</dd>
                </div>
              </dl>
              <span className={styles.voucherNote}>{t(r.payNowNote, { pct: 100 - reserve.depositPct, date: reserve.until })}</span>
            </>
          ) : (
          <>
          {options?.vouchers !== false && (
            <div className={styles.voucherBox}>
              <label htmlFor="cupao" className={styles.voucherLabel}>
                {c.summary.voucher}
              </label>
              {voucher ? (
                <div role="status" className={styles.voucherApplied}>
                  <span>{voucherMsg?.text ?? t(c.summary.voucherApplied, { code: voucher.code })}</span>
                  {discounts.voucher > 0 && <span className={styles.num}>−{formatMZN(discounts.voucher, locale)}</span>}
                  <button type="button" className={styles.voucherRemove} onClick={removeVoucher} aria-label={c.summary.removeVoucher}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.discount}>
                    <input
                      id="cupao"
                      className={styles.discountInput}
                      placeholder={c.summary.discountCode}
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyVoucher(discountCode);
                        }
                      }}
                    />
                    <button type="button" className={styles.apply} onClick={() => void applyVoucher(discountCode)} disabled={checking || discountCode.trim().length < 2}>
                      {c.summary.apply}
                    </button>
                  </div>
                  {voucherMsg && !voucherMsg.ok && (
                    <span role="alert" className={styles.voucherError}>
                      {voucherMsg.text}
                    </span>
                  )}
                  {(options?.myVouchers.length ?? 0) > 0 && (
                    <span className={styles.voucherNote}>
                      {c.summary.inAccount}{" "}
                      {options!.myVouchers.map((v, i) => (
                        <Fragment key={v.code}>
                          {i > 0 && " · "}
                          <button
                            type="button"
                            className={styles.voucherUse}
                            onClick={() => {
                              setDiscountCode(v.code);
                              void applyVoucher(v.code);
                            }}
                          >
                            {v.code} · {v.kind === "percent" ? `${v.value}%` : formatMZN(v.value, locale)}
                          </button>
                        </Fragment>
                      ))}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          <dl className={styles.totals}>
            <div>
              <dt>{plural(c.summary.subtotalCount, pieces)}</dt>
              <dd>{formatMZN(subtotal, locale)}</dd>
            </div>
            {discounts.level > 0 && level && (
              <div className={styles.saving}>
                <dt>
                  <Icon name="gem" size={16} />
                  {options?.levelDisplay === "named" ? t(c.summary.levelDiscountNamed, { level: level.name, pct: level.pct }) : t(c.summary.levelDiscount, { pct: level.pct })}
                </dt>
                <dd>−{formatMZN(discounts.level, locale)}</dd>
              </div>
            )}
            {discounts.voucher > 0 && voucher && (
              <div className={styles.saving}>
                <dt>
                  <Icon name="ticket" size={16} />
                  {t(c.summary.voucherLine, { code: voucher.code })}
                </dt>
                <dd>−{formatMZN(discounts.voucher, locale)}</dd>
              </div>
            )}
            <div>
              <dt>{delivery === "pickup" ? c.summary.pickup : c.summary.delivery}</dt>
              <dd>{shipLabel}</dd>
            </div>
            <div className={styles.grand}>
              <dt className="label">{c.summary.total}</dt>
              <dd>{totalLabel}</dd>
            </div>
          </dl>
          {mtPerPoint > 0 && total >= mtPerPoint && (
            <span className={styles.points}>
              <Icon name="sparkle" size={16} />
              {plural(c.summary.points, Math.floor((order?.total ?? total) / mtPerPoint))}
            </span>
          )}
          </>
          )}
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

const RULE_ICONS: IconName[] = ["card", "calendar", "store", "alert", "return", "sparkle"];

/** EN: The reserved piece, with the date it is kept until. PT: A peça reservada, com a data até quando fica guardada. */
function ReservePiece({ reserve }: { reserve: ReserveInfo }) {
  const { dict } = useI18n();
  const r = dict.checkout.reserve;
  const p = reserve.product;
  const variant = p.variants.find((v) => v.id === reserve.variantId);
  const image = p.images.find((i) => i.color === variant?.color) ?? p.images[0];
  const color = p.colors.find((x) => x.key === variant?.color)?.name;
  const size = variant ? [sizeParts(variant.size).detail, sizeParts(variant.size).letter].filter(Boolean).join(" · ") : "";
  return (
    <div className={styles.reservePiece}>
      {image && <Image src={image.url} alt={image.alt} width={140} height={186} className={styles.reserveImg} />}
      <div className={styles.reserveInfo}>
        <span className="eyebrow">{[p.collection?.name, p.type?.name].filter(Boolean).join(" · ")}</span>
        <span className={styles.reserveCode}>{p.code}</span>
        <span className={styles.optionSub}>{[color, size].filter(Boolean).join(" · ")}</span>
        <span className={styles.reserveUntil}>
          <Icon name="hourglass" size={16} />
          <RichText text={t(r.keptUntil, { date: reserve.until, days: reserve.days })} />
        </span>
      </div>
    </div>
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
  const { dict, locale, href } = useI18n();
  const k = dict.checkout.confirmation;
  const { customer } = useCustomer();
  const m = order.paymentMethod;
  const transfer = m === "transfer";
  const date = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" }).format(new Date(order.createdAt));
  const store = Number(order.pickupStore?.code ?? "2");
  const rows: [IconName, string][] = [];
  if (transfer) rows.push(["clock", hasProof ? k.transferProof : k.transferMissing]);
  // EN: Only the channels the customer gave (design V3: "… por WhatsApp para +258 84 ••• 4567"). PT: Só os canais dados.
  if (order.receiptTo.whatsapp) rows.push(["whatsapp", t(k.receiptPhone, { phone: order.receiptTo.whatsapp })]);
  else if (order.receiptTo.email) rows.push(["mail", k.receiptEmail]);
  if (order.fulfillmentType === "pickup") rows.push(["store", t(k.pickup, { store, code: order.deliveryCode ?? "—" })]);
  else rows.push(["truck", t(k.delivery, { code: order.deliveryCode ?? "—" })]);
  if (m === "cod") rows.push(["cash", t(k.cod, { total: totalLabel })]);
  if (order.points && order.points.earned > 0) rows.push(["sparkle", t(k.points, { earned: order.points.earned, year: order.points.year, level: order.points.level })]);
  rows.push(["return", dict.product.finalSale]);
  const tone = transfer ? "warn" : undefined;

  return (
    <div className={`page-x`}>
      <div role="status" className={confirm.wrap}>
        <span className={confirm.state} data-tone={tone}>
          <Icon name={tone ? "clock" : "check"} size={16} />
          {transfer ? (hasProof ? k.validating : k.proofMissing) : k.confirmed}
        </span>
        <h1 className={confirm.title}>
          {t(k.title, { name: order.firstName })}
          <br />
          <em>{transfer ? k.subRegistered : k.sub}</em>
        </h1>
        <span className={confirm.meta}>
          <RichText text={t(dict.reservation.number, { number: order.number, date })} />
        </span>
        <ul className={confirm.list}>
          {rows.map(([icon, text]) => (
            <li key={text}>
              <span className={confirm.circle}>
                <Icon name={icon} size={18} />
              </span>
              <span>
                <RichText text={text} />
              </span>
            </li>
          ))}
        </ul>
        <div className={confirm.actions}>
          {customer ? (
            <Link href={`${href("/account")}#encomendas`} className={confirm.btnPrimary}>
              {k.seeOrders}
            </Link>
          ) : (
            <Link href={href(`/order/${order.id}`)} className={confirm.btnPrimary}>
              {k.track}
            </Link>
          )}
          <Link href={href("/")} className={confirm.btn}>
            {k.continue}
          </Link>
        </div>
      </div>
    </div>
  );
}
