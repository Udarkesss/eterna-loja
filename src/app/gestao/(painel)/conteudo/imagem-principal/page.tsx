import { and, eq } from "drizzle-orm";
import { HeroEditor } from "@/components/admin/HeroEditor";
import { PageTop } from "@/components/admin/ui";
import { listOccasionTargets, listTiles } from "@/server/admin/content";
import { getDb } from "@/server/db";
import { contentSections } from "@/server/db/schema";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Imagem principal e ocasiões" };

/** EN: "Gestão · 9 Vídeo, parallax e ocasiões". PT: Imagem principal, parallax e ocasiões especiais. */
export default async function HeroPage() {
  await requireStaffPage("content");
  const db = await getDb();
  const [hero] = await db.select().from(contentSections).where(and(eq(contentSections.page, "home"), eq(contentSections.key, "hero")));
  const [tiles, targets] = await Promise.all([listTiles(), listOccasionTargets()]);
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/conteudo", label: "Conteúdo do site" }, { label: "Início" }]}
        eyebrow="Conteúdo do site · Início"
        title={
          <>
            Imagem principal <em>e ocasiões</em>
          </>
        }
      />
      <HeroEditor
        hero={(hero?.data ?? {}) as Record<string, unknown>}
        tiles={tiles.map((t) => ({ id: t.id, name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, categoryId: t.categoryId, size: t.size }))}
        targets={targets}
      />
    </>
  );
}
