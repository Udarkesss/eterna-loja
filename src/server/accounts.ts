import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { parseIdentifier } from "@/lib/auth-schemas";
import { formatMsisdn } from "@/lib/payments/msisdn";
import type { CustomerDTO, IdentityProvider, Locale } from "@/types";
import { checkCode, issueCode } from "./auth/codes";
import { hashPassword, passwordProblem, verifyPassword } from "./auth/crypto";
import { createSession, currentSubjectId, destroyCurrentSession } from "./auth/sessions";
import { getDb } from "./db";
import { customerIdentities, customers, favorites, products } from "./db/schema";
import { AppError } from "./errors";
import { devOnly, sendMessage } from "./messaging";

/**
 * EN: Customer accounts (design: "Conta · Entrar ou criar conta", "Formas de entrar", "Acessos e API").
 *     One person = one customer with several identities (e-mail, WhatsApp, Google, Facebook). The same verified
 *     e-mail or confirmed number is linked to the existing account — never a duplicate. Customers never reach
 *     the back-office (separate session cookie).
 * PT: Contas de cliente. Uma pessoa = um cliente com várias identidades. O mesmo e-mail verificado ou número
 *     confirmado liga à conta existente — nunca duplica. Clientes nunca acedem à gestão (cookie separado).
 */

type CustomerRow = typeof customers.$inferSelect;

function checkPassword(password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new AppError("VALIDATION_ERROR", problem === "too_short" ? "PASSWORD_TOO_SHORT" : "PASSWORD_TOO_COMMON", 400);
}

async function addIdentity(customerId: string, provider: IdentityProvider, providerUserId: string, label: string) {
  const db = await getDb();
  await db.insert(customerIdentities).values({ customerId, provider, providerUserId, label }).onConflictDoNothing();
}

async function findByIdentifier(identifier: string): Promise<CustomerRow | null> {
  const parsed = parseIdentifier(identifier);
  if (!parsed) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(parsed.kind === "email" ? eq(customers.email, parsed.value) : eq(customers.phone, parsed.value))
    .limit(1);
  return row ?? null;
}

export async function toCustomerDTO(row: CustomerRow): Promise<CustomerDTO> {
  const db = await getDb();
  const ids = await db.select().from(customerIdentities).where(eq(customerIdentities.customerId, row.id));
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    identities: ids.map((i) => ({ provider: i.provider, label: i.label })),
    hasPassword: !!row.passwordHash,
  };
}

async function signIn(row: CustomerRow) {
  const db = await getDb();
  await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, row.id));
  await createSession("customer", row.id);
}

// ── Sign-up / Registo ─────────────────────────────────────────────────

export async function registerWithEmail(input: { name: string; email: string; password: string; locale: Locale }) {
  checkPassword(input.password);
  const db = await getDb();
  const existing = await findByIdentifier(input.email);
  // EN: The e-mail is not verified yet, so we cannot link it: ask to sign in instead.
  // PT: O e-mail ainda não está verificado, por isso não o ligamos: pede-se para entrar.
  if (existing) throw new AppError("CONFLICT", "ACCOUNT_EXISTS", 409);
  const [row] = await db
    .insert(customers)
    .values({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password), locale: input.locale })
    .returning();
  await addIdentity(row.id, "email", input.email, input.email);
  await sendMessage("email", input.email, `Eterna — conta criada. Bem-vinda, ${input.name}.`);
  await signIn(row);
  return toCustomerDTO(row);
}

/** EN: Step 1 of "Com WhatsApp": sends a 6-digit code. PT: Passo 1: envia um código de 6 dígitos. */
export async function sendWhatsappSignupCode(phone: string) {
  const code = await issueCode({ subjectType: "customer", purpose: "whatsapp_signup", channel: "whatsapp", target: phone });
  await sendMessage("whatsapp", phone, `Eterna: o seu código é ${code}. Vale 30 minutos.`);
  return { sent: true, devCode: devOnly(code) };
}

/** EN: Step 2: checks the code without using it. PT: Passo 2: confirma o código sem o gastar. */
export async function verifyWhatsappSignupCode(phone: string, code: string) {
  const result = await checkCode({ subjectType: "customer", purpose: "whatsapp_signup", target: phone, code, consume: false });
  if (!result.ok) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);
  const existing = await findByIdentifier(phone);
  return { verified: true, existingName: existing?.name ?? null };
}

/**
 * EN: Step 3: name + password. If the number already has an account it is linked (the code proves ownership).
 * PT: Passo 3: nome + palavra-passe. Se o número já tem conta, liga-se (o código prova que é da pessoa).
 */
export async function completeWhatsappSignup(input: { phone: string; code: string; name: string; password: string; locale: Locale }) {
  checkPassword(input.password);
  const result = await checkCode({ subjectType: "customer", purpose: "whatsapp_signup", target: input.phone, code: input.code, consume: true });
  if (!result.ok) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);

  const db = await getDb();
  const passwordHash = await hashPassword(input.password);
  let row = await findByIdentifier(input.phone);
  if (row) {
    [row] = await db
      .update(customers)
      .set({ passwordHash, phoneVerifiedAt: new Date() })
      .where(eq(customers.id, row.id))
      .returning();
  } else {
    [row] = await db
      .insert(customers)
      .values({ name: input.name, phone: input.phone, phoneVerifiedAt: new Date(), passwordHash, locale: input.locale })
      .returning();
  }
  await addIdentity(row.id, "whatsapp", input.phone, `+258 ${formatMsisdn(input.phone)}`);
  await signIn(row);
  return toCustomerDTO(row);
}

// ── Sign-in / Entrar ──────────────────────────────────────────────────

export async function loginCustomer(identifier: string, password: string) {
  const row = await findByIdentifier(identifier);
  // EN: Same answer whether the account exists or not. PT: A mesma resposta exista ou não a conta.
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    throw new AppError("UNAUTHORIZED", "INVALID_CREDENTIALS", 401);
  }
  await signIn(row);
  return toCustomerDTO(row);
}

export async function logoutCustomer() {
  await destroyCurrentSession("customer");
}

/** EN: "Esqueci a palavra-passe": always a neutral answer. PT: Resposta sempre neutra. */
export async function requestCustomerPasswordReset(identifier: string) {
  const row = await findByIdentifier(identifier);
  const parsed = parseIdentifier(identifier);
  if (!row || !parsed) return { sent: true };
  const channel = parsed.kind === "email" ? "email" : "whatsapp";
  const code = await issueCode({ subjectType: "customer", subjectId: row.id, purpose: "password_reset", channel, target: parsed.value });
  await sendMessage(channel, parsed.value, `Eterna: código para nova palavra-passe: ${code}. Vale 30 minutos.`);
  return { sent: true, devCode: devOnly(code) };
}

export async function resetCustomerPassword(input: { identifier: string; code: string; password: string }) {
  checkPassword(input.password);
  const parsed = parseIdentifier(input.identifier);
  if (!parsed) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);
  const result = await checkCode({ subjectType: "customer", purpose: "password_reset", target: parsed.value, code: input.code, consume: true });
  if (!result.ok || !result.subjectId) throw new AppError("VALIDATION_ERROR", "INVALID_CODE", 400);
  const db = await getDb();
  const [row] = await db
    .update(customers)
    .set({ passwordHash: await hashPassword(input.password) })
    .where(eq(customers.id, result.subjectId))
    .returning();
  await signIn(row);
  return toCustomerDTO(row);
}

// ── Current customer / Cliente actual ─────────────────────────────────

export async function currentCustomer(): Promise<CustomerRow | null> {
  const id = await currentSubjectId("customer");
  if (!id) return null;
  const db = await getDb();
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

export async function requireCustomer(): Promise<CustomerRow> {
  const row = await currentCustomer();
  if (!row) throw new AppError("UNAUTHORIZED", "SIGN_IN_REQUIRED", 401);
  return row;
}

export async function updateProfile(customerId: string, input: { name: string }) {
  const db = await getDb();
  const [row] = await db.update(customers).set({ name: input.name }).where(eq(customers.id, customerId)).returning();
  return toCustomerDTO(row);
}

/**
 * EN: "Formas de entrar": unlink a method. At least one must stay linked.
 * PT: Desligar uma forma de entrar. Tem de ficar pelo menos uma.
 */
export async function unlinkIdentity(customerId: string, provider: IdentityProvider) {
  const db = await getDb();
  const ids = await db.select().from(customerIdentities).where(eq(customerIdentities.customerId, customerId));
  if (ids.length <= 1) throw new AppError("VALIDATION_ERROR", "LAST_IDENTITY", 400);
  await db
    .delete(customerIdentities)
    .where(and(eq(customerIdentities.customerId, customerId), eq(customerIdentities.provider, provider)));
  const [row] = await db.select().from(customers).where(eq(customers.id, customerId));
  return toCustomerDTO(row);
}

export async function changePassword(customerId: string, current: string, next: string) {
  checkPassword(next);
  const db = await getDb();
  const [row] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (row.passwordHash && !(await verifyPassword(current, row.passwordHash))) {
    throw new AppError("UNAUTHORIZED", "INVALID_CREDENTIALS", 401);
  }
  await db.update(customers).set({ passwordHash: await hashPassword(next) }).where(eq(customers.id, customerId));
}

// ── Favorites / Favoritos ─────────────────────────────────────────────

export async function listFavoriteSlugs(customerId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ slug: products.slug })
    .from(favorites)
    .innerJoin(products, eq(favorites.productId, products.id))
    .where(eq(favorites.customerId, customerId))
    .orderBy(favorites.createdAt);
  return rows.map((r) => r.slug);
}

/** EN: Adds slugs (also used to merge the browser's list after sign-in). PT: Junta slugs (também ao entrar). */
export async function addFavorites(customerId: string, slugs: string[]) {
  if (!slugs.length) return listFavoriteSlugs(customerId);
  const db = await getDb();
  const rows = await db.select({ id: products.id }).from(products).where(inArray(products.slug, slugs));
  if (rows.length) {
    await db
      .insert(favorites)
      .values(rows.map((r) => ({ customerId, productId: r.id })))
      .onConflictDoNothing();
  }
  return listFavoriteSlugs(customerId);
}

export async function removeFavorite(customerId: string, slug: string) {
  const db = await getDb();
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  if (product) {
    await db.delete(favorites).where(and(eq(favorites.customerId, customerId), eq(favorites.productId, product.id)));
  }
  return listFavoriteSlugs(customerId);
}
