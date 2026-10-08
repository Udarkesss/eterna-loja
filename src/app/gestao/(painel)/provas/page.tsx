import { and, asc, eq, gte, inArray } from "drizzle-orm";
import s from "@/components/admin/admin.module.css";
import { FittingsBoard, type BoardFitting } from "@/components/admin/FittingsBoard";
import { DemoTag, PageTop } from "@/components/admin/ui";
import { FITTING_KIND_LABELS } from "@/data/fittings";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { addDays, formatLongDate, mondayOf, shortWeekday, toMaputo, todayMaputo } from "@/lib/time";
import type { FittingKind } from "@/types";
import { getDb } from "@/server/db";
import { fittings, productImages, products, stores } from "@/server/db/schema";
import { customerWhatsapp, listFittingsBetween, reminderMessage } from "@/server/fittings";
import { requireStaffPage, storeScope } from "@/server/staff/access";

export const metadata = { title: "Provas" };

type Props = { searchParams: Promise<{ semana?: string; loja?: string; sel?: string }> };

/** EN: "Gestão · 5 Provas": week calendar, the selected fitting, and requests from the site. PT: Calendário e pedidos. */
export default async function FittingsPage({ searchParams }: Props) {
  const staff = await requireStaffPage("fittings");
  const p = await searchParams;
  const today = todayMaputo();
  const monday = mondayOf(p.semana && /^\d{4}-\d{2}-\d{2}$/.test(p.semana) ? p.semana : today);
  const scope = storeScope(staff, "fittings");
  const db = await getDb();
  const storeRows = (await db.select().from(stores).orderBy(asc(stores.position))).filter((st) => !scope || scope.includes(st.id));
  const storeFilter = storeRows.find((st) => st.code === p.loja);
  const ids = storeFilter ? [storeFilter.id] : storeRows.map((st) => st.id);

  const week = (await listFittingsBetween(monday, addDays(monday, 7), ids)).filter((f) => f.status !== "cancelled");
  const requests = await db
    .select()
    .from(fittings)
    .where(and(eq(fittings.status, "requested"), gte(fittings.startsAt, new Date(Date.now() - 86_400_000)), inArray(fittings.storeId, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])))
    .orderBy(asc(fittings.startsAt));

  const all = [...new Map([...week, ...requests].map((f) => [f.id, f])).values()];
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
    const store = storeRows.find((st) => st.id === f.storeId)!;
    const w = toMaputo(f.startsAt);
    return {
      id: f.id,
      code: f.code,
      date: w.date,
      time: w.time,
      dayLabel: formatLongDate(w.date, "pt"),
      client: f.clientName,
      phone: `+258 ${formatMsisdn(f.phone)}`,
      kind: FITTING_KIND_LABELS[f.kind as FittingKind].pt,
      storeCode: store.code,
      storeName: store.name,
      status: f.status,
      source: f.source,
      notes: f.notes,
      internalNotes: f.internalNotes ?? "",
      duration: f.durationMinutes,
      pieces: f.productIds.map((pid) => images.find((i) => i.productId === pid)).filter((i): i is NonNullable<typeof i> => !!i).map((i) => ({ url: i.url, code: i.code })),
      reminderUrl: customerWhatsapp(f.phone, reminderMessage(f, store)),
      publicUrl: `/pt/fitting/${f.publicToken}`,
      isDemo: f.isDemo,
    };
  };

  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i)).map((date) => ({
    date,
    label: `${shortWeekday(date, "pt")} ${Number(date.slice(8))}`,
    isToday: date === today,
    items: week.filter((f) => toMaputo(f.startsAt).date === date).map(toBoard),
  }));
  const todays = week.filter((f) => toMaputo(f.startsAt).date === today);
  const perStore = storeRows.map((st) => ({ code: st.code, n: todays.filter((f) => f.storeId === st.id).length })).filter((x) => x.n);
  const [, , sd] = monday.split("-");
  const endDate = addDays(monday, 5);
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const range = `Semana de ${Number(sd)} de ${monthNames[Number(monday.slice(5, 7)) - 1]} a ${Number(endDate.slice(8))} de ${monthNames[Number(endDate.slice(5, 7)) - 1]}`;

  return (
    <>
      <PageTop eyebrow={range} title="Provas" />
      <DemoTag show={all.some((f) => f.isDemo)} />
      <div className={s.stats}>
        <div className={s.stat}>
          <span className={s.statLabel}>Hoje</span>
          <span className={s.statValue}>{todays.length}</span>
          <span className={s.statSub}>{perStore.map((x) => `${x.n} na Loja ${x.code}`).join(" · ") || "Sem provas hoje"}</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Esta semana</span>
          <span className={s.statValue}>{week.length}</span>
          <span className={s.statSub}>Provas marcadas</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Por confirmar</span>
          <span className={s.statValue} style={{ color: "var(--warning)" }}>
            {week.filter((f) => f.status === "pending").length}
          </span>
          <span className={s.statSub}>Enviar lembrete</span>
        </div>
        <div className={s.stat}>
          <span className={s.statLabel}>Pedidos pelo site</span>
          <span className={s.statValue}>{requests.length}</span>
          <span className={s.statSub}>A aguardar resposta</span>
        </div>
      </div>
      <FittingsBoard
        days={days}
        requests={requests.map(toBoard)}
        selectedId={p.sel ?? null}
        stores={storeRows.map((st) => ({ code: st.code, name: st.name }))}
        storeFilter={storeFilter?.code ?? "all"}
        week={{ monday, prev: addDays(monday, -7), next: addDays(monday, 7), isCurrent: monday === mondayOf(today) }}
        today={today}
      />
    </>
  );
}
