import { loadEnvConfig } from "@next/env";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

/**
 * EN: Creates the DEMO Superadministrador "demo.super" (password = DEMO_PASSWORD) so the back-office can be tried
 *     before the real owner account exists. It is marked as demo: it does not block "Primeiro acesso" and is removed
 *     with the demo data. With PGlite, stop `npm run dev` first.
 * PT: Cria o Superadministrador de EXEMPLO "demo.super" (palavra-passe = DEMO_PASSWORD) para experimentar a gestão
 *     antes de existir a conta real. Está marcado como exemplo: não bloqueia o "Primeiro acesso" e é apagado com os
 *     dados de exemplo. Com PGlite, parar o `npm run dev` primeiro.
 */
loadEnvConfig(process.cwd());

const scryptAsync = promisify(scrypt) as (p: string, s: Buffer, k: number, o: object) => Promise<Buffer>;

async function hash(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { createDatabase } = await import("../src/server/db/client");
  const { seedIfEmpty } = await import("../src/server/db/seed");
  const schema = await import("../src/server/db/schema");
  const connection = createDatabase();
  try {
    await connection.migrate();
    await seedIfEmpty(connection.db);
    const db = connection.db;
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.key, "super"));
    const passwordHash = await hash(process.env.DEMO_PASSWORD || "demo-eterna-2026");
    await db.delete(schema.staffUsers).where(eq(schema.staffUsers.username, "demo.super"));
    const [row] = await db
      .insert(schema.staffUsers)
      .values({ name: "[Superadministrador de exemplo]", username: "demo.super", phone: "840000001", roleId: role.id, status: "active", passwordHash, isDemo: true })
      .returning();
    const stores = await db.select().from(schema.stores);
    await db.insert(schema.staffUserStores).values(stores.map((s) => ({ staffUserId: row.id, storeId: s.id })));
    console.log("✓ demo.super created / criado (password = DEMO_PASSWORD)");
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
