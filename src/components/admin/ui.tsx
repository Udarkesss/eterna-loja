import Link from "next/link";
import type { ReactNode } from "react";
import s from "./admin.module.css";

/**
 * EN: Small shared pieces of the back-office pages (server components).
 * PT: Peças pequenas partilhadas pelas páginas da gestão (componentes de servidor).
 */

export function PageTop({
  eyebrow,
  title,
  actions,
  crumbs,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  crumbs?: { href?: string; label: string }[];
}) {
  return (
    <>
      {crumbs && (
        <nav aria-label="Caminho" className={s.crumbs}>
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "flex", gap: 8 }}>
              {i > 0 && <span>/</span>}
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className={s.top}>
        <div className={s.topText}>
          {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
          <h1 className={s.h1}>{title}</h1>
        </div>
        {actions && <div className={s.actions}>{actions}</div>}
      </div>
    </>
  );
}

export function Chip({ tone, children }: { tone?: "ok" | "warn" | "bad" | "dark" | ""; children: ReactNode }) {
  return (
    <span className={s.chip} data-tone={tone || undefined}>
      {children}
    </span>
  );
}

export function DemoTag({ show }: { show: boolean }) {
  return show ? <span className={s.tag}>Inclui dados de exemplo</span> : null;
}

/** EN: "52 000,00 MT". PT: Formato de preço do design. */
export function mzn(value: number): string {
  const [i, d] = Math.abs(value).toFixed(2).split(".");
  return `${value < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${d} MT`;
}

/** EN: "Hoje, 14:03" / "Ontem, 18:30" / "27 Set, 10:02" in Maputo time. PT: Em hora de Maputo. */
export function when(date: Date): string {
  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const local = new Date(date.getTime() + 2 * 3_600_000);
  const today = new Date(Date.now() + 2 * 3_600_000);
  const time = local.toISOString().slice(11, 16);
  const dayDiff = Math.round((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())) / 86_400_000);
  if (dayDiff === 0) return `Hoje, ${time}`;
  if (dayDiff === 1) return `Ontem, ${time}`;
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}${local.getUTCFullYear() !== today.getUTCFullYear() ? ` ${local.getUTCFullYear()}` : ""}, ${time}`;
}
