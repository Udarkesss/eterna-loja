import Link from "next/link";
import c from "@/components/admin/AdminV3.module.css";
import d3 from "@/components/admin/Dashboard.module.css";
import { ExcelImport } from "@/components/admin/ExcelImport";
import { PageTop } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { COLUMNS } from "@/server/import/excel";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Importar produtos" };

const EXAMPLE = [
  ["8G1L7", "Vestido cocktail champanhe", "Vestidos cocktail", "Essenza", "Gala; Convidada", "…", "…", "27500", "", "Champanhe", "", "6US/38EUR/S"],
  ["SUIT311", "Fato executivo preto", "Fatos executivos", "Essenza", "Evento Corporativo", "…", "…", "13500", "", "Preto", "", "8US/40EUR/M"],
];
const TREE = `fotos.zip
├─ 8G1L7/
│  ├─ 8G1L7_champanhe_01.jpg
│  ├─ 8G1L7_champanhe_02.jpg
│  └─ 8G1L7_01.jpg        ← sem cor = todas as cores
└─ SUIT311/
   ├─ SUIT311_preto_01.jpg
   ├─ SUIT311_vermelho_01.jpg
   └─ SUIT311_verde_01.jpg`;

/**
 * EN: "Gestão · Importar" of design V3-G-Importar (Excel + ZIP). PT: Importar do V3 (Excel + ZIP).
 */
export default async function ImportPage() {
  await requireStaffPage("products.publish");
  return (
    <>
      <PageTop
        eyebrow="Catálogo · importação em massa"
        title={
          <>
            Importar <em>produtos</em>
          </>
        }
      />
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Preparar os ficheiros</h2>
        </div>
        <div className={d3.panelBody} style={{ gap: 18 }}>
          <div className={c.half} style={{ gap: 24 }}>
            <div className={c.field} style={{ gap: 12 }}>
              <span className={c.label}>1 · Preencha o Excel modelo</span>
              <p className={c.small} style={{ color: "var(--muted)" }}>
                Uma linha por cor e tamanho. As colunas com ▾ têm listas de escolha: não se escreve à mão.
              </p>
              <Link prefetch={false} href="/gestao/produtos/importar/modelo" className={`${c.btn} ${c.sm}`} style={{ alignSelf: "flex-start" }}>
                <Icon name="download" size={15} />
                Descarregar modelo (.xlsx)
              </Link>
            </div>
            <div className={c.field} style={{ gap: 12 }}>
              <span className={c.label}>2 · Organize as fotos numa pasta ZIP</span>
              <p className={c.small} style={{ color: "var(--muted)" }}>
                Uma pasta por código. O nome do ficheiro diz a cor.
              </p>
              <pre className={c.pre}>{TREE}</pre>
            </div>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid var(--line)" }}>
            <table className={d3.table} style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {COLUMNS.slice(0, 12).map((h) => (
                    <th key={h} style={{ whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAMPLE.map((r) => (
                  <tr key={r[0]}>
                    {r.map((v, i) => (
                      <td key={i} style={{ whiteSpace: "nowrap" }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>3 · Carregar e verificar</h2>
        </div>
        <ExcelImport />
      </section>
      <div className={c.note}>
        <Icon name="info" size={18} />
        <span>
          Se o código já existir, o produto é actualizado (serve para actualizar stock e preços de uma vez). O importador do Shopify continua disponível para a migração inicial:{" "}
          <Link href="/gestao/produtos/importar/shopify" style={{ textDecoration: "underline" }}>
            Importar do Shopify (CSV)
          </Link>
          .
        </span>
      </div>
    </>
  );
}
