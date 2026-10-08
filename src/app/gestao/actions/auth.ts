"use server";

import { redirect } from "next/navigation";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { AppError } from "@/server/errors";
import { currentStaff } from "@/server/staff/access";
import {
  changeStaffPassword,
  createFirstAdmin,
  loginStaff,
  logoutStaff,
  requestStaffReset,
  resetStaffPassword,
} from "@/server/staff/auth";

/**
 * EN: Server actions of "Gestão · 0 Entrar". They return a small state for the form (error / notice / next view).
 * PT: Acções do ecrã "Gestão · 0 Entrar". Devolvem um estado pequeno para o formulário.
 */

export interface AuthState {
  error?: string;
  notice?: string;
  view?: "login" | "recover" | "sent" | "reset" | "first" | "locked";
  identifier?: string;
  demoCode?: string;
}

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Utilizador ou palavra-passe incorrectos.",
  LOCKED: "Conta bloqueada durante 15 minutos. Houve 5 tentativas falhadas. Por segurança, avisámos o Administrador.",
  SUSPENDED: "Esta conta está suspensa. Fale com a gestão da loja.",
  INVALID_CODE: "Código errado ou expirado.",
  PASSWORDS_DIFFER: "As duas palavras-passe não são iguais.",
  PASSWORD_TOO_SHORT: "A palavra-passe precisa de pelo menos 10 caracteres.",
  PASSWORD_TOO_COMMON: "Essa palavra-passe é demasiado comum.",
  ALREADY_SET_UP: "A gestão já tem um Superadministrador. Entre com a sua conta.",
};

function fail(error: unknown, extra: AuthState = {}): AuthState {
  if (error instanceof AppError) {
    return { ...extra, error: MESSAGES[error.message] ?? "Não foi possível concluir. Tente novamente.", view: error.message === "LOCKED" ? "locked" : extra.view };
  }
  throw error;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function destination(roleKey: string) {
  return roleKey === "entregador" ? "/gestao/sem-acesso" : "/gestao";
}

export async function signInStaff(_: AuthState, form: FormData): Promise<AuthState> {
  const identifier = str(form, "identifier");
  let result: { mustChange: boolean; roleKey: string };
  try {
    result = await loginStaff(identifier, String(form.get("password") ?? ""));
  } catch (e) {
    return fail(e, { view: "login", identifier });
  }
  if (result.mustChange) return { view: "first", identifier, notice: "Primeiro acesso: defina a sua palavra-passe." };
  redirect(destination(result.roleKey));
}

export async function recoverStaff(_: AuthState, form: FormData): Promise<AuthState> {
  const identifier = str(form, "identifier");
  const channel = form.get("channel") === "email" ? "email" : "whatsapp";
  const r = await requestStaffReset(identifier, channel);
  return {
    view: "sent",
    identifier,
    demoCode: r.devCode,
    notice: `Se a conta existir, enviámos as instruções para ${channel === "email" ? "o e-mail" : "o WhatsApp"} registado. O código vale 30 minutos e só pode ser usado uma vez.`,
  };
}

export async function resetStaff(_: AuthState, form: FormData): Promise<AuthState> {
  const identifier = str(form, "identifier");
  let result: { roleKey: string };
  try {
    result = await resetStaffPassword({
      identifier,
      code: str(form, "code"),
      password: String(form.get("password") ?? ""),
      repeat: String(form.get("repeat") ?? ""),
    });
  } catch (e) {
    return fail(e, { view: "reset", identifier });
  }
  redirect(destination(result.roleKey));
}

/** EN: First sign-in with a temporary password. PT: Primeiro acesso com palavra-passe temporária. */
export async function setFirstPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const staff = await currentStaff();
  if (!staff) return { view: "login", error: "A sessão terminou. Entre outra vez." };
  try {
    await changeStaffPassword(staff.id, {
      current: String(form.get("current") ?? ""),
      password: String(form.get("password") ?? ""),
      repeat: String(form.get("repeat") ?? ""),
    });
  } catch (e) {
    return fail(e, { view: "first" });
  }
  redirect(destination(staff.roleKey));
}

export async function setupFirstAdmin(_: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalizeMsisdn(str(form, "phone"));
  if (!phone) return { error: "Número de WhatsApp inválido." };
  const username = str(form, "username").toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "Nome de utilizador: 3 a 30 letras, números, ponto ou hífen." };
  try {
    await createFirstAdmin({
      name: str(form, "name"),
      username,
      phone,
      email: str(form, "email") || undefined,
      password: String(form.get("password") ?? ""),
      repeat: String(form.get("repeat") ?? ""),
    });
  } catch (e) {
    return fail(e);
  }
  redirect("/gestao");
}

export async function signOutStaff() {
  const staff = await currentStaff();
  await logoutStaff(staff);
  redirect("/gestao/entrar");
}
