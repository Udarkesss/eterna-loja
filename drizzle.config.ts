import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// EN: Read .env.local like Next.js does. PT: Ler o .env.local tal como o Next.js.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
});
