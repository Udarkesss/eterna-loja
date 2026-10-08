import { NextResponse } from "next/server";
import { readLocalPublicUpload } from "@/server/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4" };

/**
 * GET /uploads/<folder>/<file>
 * EN: Public files uploaded in the back-office (product photos, site images and videos). Names are random UUIDs.
 * PT: Ficheiros públicos carregados na gestão (fotos de produto, imagens e vídeos do site). Nomes são UUID aleatórios.
 * EN: Only used locally; online the files live in Vercel Blob. PT: Só em local; online ficam no Vercel Blob.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.length !== 2 || !["products", "content"].includes(parts[0]) || !/^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/.test(parts[1])) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const data = await readLocalPublicUpload(parts[0], parts[1]);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[parts[1].split(".").pop()!],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
