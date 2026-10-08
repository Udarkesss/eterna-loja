import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { PageTop, when } from "@/components/admin/ui";
import { INFO_LABELS, listSections, SECTION_LABELS } from "@/server/admin/content";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Conteúdo do site" };

/** EN: "Gestão · 8 Conteúdo do site" — pages Início and Informações. PT: Páginas Início e Informações. */
export default async function ContentPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requireStaffPage("content");
  const page = (await searchParams).pagina === "informacoes" ? "info" : "home";
  const rows = await listSections(page);
  const last = rows.map((r) => r.publishedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
      <PageTop
        eyebrow="Páginas e secções"
        title={
          <>
            Conteúdo do <em>site</em>
          </>
        }
      />
      <div role="tablist" aria-label="Páginas" className={s.tabs}>
        <Link href="?pagina=inicio" role="tab" aria-selected={page === "home"}>
          Início
        </Link>
        <Link href="?pagina=informacoes" role="tab" aria-selected={page === "info"}>
          Informações
        </Link>
        <Link href="/gestao/conteudo/imagem-principal" role="tab" aria-selected={false}>
          Vídeo, parallax e ocasiões
        </Link>
        <Link href="/gestao/produtos" role="tab" aria-selected={false}>
          Noivas e Ocasiões (produtos e colecções)
        </Link>
      </div>
      <ContentEditor
        key={page}
        page={page}
        publishedAt={last ? when(last) : null}
        sections={rows.map((r) => ({ key: r.key, label: (page === "home" ? SECTION_LABELS : INFO_LABELS)[r.key] ?? r.key, visible: r.visible, data: r.data }))}
      />
    </>
  );
}
