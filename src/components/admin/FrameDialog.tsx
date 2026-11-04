"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { getFrameAction, saveFrameAction, uploadPosterAction } from "@/app/gestao/actions/framing";
import { FRAME_DEFAULT, type Frame, type FrameKind } from "@/data/framing";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";

/**
 * EN: "Enquadrar" window of design V3-G-Enquadrar. Covers and photos: drag to move, click to mark the focus, zoom,
 *     "Centrar" and "Repor", with the computer and phone previews and a size check. Videos: drag up or down (the frame
 *     never leaves the video) and pick a frame as the cover image. Type images: circular frame, always centred.
 * PT: Janela "Enquadrar" do V3. Capas e fotos: arrastar para mover, clicar para marcar o foco, zoom, "Centrar" e
 *     "Repor", com as pré-visualizações de computador e telemóvel e o aviso de tamanho. Vídeos: arrastar para cima ou
 *     para baixo (a moldura não sai do vídeo) e escolher um fotograma como imagem de capa. Tipos: moldura circular,
 *     sempre centrada.
 */

const SPEC: Record<FrameKind, { stage: number; min: [number, number]; text: string; previews: [string, number][]; note: string }> = {
  cover: {
    stage: 16 / 9,
    min: [2400, 1350],
    text: "Capa horizontal: 16:9 · mínimo 2400 × 1350 px · JPG ou WebP · até 2 MB.",
    previews: [
      ["Computador · 16:9", 16 / 9],
      ["Telemóvel · 4:5", 4 / 5],
    ],
    note: "O ponto de foco mantém o rosto e a peça visíveis no telemóvel.",
  },
  photo: {
    stage: 3 / 4,
    min: [1200, 1600],
    text: "Fotos de produto: 3:4 · mínimo 1200 × 1600 px · JPG ou WebP · até 2 MB.",
    previews: [
      ["Cartão da loja · 3:4", 3 / 4],
      ["Telemóvel · 4:5", 4 / 5],
    ],
    note: "O ponto de foco mantém o rosto e a peça visíveis em todos os tamanhos.",
  },
  video: {
    stage: 1440 / 520,
    min: [0, 0],
    text: "Faixa do site: 1440 × 520 (computador) e 390 × 300 (telemóvel). O vídeo é horizontal e maior: escolha a parte que aparece. Serve também para fotos.",
    previews: [
      ["Computador · 1440 × 520", 1440 / 520],
      ["Telemóvel · 390 × 300", 390 / 300],
    ],
    note: "O logótipo gravado no fundo do vídeo fica fora da moldura.",
  },
  circle: {
    stage: 1,
    min: [800, 800],
    text: "Barra de tipos (colecções, categorias e pesquisa): moldura circular, centrada. Imagem quadrada ou 3:4 · mínimo 800 × 800 px. Arraste e use o zoom até a peça ficar bem dentro do círculo.",
    previews: [
      ["Computador", 1],
      ["Telemóvel", 1],
    ],
    note: "",
  },
};

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function look(f: Frame): CSSProperties {
  const pos = `${f.x}% ${f.y}%`;
  return { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: f.zoom > 1 ? `scale(${f.zoom})` : undefined, transformOrigin: pos, pointerEvents: "none", userSelect: "none" };
}

export function FrameDialog({ url, kind, title, label, onClose }: { url: string; kind: FrameKind; title: string; label?: string; onClose: () => void }) {
  const spec = SPEC[kind];
  const [f, setF] = useState<Frame | null>(null);
  const [size, setSize] = useState<[number, number] | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    getFrameAction(url).then((v) => {
      setF(v);
      if (v.time) setTime(v.time);
    });
  }, [url]);

  /** EN: Overflow of the file inside the frame, in px (to turn a drag into %). PT: Sobra do ficheiro dentro da moldura. */
  const overflow = () => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !size) return null;
    const scale = Math.max(box.width / size[0], box.height / size[1]) * (f?.zoom ?? 1);
    return { box, w: size[0] * scale, h: size[1] * scale };
  };

  const down = (e: ReactPointerEvent) => {
    if (!f) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y, moved: false };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    const o = overflow();
    if (!d || !o || !f) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    const ex = o.w - o.box.width;
    const ey = o.h - o.box.height;
    setF({
      ...f,
      x: kind === "video" || ex <= 0.5 ? f.x : clamp(d.x - (dx / ex) * 100),
      y: ey <= 0.5 ? f.y : clamp(d.y - (dy / ey) * 100),
    });
  };
  const up = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const o = overflow();
    if (!d || d.moved || !o || !f || kind === "video" || kind === "circle") return;
    // EN: A click marks the focus: the point of the photo under the pointer. PT: Um clique marca o foco.
    const fx = (e.clientX - o.box.left) / o.box.width;
    const fy = (e.clientY - o.box.top) / o.box.height;
    const offX = ((o.w - o.box.width) * f.x) / 100;
    const offY = ((o.h - o.box.height) * f.y) / 100;
    setF({ ...f, x: clamp(((fx * o.box.width + offX) / o.w) * 100), y: clamp(((fy * o.box.height + offY) / o.h) * 100) });
  };

  const takePoster = async () => {
    const v = video.current;
    if (!v || !f) return;
    setBusy(true);
    setMsg(null);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.86));
    if (!blob) {
      setBusy(false);
      return setMsg({ ok: false, text: "Não foi possível tirar a imagem." });
    }
    const form = new FormData();
    form.set("file", new File([blob], "capa.webp", { type: "image/webp" }));
    const r = await uploadPosterAction(form);
    setBusy(false);
    if (!r.ok || !r.url) return setMsg({ ok: false, text: r.message ?? "Erro" });
    setF({ ...f, poster: r.url, time: Math.round(time * 10) / 10 });
    setMsg({ ok: true, text: `Capa escolhida (${mmss(time)}). Guarde o enquadramento.` });
  };

  const save = async () => {
    if (!f) return;
    setBusy(true);
    const r = await saveFrameAction(url, { ...f, x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10, zoom: Math.round(f.zoom * 100) / 100 });
    setBusy(false);
    if (r.ok) onClose();
    else setMsg({ ok: false, text: r.message ?? "Erro" });
  };

  const small = size && spec.min[0] > 0 && (size[0] < spec.min[0] || size[1] < spec.min[1]);
  const media = (style: CSSProperties, main = false) =>
    kind === "video" ? (
      <video
        ref={main ? video : undefined}
        src={url}
        muted
        playsInline
        preload="auto"
        style={style}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (main) {
            setSize([v.videoWidth, v.videoHeight]);
            setDuration(v.duration);
          }
          v.currentTime = f?.time ?? 0;
        }}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- EN: any uploaded path. PT: qualquer ficheiro carregado.
      <img src={url} alt="" draggable={false} style={style} onLoad={main ? (e) => setSize([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight]) : undefined} />
    );

  return (
    <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={c.modal} role="dialog" aria-modal="true" aria-label={`Enquadrar · ${title}`} style={{ width: 980 }}>
        <div className={c.panelH}>
          <h3>Enquadrar · {title}</h3>
          <span className={c.xsMuted} style={{ marginLeft: "auto", marginRight: 12 }}>
            {kind === "video" ? "Arraste para cima ou para baixo · a moldura não sai do vídeo" : kind === "circle" ? "Arraste a foto · o círculo fica sempre centrado" : "Arraste para mover · clique para marcar o foco"}
          </span>
          <button type="button" className={c.icoBtn} onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={20} />
          </button>
        </div>
        {!f ? (
          <div className={c.panelB}>A carregar…</div>
        ) : (
          <div className={c.panelB}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 24, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  ref={stage}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  style={{ position: "relative", aspectRatio: String(spec.stage), maxHeight: 460, margin: "0 auto", width: kind === "photo" || kind === "circle" ? "min(100%, 360px)" : "100%", overflow: "hidden", background: "#2a2523", cursor: "grab", touchAction: "none" }}
                >
                  {media(look(f), true)}
                  {kind === "circle" && <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle closest-side, transparent calc(100% - 2px), #faf7f2 calc(100% - 2px), #faf7f2 100%, rgba(28,25,23,0.55) 100%)", pointerEvents: "none" }} />}
                  {(kind === "cover" || kind === "photo") && (
                    <span aria-hidden="true" style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: "50%", border: "2px solid #faf7f2", boxShadow: "0 0 0 1px rgba(0,0,0,.35)" }} />
                  )}
                </div>
                {kind === "video" ? (
                  <div className={c.row} style={{ gap: 12 }}>
                    <span className={c.xsMuted}>Capa</span>
                    <input
                      type="range"
                      aria-label="Momento do vídeo para a capa"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={time}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        setTime(t);
                        if (video.current) video.current.currentTime = t;
                      }}
                      style={{ flex: 1, accentColor: "var(--contrast)" }}
                    />
                    <span className={c.xsMuted}>{mmss(time)}</span>
                    <button type="button" className={`${c.btn} ${c.sm}`} disabled={busy} onClick={takePoster}>
                      Usar como imagem de capa
                    </button>
                  </div>
                ) : (
                  <div className={c.row} style={{ gap: 12 }}>
                    <span className={c.xsMuted}>Zoom</span>
                    <input
                      type="range"
                      aria-label="Zoom"
                      min={100}
                      max={300}
                      value={Math.round(f.zoom * 100)}
                      onChange={(e) => setF({ ...f, zoom: Number(e.target.value) / 100 })}
                      style={{ flex: 1, accentColor: "var(--contrast)" }}
                    />
                    <span className={c.xsMuted} style={{ width: 40 }}>
                      {Math.round(f.zoom * 100)}%
                    </span>
                    <button type="button" className={`${c.btn} ${c.sm}`} onClick={() => setF({ ...f, x: 50, y: 50 })}>
                      Centrar
                    </button>
                    <button type="button" className={`${c.btn} ${c.sm}`} onClick={() => setF({ ...FRAME_DEFAULT, poster: f.poster, time: f.time })}>
                      Repor
                    </button>
                  </div>
                )}
                <span className={c.small}>
                  {spec.text}
                  {size && kind !== "video" && kind !== "circle" && ` Esta imagem tem ${size[0]} × ${size[1]} px${size[0] < size[1] && kind === "cover" ? ": é vertical" : ""}${small ? (size[0] < size[1] && kind === "cover" ? " e mais pequena do que o recomendado." : ": é mais pequena do que o recomendado.") : "."}`}
                </span>
                {small && (
                  <div className={c.note} data-tone="warn">
                    Imagem abaixo do tamanho mínimo: pode ficar desfocada em ecrãs grandes.
                  </div>
                )}
                {f.poster && kind === "video" && (
                  <span className={c.xsMuted}>
                    Capa actual: {f.poster.split("/").pop()} {f.time !== undefined && `(${mmss(f.time)})`}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {spec.previews.map(([name, ratio], i) => (
                  <div key={name} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: kind === "circle" ? "center" : "stretch" }}>
                    <span className={c.lbl}>{name}</span>
                    <div
                      style={{
                        position: "relative",
                        aspectRatio: String(ratio),
                        width: kind === "circle" ? (i === 0 ? 120 : 84) : ratio < 1 ? "62%" : "100%",
                        overflow: "hidden",
                        borderRadius: kind === "circle" ? "50%" : 2,
                        background: "#2a2523",
                      }}
                    >
                      {media(look(f))}
                    </div>
                    {kind === "circle" && label && <span className={c.small}>{label}</span>}
                  </div>
                ))}
                {spec.note && <span className={c.xsMuted}>{spec.note}</span>}
              </div>
            </div>
            {msg && (
              <span role={msg.ok ? "status" : "alert"} className={msg.ok ? c.ok : c.err}>
                {msg.text}
              </span>
            )}
            <div className={c.end}>
              <button type="button" className={`${c.btn} ${c.sm}`} onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={busy} onClick={save}>
                Guardar enquadramento
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** EN: "Enquadrar" button that opens the window. PT: Botão "Enquadrar" que abre a janela. */
export function FrameButton({ url, kind, title, label, className, iconOnly }: { url: string; kind: FrameKind; title: string; label?: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!url || /\.pdf$/i.test(url) || !url.startsWith("/")) return null;
  return (
    <>
      <button type="button" className={className ?? `${c.btn} ${c.xs}`} onClick={() => setOpen(true)} aria-label={iconOnly ? (kind === "circle" ? "Enquadrar no círculo" : "Enquadrar") : undefined} title={iconOnly ? (kind === "circle" ? "Enquadrar no círculo" : "Enquadrar") : undefined}>
        <Icon name="crop" size={13} />
        {!iconOnly && "Enquadrar"}
      </button>
      {/* EN: In a portal, so it never inherits a table row's drag or a button's styles. PT: Num portal, fora da linha da tabela. */}
      {open && createPortal(<FrameDialog url={url} kind={kind} title={title} label={label} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
