import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CollectionEditor, type CollectionFormData } from "@/components/admin/CollectionsForms";
import { PageTop } from "@/components/admin/ui";
import { activationCheck, collectionPieces, getCollectionForEdit, isSeasonalTree } from "@/server/admin/collections";
import { changePreview } from "@/server/admin/warehouse";
import { getDb } from "@/server/db";
import { categories } from "@/server/db/schema";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Editar colecção" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ antiga?: string; activar?: string; desactivar?: string }> };

/**
 * EN: "Gestão · Editar colecção" of design V3-G-Colecao-Editar (also "Nova colecção" at /gestao/coleccoes/nova and an
 *     old archive collection with ?antiga=1).
 * PT: Editar colecção do V3 (também "Nova colecção" e colecção antiga com ?antiga=1).
 */
export default async function CollectionEditPage({ params, searchParams }: Props) {
  await requireStaffPage("products.publish");
  const { id } = await params;
  const { antiga, activar, desactivar } = await searchParams;
  const isNew = id === "nova";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.position));
  const lines = ["roupa-de-festa", "roupa-executiva"]
    .map((slug) => rows.find((r) => r.slug === slug))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((l) => ({ slug: l.slug, name: l.name.pt, types: rows.filter((t) => t.parentId === l.id && t.kind === "type").map((t) => ({ id: t.id, name: t.name.pt })) }));
  const parents = rows.filter((r) => r.kind === "collection" && !r.parentId && isSeasonalTree(r, rows) && !r.details?.history).map((r) => ({ id: r.id, name: r.name.pt }));

  let data: CollectionFormData;
  let pieceIds: string[] = [];
  let activeName: string | null = rows.find((r) => r.kind === "collection" && !r.parentId && r.details?.active)?.name.pt ?? null;
  let special: { id: string; name: string; dates: string; imageUrl: string | null }[] = [];
  let check = { total: 0, available: 0 };
  let shop = { all: 0, previous: 0, fixed: 0, toShop: 0, own: 0, fixedNames: [] as string[] };
  if (isNew) {
    data = {
      collectionType: "seasonal",
      parentId: null,
      name: "",
      number: "",
      year: Number(new Date().getFullYear()),
      startsOn: "",
      endsOn: "",
      description: "",
      message: "",
      buttonText: "",
      buttonLink: "auto",
      imageUrl: null,
      history: antiga === "1",
      status: antiga === "1" ? "archived" : "draft",
    };
  } else {
    const e = await getCollectionForEdit(id).catch(() => notFound());
    const d = e.row.details ?? {};
    pieceIds = e.pieceIds;
    activeName = e.activeName;
    special = e.special;
    check = await activationCheck(id);
    const activeId = rows.find((r) => r.kind === "collection" && !r.parentId && r.details?.active && r.id !== id)?.id ?? null;
    shop = await changePreview(id, activeId);
    data = {
      id: e.row.id,
      slug: e.row.slug,
      collectionType: e.row.parentId || d.collectionType === "special" ? "special" : "seasonal",
      parentId: e.row.parentId,
      name: e.row.name.pt,
      number: d.number ?? "",
      year: d.year ?? 0,
      startsOn: d.startsOn ?? "",
      endsOn: d.endsOn ?? "",
      description: e.row.description?.pt ?? "",
      message: d.message?.pt ?? "",
      buttonText: d.buttonText?.pt ?? "",
      buttonLink: d.buttonLink ?? "auto",
      imageUrl: e.row.imageUrl,
      history: !!d.history,
      status: d.active ? "active" : d.history || d.status === "archived" ? "archived" : "draft",
    };
  }
  const pieces = data.history ? [] : await collectionPieces(pieceIds);

  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/coleccoes", label: "Colecções" }, { label: isNew ? (data.history ? "Colecção antiga" : "Nova colecção") : data.name }]}
        title={
          <>
            {isNew ? "Nova" : "Editar"} <em>colecção</em>
          </>
        }
      />
      <CollectionEditor data={data} parents={parents} pieces={pieces} lines={lines} activeName={activeName} check={check} shop={shop} special={special} openConfirm={activar === "1"} openDeactivate={desactivar === "1"} />
    </>
  );
}
