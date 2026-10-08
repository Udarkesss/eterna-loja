import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StaffLogin } from "@/components/admin/StaffLogin";
import styles from "@/app/[locale]/(auth)/sign-in/sign-in.module.css";
import { currentStaff } from "@/server/staff/access";
import { needsFirstAdmin } from "@/server/staff/auth";

export const metadata: Metadata = { title: "Entrar" };

/**
 * EN: "Gestão · 0 Entrar": the single sign-in for the whole team (drivers included). No public sign-up.
 * PT: O login único de toda a equipa (entregadores incluídos). Sem registo público.
 */
export default async function StaffSignInPage({ searchParams }: { searchParams: Promise<{ primeiro?: string }> }) {
  const firstSetup = await needsFirstAdmin();
  const staff = await currentStaff();
  const { primeiro } = await searchParams;
  if (staff && staff.status !== "temp_password") redirect(staff.roleKey === "entregador" ? "/gestao/sem-acesso" : "/gestao");

  return (
    <main className={styles.page}>
      <div className={styles.photo}>
        <Image src="/images/content/store-interior.webp" alt="Interior da loja Eterna no Glória Mall" fill priority sizes="50vw" className={styles.img} />
        <span className={styles.badge}>Gestão interna</span>
      </div>
      <div className={styles.side}>
        <div className={styles.head}>
          <span className={styles.logo}>ETERNA</span>
          <span className="eyebrow">Gestão interna · equipa</span>
        </div>
        <h1 className={styles.title}>
          Entrar na <em>gestão</em>
        </h1>
        {firstSetup && (
          <div className="notice-box" style={{ padding: "12px 14px", borderRadius: 6, background: "var(--warning-soft)", color: "var(--warning)", fontSize: 13, lineHeight: "20px" }}>
            A gestão ainda não tem Superadministrador.{" "}
            <Link href="/gestao/primeiro-acesso" style={{ textDecoration: "underline" }}>
              Criar a conta de Superadministrador
            </Link>
          </div>
        )}
        <StaffLogin firstAccess={!!staff && staff.status === "temp_password" && !!primeiro} />
      </div>
    </main>
  );
}
