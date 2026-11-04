"use client";

import { useRef, useState } from "react";
import { uploadContentFileAction } from "@/app/gestao/actions/content";
import { Icon } from "@/components/ui/Icon";
import s from "./admin.module.css";
import type { FrameKind } from "@/data/framing";
import { FrameButton } from "./FrameDialog";

/**
 * EN: Generic editor for a section's fields (stored as JSON). Texts { pt, en } get two boxes; image/video paths get
 *     an upload button; lists can grow and shrink. New sections work without writing a new form.
 * PT: Editor genérico dos campos de uma secção (guardados em JSON). Textos { pt, en } têm duas caixas; imagens e
 *     vídeos têm botão de carregar; listas podem crescer e encolher.
 */

const LABELS: Record<string, string> = {
  eyebrow: "Sobretítulo",
  title: "Título",
  body: "Texto",
  cta: "Texto do botão",
  label: "Texto do botão",
  primaryCta: "Botão principal",
  secondaryCta: "Botão secundário",
  linkLabel: "Texto da ligação",
  href: "Ligação",
  image: "Imagem",
  images: "Imagens",
  alt: "Texto alternativo",
  badge: "Selo sobre a imagem",
  messages: "Mensagens",
  startsAt: "Mostrar a partir de",
  endsAt: "Até",
  cards: "Cartões",
  steps: "Passos",
  items: "Itens",
  whatsapp: "WhatsApp (só dígitos, com 258)",
  hoursLine: "Linha do horário",
  showPaymentLogos: "Mostrar logótipos de pagamento",
  icon: "Ícone",
  // EN: Home sections of design V3. PT: Secções do Início do V3.
  message: "Mensagem",
  showTitle: "Mostrar frase e botão (senão, só a etiqueta)",
  videoBadge: "Etiqueta sobre o vídeo",
  imageBadge: "Etiqueta sobre a imagem",
  videoLabel: "Descrição do vídeo (acessibilidade)",
  imageAlt: "Descrição da imagem (acessibilidade)",
  subtitle: "Subtítulo",
  count: "Quantas peças",
  cue: "Convite para descer",
  collection: "Colecção (endereço, ex.: essenza)",
  lines: "Linhas",
  line: "Linha",
  links: "Ligações",
  link: "Ligação",
  position: "Enquadramento da imagem",
  visible: "Visível",
  band: "Faixa escura",
  pill: "Etiqueta",
  note: "Nota",
  card: "Cartão",
  experience: "A experiência Eterna",
  step: "Passo",
  tabs: "Separadores",
  tab: "Separador",
  seconds: "Segundos entre Festa e Executivos",
  quote: "Citação",
  values: "Valores",
  value: "Valor",
  figures: "Números",
  figure: "Número",
  founderLabel: "Nome da fundadora",
  founderCaption: "Legenda da fundadora",
  teamTitle: "Título da equipa",
  teamCaption: "Legenda da equipa",
  socialEyebrow: "Sobretítulo das redes sociais",
  socialTitle: "Título das redes sociais",
  socialImages: "Imagens das redes sociais",
  stores: "Lojas",
  store: "Loja",
  code: "Código",
  name: "Nome",
  action: "Texto do botão",
  description: "Descrição",
  mapsUrl: "Ligação do mapa (Google Maps)",
};

// EN: Hero media, slides and effects are edited on their own page. PT: Media, slides e efeitos do topo têm página própria.
const HIDDEN = new Set([
  "media",
  "videoDesktop",
  "videoMobile",
  "poster",
  "posterMobile",
  "parallax",
  "parallaxIntensity",
  "autoplay",
  "loop",
  "slides",
  "slidesAuto",
  "progress",
  "reveal",
  "scrollbar",
]);

type Json = unknown;
const isLocalized = (v: Json): v is { pt: string; en: string } =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 2 && "pt" in v && "en" in v;
const isMedia = (key: string, v: Json) => typeof v === "string" && (/image|poster|video/i.test(key) || /\.(webp|jpe?g|png|mp4)$/.test(v));
const label = (key: string) => LABELS[key] ?? key;

function Upload({ onDone, accept }: { onDone: (url: string) => void; accept: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button type="button" className={`${s.btnOutline} ${s.small}`} disabled={busy} onClick={() => ref.current?.click()}>
        <Icon name="upload" size={14} />
        {busy ? "A carregar…" : "Substituir"}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const form = new FormData();
          form.set("file", file);
          const r = await uploadContentFileAction(form);
          setBusy(false);
          if (r.ok && r.url) onDone(r.url);
          else setError(r.message ?? "Erro");
        }}
      />
      {error && <span className={s.hint} style={{ color: "var(--danger)" }}>{error}</span>}
    </>
  );
}

export function MediaField({ name, value, onChange, frame }: { name: string; value: string; onChange: (v: string) => void; frame?: FrameKind }) {
  const video = /\.mp4$/.test(value) || /video/i.test(name);
  const pdf = /\.pdf$/i.test(value) || /pdf/i.test(name);
  return (
    <div className={s.fieldset}>
      <span className={s.label}>{label(name)}</span>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {value &&
          (pdf ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className={s.a}>
              Abrir PDF ↗
            </a>
          ) : video ? (
            <video src={value} muted style={{ width: 120, height: 72, objectFit: "cover", background: "var(--blush-light)" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- EN: preview of any path. PT: pré-visualização.
            <img src={value} alt="" style={{ width: 96, height: 72, objectFit: "cover", background: "var(--blush-light)" }} />
          ))}
        <input className={s.input} style={{ flex: "1 1 200px" }} value={value} onChange={(e) => onChange(e.target.value)} />
        <Upload onDone={onChange} accept={video ? "video/mp4" : pdf ? "application/pdf" : "image/jpeg,image/png,image/webp"} />
        {value && !pdf && <FrameButton url={value} kind={video ? "video" : (frame ?? "cover")} title={label(name)} className={`${s.btnOutline} ${s.small}`} />}
      </div>
    </div>
  );
}

export function FieldEditor({ name, value, onChange }: { name: string; value: Json; onChange: (v: Json) => void }) {
  if (HIDDEN.has(name)) return null;

  if (isLocalized(value)) {
    const long = value.pt.length > 70 || value.pt.includes("\n") || name === "body";
    const Box = long ? "textarea" : "input";
    return (
      <div className={s.row2}>
        {(["pt", "en"] as const).map((l) => (
          <label key={l} className={s.label}>
            {label(name)} ({l.toUpperCase()})
            <Box className={long ? s.textarea : s.input} rows={long ? 3 : undefined} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          </label>
        ))}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <label className={s.check}>
        <input type="checkbox" checked={value} onChange={() => onChange(!value)} />
        {label(name)}
      </label>
    );
  }

  if (isMedia(name, value)) return <MediaField name={name} value={value as string} onChange={onChange} />;

  if (typeof value === "string" || typeof value === "number" || value === null) {
    const date = name === "startsAt" || name === "endsAt";
    return (
      <label className={s.label}>
        {label(name)}
        <input
          className={s.input}
          type={date ? "date" : typeof value === "number" ? "number" : "text"}
          value={value === null ? "" : String(value)}
          onChange={(e) => onChange(typeof value === "number" ? Number(e.target.value) : e.target.value || (date ? null : ""))}
        />
        {name === "href" && <span className={s.hint}>category:essenza · product:7g184 · #prova (Agendar prova) · https://…</span>}
      </label>
    );
  }

  if (Array.isArray(value)) {
    const blank = (sample: Json): Json =>
      isLocalized(sample) ? { pt: "", en: "" } : typeof sample === "string" ? "" : sample && typeof sample === "object" ? Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, blank(v)])) : sample;
    return (
      <fieldset className={s.fieldset} style={{ padding: 12, border: "1px solid var(--line)" }}>
        <legend className={s.legend}>{label(name)}</legend>
        {value.map((item, i) => (
          <div key={i} className={s.fieldset} style={{ paddingBottom: 10, borderBottom: "1px dashed var(--line)" }}>
            <FieldEditor name={typeof item === "string" && /\//.test(item) ? "image" : name.replace(/s$/, "")} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
            <button type="button" className={s.linkBtn} style={{ alignSelf: "flex-start", color: "var(--danger)" }} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Remover
            </button>
          </div>
        ))}
        {value.length > 0 && (
          <button type="button" className={`${s.btnOutline} ${s.small}`} style={{ alignSelf: "flex-start" }} onClick={() => onChange([...value, blank(value[value.length - 1])])}>
            <Icon name="plus" size={14} />
            Adicionar
          </button>
        )}
      </fieldset>
    );
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, Json>;
    return (
      <fieldset className={s.fieldset}>
        {name !== "root" && <legend className={s.legend}>{label(name)}</legend>}
        {Object.entries(obj).map(([k, v]) => (
          <FieldEditor key={k} name={k} value={v} onChange={(nv) => onChange({ ...obj, [k]: nv })} />
        ))}
      </fieldset>
    );
  }
  return null;
}
