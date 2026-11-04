import { notFound } from "next/navigation";
import { CampaignEditor, type CampaignFormData } from "@/components/admin/CampaignEditor";
import { PageTop } from "@/components/admin/ui";
import { addDays, toMaputo, todayMaputo } from "@/lib/time";
import { getCampaignForEdit, pickerGroups, stateOf, type CampaignPiece } from "@/server/admin/campaigns";
import { CAMPAIGN_COLORS } from "@/server/campaigns";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Campanha" };

/**
 * EN: "Gestão · Nova campanha" of design V3-G-Campanha-Editar (and editing an existing campaign).
 * PT: Nova campanha do V3 (e editar uma campanha existente).
 */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("products.publish");
  const { id } = await params;
  const isNew = id === "nova";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const groups = await pickerGroups();
  let data: CampaignFormData;
  let pieces: CampaignPiece[] = [];
  if (isNew) {
    const start = addDays(todayMaputo(), 7);
    data = {
      name: "",
      phrase: "",
      kind: "normal",
      startDate: start,
      startTime: "00:00",
      endDate: addDays(start, 3),
      endTime: "23:59",
      discountMode: "uniform",
      percent: 30,
      topBar: true,
      homePlacement: "after",
      ownPage: true,
      countdown: true,
      colors: CAMPAIGN_COLORS,
      imageUrl: null,
      state: "draft",
    };
  } else {
    const e = await getCampaignForEdit(id).catch(() => notFound());
    const r = e.row;
    const s = toMaputo(r.startsAt);
    const f = toMaputo(r.endsAt);
    pieces = e.pieces;
    data = {
      id: r.id,
      slug: r.slug,
      name: r.name.pt,
      phrase: r.phrase?.pt ?? "",
      kind: r.kind,
      startDate: s.date,
      startTime: s.time,
      endDate: f.date,
      endTime: f.time,
      discountMode: r.discountMode,
      percent: r.percent,
      topBar: r.topBar,
      homePlacement: r.homePlacement,
      ownPage: r.ownPage,
      countdown: r.countdown,
      colors: { ...CAMPAIGN_COLORS, ...(r.colors ?? {}) },
      imageUrl: r.imageUrl,
      state: stateOf(r),
    };
  }
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/coleccoes", label: "Colecções" }, { label: "Campanhas" }, { label: isNew ? "Nova" : data.name }]}
        title={
          <>
            {isNew ? "Nova" : "Editar"} <em>campanha</em>
          </>
        }
      />
      <CampaignEditor data={data} pieces={pieces} groups={groups} />
    </>
  );
}
