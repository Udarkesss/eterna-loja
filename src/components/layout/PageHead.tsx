import type { ReactNode } from "react";
import { RichText } from "@/components/ui/RichText";
import styles from "./PageHead.module.css";

/**
 * EN: Title block for simple pages, using the category title style from the design.
 * PT: Bloco de título das páginas simples, com o estilo de título da categoria do design.
 */
export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className={`page-x ${styles.head}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className={styles.title}>
        <RichText text={title} />
      </h1>
      {children}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className={`page-x ${styles.body}`}>{children}</div>;
}
