import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { privateFiles } from "./db/schema";
import { AppError } from "./errors";

/**
 * EN: Uploads.
 *     - Private (transfer proofs): stored in the database (table private_files) — never public, same locally and online.
 *     - Public (product photos, site images and videos from the back-office):
 *         online (BLOB_READ_WRITE_TOKEN set) → Vercel Blob, returns its https URL;
 *         locally → .data/public-uploads, served at /uploads/… (src/app/uploads).
 * PT: Ficheiros.
 *     - Privados (comprovativos): na base de dados (tabela private_files) — nunca públicos, igual em local e online.
 *     - Públicos (fotos de produto, imagens e vídeos do site): online → Vercel Blob; em local → .data/public-uploads,
 *       servidos em /uploads/….
 */

const MAX_BYTES = 5 * 1024 * 1024; // EN: design: "até 5 MB". PT: design: "até 5 MB".
const PRIVATE_ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const PUBLIC_ALLOWED: Record<string, { ext: string; max: number }> = {
  "image/jpeg": { ext: "jpg", max: 5 * 1024 * 1024 },
  "image/png": { ext: "png", max: 5 * 1024 * 1024 },
  "image/webp": { ext: "webp", max: 5 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", max: 8 * 1024 * 1024 }, // EN: design: "MP4 até 8 MB". PT: design.
};

// EN: Local public uploads; Next.js only serves /public files that exist at build time. PT: Uploads públicos locais.
export const PUBLIC_DIR = path.join(process.cwd(), ".data", "public-uploads");
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** EN: Returns an internal reference "file:<id>". PT: Devolve uma referência interna "file:<id>". */
export async function savePrivateUpload(file: File, prefix: string): Promise<string> {
  if (!PRIVATE_ALLOWED.includes(file.type)) throw new AppError("VALIDATION_ERROR", "Only photos or PDF", 400, { field: "file" });
  if (file.size > MAX_BYTES) throw new AppError("VALIDATION_ERROR", "File larger than 5 MB", 400, { field: "file" });
  const db = await getDb();
  const [row] = await db
    .insert(privateFiles)
    .values({ name: `${prefix}-${file.name}`.slice(0, 200), contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) })
    .returning({ id: privateFiles.id });
  return `file:${row.id}`;
}

/** EN: Reads a private upload for the back-office. PT: Lê um ficheiro privado para a gestão. */
export async function readPrivateUpload(ref: string): Promise<{ data: Buffer; type: string } | null> {
  const id = ref.replace(/^file:/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(privateFiles).where(eq(privateFiles.id, id));
  return row ? { data: row.data, type: row.contentType } : null;
}

/** EN: Saves a public file and returns its URL. PT: Guarda um ficheiro público e devolve o endereço. */
export async function savePublicUpload(file: File, folder: "products" | "content"): Promise<string> {
  const rule = PUBLIC_ALLOWED[file.type];
  if (!rule) throw new AppError("VALIDATION_ERROR", "Only JPG, PNG, WebP or MP4", 400);
  if (file.size > rule.max) throw new AppError("VALIDATION_ERROR", `File larger than ${rule.max / 1024 / 1024} MB`, 400);
  const name = `${randomUUID()}.${rule.ext}`;
  if (blobEnabled()) {
    const blob = await put(`${folder}/${name}`, file, { access: "public", contentType: file.type, addRandomSuffix: false });
    return blob.url;
  }
  const dir = path.join(PUBLIC_DIR, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${folder}/${name}`;
}

/** EN: Local disk reader for /uploads/… (development). PT: Leitura do disco local para /uploads/…. */
export async function readLocalPublicUpload(folder: string, name: string): Promise<Buffer> {
  return readFile(path.join(PUBLIC_DIR, folder, name));
}
