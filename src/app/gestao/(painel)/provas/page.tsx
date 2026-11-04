import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { BridalSettingsEditor, BridalToggle } from "@/components/admin/BridalSettings";
import { FittingsBoard, type BoardFitting } from "@/components/admin/FittingsBoard";
import { DemoTag, mzn, PageTop } from "@/components/admin/ui";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { addDays, formatLongDate, fromMaputo, monthName, shortWeekday, toMaputo, todayMaputo } from "@/lib/time";
import { BRIDAL_FITTING_KINDS, type FittingKind } from "@/types";
import { getDb } from "@/server/db";
import { fittings, productImages, products, stores } from "@/server/db/schema";
import { METHOD_LABEL } from "@/server/admin/orders";
import { bridalSettings, customerWhatsapp, listFittingsBetween, reminderMessage } from "@/server/fittings";
import { accessOf, requireStaffPage, storeScope } from "@/server/staff/access";

export const metadata = { title: "Provas · Bridal" };

type Props = { searchParams: Promise<{ inicio?: string; sel?: string }> };

/** EN: Bridal days as 1 = Monday … 7 = Sunday. PT: Dias da Bridal, 1 = segunda … 7 = domingo. */
const isoWeekday = (date: string) => toMaputo(fromMaputo(date, "12:00")).weekday || 7;

/**
 * EN: "Gestão · Provas de noiva" of design V3 (Eterna Bridal, Loja 22): "Provas ligadas", the next fitting days by start
 *     time, requests from the site (Confirmar · Propor outra hora · WhatsApp), the selected fitting, packages and rules.
 * PT: Provas de noiva do V3 (Eterna Bridal, Loja 22): "Provas ligadas", os próximos dias de prova por hora, os pedidos
 *     pelo site, a prova seleccionada, pacotes e regras.
 */
export default async function FittingsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("fittings");
  const p = await searchParams;
  const today = todayMaputo();
  const settings = await bridalSettings();
  const db = await getDb();
  const scope = storeScope(staff, "fittings");
  const [store] = (await db.select().from(stores).where(eq(stores.code, "22")).orderBy(asc(stores.position))).filter((st) => !scope || scope.includes(st.id));

  // EN: The next six fitting days from "inicio" (and the six before, for "anterior"). PT: Os seis dias de prova seguintes.
  const start = p.inicio && /^\d{4}-\d{2}-\d{2}$/.test(p.inicio) ? p.inicio : today;
  const pick = (from: string, step: 1 | -1) => {
    const out: string[] = [];
    for (let d = from, i = 0; out.length < 6 && i < 60; d = addDays(d, step), i++) if (settings.days.includes(isoWeekday(d))) out.push(d);
    return step === 1 ? out : out.reverse();
  };
  const dates = pick(start, 1);
  const prevStart = pick(addDays(start, -1), -1)[0] ?? addDays(start, -14);
  const nextStart = addDays(dates[dates.length - 1] ?? start, 1);

  const range = dates.length
    ? `${Number(dates[0].slice(8))} de ${monthName(Number(dates[0].slice(5, 7)), "pt")} a ${Number(dates[dates.length - 1].slice(8))} de ${monthName(Number(dates[dates.length - 1].slice(5, 7)), "pt")}`
    : "";
  const ids = store ? [store.id] : [];
  const inRange = dates.length ? (await listFittingsBetween(dates[0], addDays(dates[dates.length - 1], 1), ids)).filter((f) => f.status !== "cancelled") : [];
  const requests = ids.length
    ? await db
        .select()
        .from(fittings)
        .where(and(eq(fittings.status, "requested"), gte(fittings.startsAt, new Date(Date.now() - 86_400_000)), inArray(fittings.storeId, ids)))
        .orderBy(asc(fittings.startsAt))
    : [];

  const all = [...new Map([...inRange, ...requests].map((f) => [f.id, f])).values()];
  const productIds = [...new Set(all.flatMap((f) => f.productIds))];
  const images = productIds.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url, position: productImages.position, code: products.code })
        .from(productImages)
        .innerJoin(products, eq(productImages.productId, products.id))
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position))
    : [];

  const toBoard = (f: (typeof all)[number]): BoardFitting => {
    const w = toMaputo(f.startsAt);
    const pkg = settings.packages.find((x) => x.key === f.packageKey);
    const dresses = pkg ? `${pkg.dresses}${f.extraDresses ? ` + ${f.extraDresses} extra` : " vestidos"}` : "";
    return {
      id: f.id,
      code: f.code,
      date: w.date,
      time: w.time,
      dayLabel: formatLongDate(w.date, "pt"),
      dayShort: `${shortWeekday(w.date, "pt")} ${Number(w.date.slice(8))}`,
      client: f.clientName,
      phone: `+258 ${formatMsisdn(f.phone)}`,
      kind: FITTING_KIND_LABELS[f.kind as FittingKind].pt,
      packageLine: pkg ? `${pkg.name} · ${dresses}` : FITTING_KIND_LABELS[f.kind as FittingKind].pt,
      paidLine:
        f.paymentStatus === "paid" ? `pagou ${mzn(f.amount)}${f.paymentMethod ? ` por ${METHOD_LABEL[f.paymentMethod as keyof typeof METHOD_LABEL] ?? f.paymentMethod}` : ""}` : "",
      paid: f.paymentStatus === "paid",
      storeCode: store?.code ?? "22",
      storeName: store?.name ?? "",
      status: f.status,
      source: f.source,
      notes: f.notes,
      internalNotes: f.internalNotes ?? "",
      duration: f.durationMinutes,
      pieces: f.productIds.map((pid) => images.find((i) => i.productId === pid)).filter((i): i is NonNullable<typeof i> => !!i).map((i) => ({ url: i.url, code: i.code })),
      reminderUrl: store ? customerWhatsapp(f.phone, reminderMessage(f, store)) : "",
      publicUrl: `/pt/fitting/${f.publicToken}`,
      isDemo: f.isDemo,
    };
  };

  const active = settings.packages.filter((x) => x.status !== "off");
  const summary = [
    "Só vestidos de noiva (Eterna Bridal, Loja 22)",
    `pacotes ${active.filter((x) => x.status === "active").map((x) => x.name).join(" e ")}`,
    ...active.filter((x) => x.status === "soon").map((x) => `${x.name} brevemente`),
  ].join(" · ");
  const canEditRules = accessOf(staff, "fittings") === "T";

  return (
    <>
      <PageTop
        eyebrow="Eterna Bridal · Loja 22"
        title={
          <>
            Provas de <em>noiva</em>
          </>
        }
      />
      <DemoTag show={all.some((f) => f.isDemo)} />
      <BridalToggle settings={settings} summary={summary} canEdit={canEditRules} />
      <FittingsBoard
        range={range}
        dates={dates.map((d) => ({ date: d, label: `${shortWeekday(d, "pt")} ${Number(d.slice(8))}`, isToday: d === today }))}
        hours={settings.hours}
        fittings={inRange.map(toBoard)}
        requests={requests.map(toBoard)}
        selectedId={p.sel ?? null}
        prev={`?inicio=${prevStart}`}
        next={`?inicio=${nextStart}`}
        today={today}
        kinds={BRIDAL_FITTING_KINDS.map((k) => ({ key: k, label: FITTING_KIND_LABELS[k].pt }))}
        packages={active.filter((x) => x.status === "active").map((x) => ({ key: x.key, name: x.name, dresses: x.dresses }))}
        extraMax={settings.extraMax}
      />
      <BridalSettingsEditor settings={settings} canEdit={canEditRules} />
    </>
  );
}
