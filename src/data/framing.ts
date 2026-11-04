/**
 * EN: Framing of photos and videos (design V3-G-Enquadrar): for each file, the focus point (x, y in %), the zoom and,
 *     for videos, the cover image taken from a frame. The store applies it everywhere the file appears through one
 *     generated stylesheet, so every screen (covers, circles, cards, video bands) follows the same framing.
 * PT: Enquadramento de fotos e vídeos (V3-G-Enquadrar): para cada ficheiro, o ponto de foco (x, y em %), o zoom e, nos
 *     vídeos, a imagem de capa tirada de um fotograma. A loja aplica-o em todo o lado onde o ficheiro aparece com uma
 *     folha de estilos gerada, por isso todos os ecrãs seguem o mesmo enquadramento.
 */

export interface Frame {
  x: number;
  y: number;
  zoom: number;
  poster?: string;
  time?: number;
}

export type FrameKind = "cover" | "video" | "circle" | "photo";

export const FRAME_DEFAULT: Frame = { x: 50, y: 50, zoom: 1 };

// EN: CSS string; "<" is escaped so the text can never close the <style> tag. PT: "<" escapado.
const q = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\3c ")}"`;
const r = (n: number) => Math.round(n * 10) / 10;

/** EN: CSS for every framed file. PT: CSS para cada ficheiro enquadrado. */
export function frameCss(map: Record<string, Frame>): string {
  return Object.entries(map)
    .filter(([url, f]) => url && (f.x !== 50 || f.y !== 50 || f.zoom !== 1))
    .map(([url, f]) => {
      const sel = [`img[src=${q(url)}]`, `img[src*=${q(`url=${encodeURIComponent(url)}&`)}]`, `video[src=${q(url)}]`, `video:has(source[src=${q(url)}])`].join(",");
      const pos = `${r(f.x)}% ${r(f.y)}%`;
      const zoom = f.zoom > 1 ? `transform:scale(${r(f.zoom * 100) / 100});transform-origin:${pos};` : "";
      return `${sel}{object-position:${pos}!important;${zoom}}`;
    })
    .join("\n");
}
