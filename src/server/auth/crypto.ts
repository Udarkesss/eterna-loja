import "server-only";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * EN: Password and token helpers. Passwords use scrypt (built into Node, memory-hard like Argon2/bcrypt),
 *     stored as "scrypt$N$salt$hash". Session tokens and one-time codes are stored only as SHA-256 hashes.
 * PT: Palavras-passe e tokens. As palavras-passe usam scrypt (vem com o Node, resistente como Argon2/bcrypt),
 *     guardadas como "scrypt$N$sal$hash". Tokens de sessão e códigos de uso único só ficam guardados com hash.
 */

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const N = 16384;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: 8,
    p: 1,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** EN: Long random token (cookies, public links). PT: Token aleatório longo (cookies, links públicos). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** EN: 6-digit code for WhatsApp / e-mail. PT: Código de 6 dígitos para WhatsApp / e-mail. */
export function randomCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * EN: Temporary password for new staff: easy to read aloud, no look-alike characters.
 * PT: Palavra-passe temporária da equipa: fácil de ditar, sem caracteres parecidos.
 */
export function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[randomInt(0, alphabet.length)];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/**
 * EN: Password rules from the design: at least 10 characters, not a common password.
 * PT: Regras do design: pelo menos 10 caracteres e não ser uma palavra-passe comum.
 */
const COMMON = new Set(["1234567890", "password123", "eterna12345", "qwertyuiop1", "12345678910", "palavrapasse"]);
export function passwordProblem(password: string): "too_short" | "too_common" | null {
  if (password.length < 10) return "too_short";
  if (COMMON.has(password.toLowerCase())) return "too_common";
  return null;
}
