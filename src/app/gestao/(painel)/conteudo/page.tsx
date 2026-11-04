import { HomeContentEditor } from "@/components/admin/HomeContentEditor";
import { PageTop } from "@/components/admin/ui";
import { listOccasionTargets, listSections, listTiles } from "@/server/admin/content";
import { siteCampaign } from "@/server/campaigns";
import { getDb } from "@/server/db";
import { categories } from "@/server/db/schema";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Conteúdo do site" };

/**
 * EN: "Gestão · Conteúdo do site" of design V3-G-Conteudo. PT: Conteúdo do site do V3.
 */
export default async function ContentPage() {
  await requireStaffPage("content");
  const db = await getDb();
  const [rows, tiles, targets, cats, campaign] = await Promise.all([listSections("home"), listTiles(), listOccasionTargets(), db.select().from(categories), siteCampaign("pt")]);
  const active = cats.find((r) => r.kind === "collection" && !r.parentId && r.details?.active);
  return (
    <>
      <PageTop
        eyebrow="Site"
        title={
          <>
            Conteúdo do <em>site</em>
          </>
        }
      />
      <HomeContentEditor
        sections={rows.map((r) => ({ key: r.key, visible: r.visible, data: r.data }))}
        tiles={tiles.map((t) => ({ id: t.id, name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, categoryId: t.categoryId, size: t.size }))}
        targets={targets}
        collection={
          active
            ? { id: active.id, name: active.name.pt, message: active.details?.message?.pt ?? null, buttonText: active.details?.buttonText?.pt ?? null, imageUrl: active.imageUrl }
            : null
        }
        campaign={campaign ? { name: campaign.name, placement: campaign.homePlacement } : null}
      />
    </>
  );
}
