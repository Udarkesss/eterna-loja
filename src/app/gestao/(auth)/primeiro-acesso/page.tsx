import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FirstAdminForm } from "@/components/admin/FirstAdminForm";
import styles from "@/app/[locale]/(auth)/sign-in/sign-in.module.css";
import { needsFirstAdmin } from "@/server/staff/auth";

export const metadata: Metadata = { title: "Primeiro acesso" };

/**
 * EN: Only while the system has no real Superadministrador: the owner creates her own account and password here
 *     (nobody else ever sees it). Afterwards this page is closed for good.
 * PT: Só enquanto não houver Superadministrador real: a dona cria aqui a sua conta e palavra-passe (ninguém mais a vê).
 *     Depois esta página fecha de vez.
 */
export default async function FirstAccessPage() {
  if (!(await needsFirstAdmin())) redirect("/gestao/entrar");
  return (
    <main className={styles.page} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.side} style={{ margin: "0 auto" }}>
        <div className={styles.head}>
          <span className={styles.logo}>ETERNA</span>
          <span className="eyebrow">Gestão interna · primeiro acesso</span>
        </div>
        <h1 className={styles.title}>
          Criar o <em>Superadministrador</em>
        </h1>
        <p style={{ color: "var(--ink-muted)", lineHeight: "24px" }}>
          Esta conta tem acesso total, incluindo chaves e definições. Depois de a criar, os outros utilizadores são criados em
          “Utilizadores internos” e esta página deixa de existir.
        </p>
        <FirstAdminForm />
      </div>
    </main>
  );
}
