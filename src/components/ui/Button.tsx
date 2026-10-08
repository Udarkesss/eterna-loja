import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

/**
 * EN: Design buttons (52px, uppercase, 2px radius):
 *     primary = Privée black · outline = ink border · light = ivory on Privée · gold = champagne border on Privée.
 * PT: Botões do design (52px, maiúsculas, canto 2px): primary preto · outline contorno · light marfim · gold dourado.
 */

type Variant = "primary" | "outline" | "light" | "gold";

interface StyleProps {
  variant?: Variant;
  block?: boolean;
  size?: "md" | "lg";
}

function classes({ variant = "primary", block, size = "md" }: StyleProps, extra?: string) {
  return [styles.button, styles[variant], size === "lg" && styles.lg, block && styles.block, extra].filter(Boolean).join(" ");
}

export function Button({
  variant,
  block,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return <button type={type} className={classes({ variant, block, size }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  block,
  size,
  className,
  href,
  scroll,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & StyleProps & { href: string; scroll?: boolean }) {
  if (/^(https?:|tel:|mailto:)/.test(href)) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={classes({ variant, block, size }, className)}
        {...props}
      />
    );
  }
  return <Link href={href} scroll={scroll} className={classes({ variant, block, size }, className)} {...props} />;
}
