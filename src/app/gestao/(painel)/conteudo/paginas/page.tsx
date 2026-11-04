import { ContentEditor } from "@/components/admin/ContentEditor";
import { PageTop, when } from "@/components/admin/ui";
import { INFO_LABELS, listSections } from "@/server/admin/content";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Páginas de informação" };

/**
 * EN: "Outras páginas" of Gestão · Conteúdo do site (design V3): the information pages of the footer (sizes, exchanges,
 *     privacy…).
 * PT: "Outras páginas" do Conteúdo do site (V3): as páginas de informação do rodapé (tamanhos, trocas, privacidade…).
 */
export default async function InfoPagesPage() {
  await requireStaffPage("content");
  const rows = await listSections("info");
  const last = rows.map((r) => r.publishedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  return (
    <>
      <PageTop
        crumbs={[{ href: "/gestao/conteudo", label: "Conteúdo do site" }, { label: "Outras páginas" }]}
        title={
          <>
            Páginas de <em>informação</em>
          </>
        }
      />
      <ContentEditor
        page="info"
        publishedAt={last ? when(last) : null}
        sections={rows.map((r) => ({ key: r.key, label: INFO_LABELS[r.key] ?? r.key, visible: r.visible, data: r.data }))}
      />
    </>
  );
}
