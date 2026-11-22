"use client";

import { useRef, useState, useTransition } from "react";
import { publishContactsAction, uploadContactImageAction } from "@/app/gestao/actions/contacts";
import { CONTACT_PLACES, SOCIAL_NETWORKS, type ContactChannel, type ContactPlace, type ContactsSettings, type SocialLink, type SocialNetwork } from "@/data/contacts";
import { Icon } from "@/components/ui/Icon";
import { SocialIcon } from "@/components/ui/SocialIcon";
import type { StoreCardEdit } from "@/server/admin/contacts";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";
import mob from "./Mobile.module.css";
import { FrameButton } from "./FrameDialog";

/**
 * EN: "Gestão · Contactos e redes sociais" of design V3-G-Contactos. PT: Contactos e redes sociais do V3.
 */

const ACTIONS = { whatsapp: "WhatsApp", call: "Ligar", fitting: "Agendar prova" } as const;
const PLACES = Object.keys(CONTACT_PLACES) as ContactPlace[];

function useUpload(onDone: (url: string) => void, accept: string) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      hidden
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        const form = new FormData();
        form.set("file", file);
        const r = await uploadContactImageAction(form);
        setBusy(false);
        if (r.ok && r.url) onDone(r.url);
        else window.alert(r.message ?? "Erro ao carregar.");
      }}
    />
  );
  return { input, open: () => ref.current?.click(), busy };
}

function StoreCard({ s, onChange }: { s: StoreCardEdit; onChange: (p: Partial<StoreCardEdit>) => void }) {
  const up = useUpload((url) => onChange({ image: url }), "image/jpeg,image/png,image/webp");
  const bridal = s.action === "fitting" || s.label.includes("Bridal");
  return (
    <div className={k.box} style={{ gap: 12 }}>
      {up.input}
      <div className={c.row} style={{ gap: 12 }}>
        <button type="button" onClick={up.open} aria-label={`Trocar a foto de ${s.label}`} style={{ position: "relative", width: 72, height: 54, padding: 0, border: "1px solid var(--line)", overflow: "hidden", cursor: "pointer", background: "var(--surface)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- EN: small preview. PT: pré-visualização. */}
          {s.image ? <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="image" size={18} />}
        </button>
        <span className={c.small} style={{ flex: 1 }}>
          <b style={{ fontWeight: 500 }}>{s.label}</b>
          {up.busy && <span className={c.xsMuted}> · a carregar…</span>}
        </span>
        <FrameButton url={s.image} kind="cover" title={`foto de ${s.label}`} />
      </div>
      <div className={c.half}>
        <label className={c.field}>
          <span className={c.lbl}>Nome</span>
          <input className={c.input} value={s.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className={c.field}>
          <span className={c.lbl}>Morada</span>
          <input className={c.input} value={s.address} onChange={(e) => onChange({ address: e.target.value })} />
        </label>
      </div>
      <label className={c.field}>
        <span className={c.lbl}>Texto</span>
        <input className={c.input} value={s.text} onChange={(e) => onChange({ text: e.target.value })} />
      </label>
      <div className={c.half}>
        <label className={c.field}>
          <span className={c.lbl}>Telefone</span>
          <input className={c.input} inputMode="tel" value={s.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </label>
        <label className={c.field}>
          <span className={c.lbl}>Botão principal</span>
          <select className={c.select} value={s.action} onChange={(e) => onChange({ action: e.target.value as StoreCardEdit["action"] })}>
            {Object.entries(ACTIONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {s.action === "fitting" && <span className={c.xsMuted}>O botão “Agendar prova” leva aos termos e condições da Bridal.</span>}
      <label className={c.toggleRow}>
        <button type="button" role="switch" aria-checked={s.showHours} className={c.toggle} onClick={() => onChange({ showHours: !s.showHours })} />
        <span>{bridal ? "Mostrar horário (só por marcação: sem horário)" : "Mostrar horário"}</span>
      </label>
      {s.showHours && <input className={c.input} aria-label={`Horário de ${s.label}`} value={s.hours} onChange={(e) => onChange({ hours: e.target.value })} />}
      <label className={c.field}>
        <span className={c.lbl}>“Como chegar” · ligação do Google Maps</span>
        <input className={c.input} inputMode="url" placeholder="Vazio: procura o nome e a morada no Google Maps" value={s.mapsUrl} onChange={(e) => onChange({ mapsUrl: e.target.value })} />
      </label>
    </div>
  );
}

function ChannelRow({ ch, onChange, onRemove }: { ch: ContactChannel; onChange: (p: Partial<ContactChannel>) => void; onRemove: () => void }) {
  return (
    <div className={c.row} style={{ gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
      <span style={{ color: "var(--muted)", paddingTop: 10 }}>
        <Icon name={ch.kind === "email" ? "mail" : ch.whatsapp ? "whatsapp" : "phone"} size={18} />
      </span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span className={c.row} style={{ gap: 8 }}>
          <input className={c.input} style={{ flex: 1.3 }} aria-label={ch.kind === "email" ? "E-mail" : "Telefone"} inputMode={ch.kind === "email" ? "email" : "tel"} value={ch.value} onChange={(e) => onChange({ value: e.target.value })} />
          <input className={c.input} style={{ flex: 1 }} aria-label="Nome" value={ch.label} onChange={(e) => onChange({ label: e.target.value })} />
        </span>
        {ch.on ? (
          <span className={c.row} style={{ gap: 6, flexWrap: "wrap" }}>
            <span className={c.xsMuted}>Aparece em</span>
            {PLACES.filter((p) => ch.kind === "phone" || p === "contacts" || p === "footer").map((p) => (
              <button
                key={p}
                type="button"
                className={k.chip}
                data-on={ch.places.includes(p) || undefined}
                aria-pressed={ch.places.includes(p)}
                onClick={() => onChange({ places: ch.places.includes(p) ? ch.places.filter((x) => x !== p) : [...ch.places, p], ...(p === "buttons" && !ch.places.includes(p) ? { whatsapp: true } : {}) })}
              >
                {CONTACT_PLACES[p]}
              </button>
            ))}
            {ch.kind === "phone" && (
              <label className={c.check} style={{ marginLeft: 6 }}>
                <input type="checkbox" checked={!!ch.whatsapp} onChange={() => onChange({ whatsapp: !ch.whatsapp })} />
                WhatsApp
              </label>
            )}
          </span>
        ) : (
          <span className={c.row} style={{ gap: 6, color: "var(--danger, #b42318)" }}>
            <Icon name="alert" size={14} />
            <span className={c.small}>Não está activo: corrija ou desligue</span>
          </span>
        )}
      </span>
      <button type="button" role="switch" aria-checked={ch.on} aria-label={`Mostrar ${ch.value}`} className={c.toggle} style={{ marginTop: 8 }} onClick={() => onChange({ on: !ch.on })} />
      <button type="button" className={c.icoBtn} aria-label="Apagar" onClick={onRemove} style={{ marginTop: 4 }}>
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

function SocialRow({ s, onChange, onRemove, drag }: { s: SocialLink; onChange: (p: Partial<SocialLink>) => void; onRemove: () => void; drag: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void } }) {
  const up = useUpload((url) => onChange({ icon: url }), "image/png,image/webp");
  return (
    <tr draggable {...drag}>
      <td>
        <span style={{ cursor: "grab", color: "var(--muted)", display: "inline-flex" }}>
          <Icon name="grip" size={18} />
        </span>
      </td>
      <td>
        {up.input}
        <span className={c.row} style={{ gap: 8 }}>
          <SocialIcon link={s} size={18} />
          <button type="button" className={c.textBtn} onClick={up.open}>
            {up.busy ? "…" : "Trocar"}
          </button>
          {s.icon && (
            <button type="button" className={c.textBtn} onClick={() => onChange({ icon: "" })} aria-label="Voltar ao ícone padrão">
              <Icon name="close" size={12} />
            </button>
          )}
        </span>
      </td>
      <td>
        <select className={c.select} aria-label="Rede" value={s.network} onChange={(e) => onChange({ network: e.target.value as SocialNetwork })}>
          {Object.entries(SOCIAL_NETWORKS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input className={c.input} aria-label="Nome do perfil" value={s.handle} onChange={(e) => onChange({ handle: e.target.value })} />
      </td>
      <td>
        <input className={c.input} aria-label="Ligação" placeholder="instagram.com/…" value={s.url.replace(/^https:\/\//, "")} onChange={(e) => onChange({ url: e.target.value })} />
      </td>
      <td>
        <button type="button" role="switch" aria-checked={s.on} aria-label={`Mostrar ${s.handle}`} className={c.toggle} onClick={() => onChange({ on: !s.on })} />
      </td>
      <td>
        <button type="button" className={c.icoBtn} aria-label="Tirar" onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      </td>
    </tr>
  );
}

export function ContactsEditor(props: { stores: StoreCardEdit[]; contacts: ContactsSettings }) {
  const [storesState, setStores] = useState(props.stores);
  const [channels, setChannels] = useState(props.contacts.channels);
  const [social, setSocial] = useState(props.contacts.social);
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<number | null>(null);

  const touch = () => {
    setDirty(true);
    setRes(null);
  };
  const publish = () =>
    start(async () => {
      const r = await publishContactsAction({ stores: storesState, contacts: { channels, social } });
      setRes(r);
      if (r.ok) setDirty(false);
    });

  return (
    <>
      <div className={k.bar}>
        <span>
          {dirty && (
            <span className={c.st} data-tone="warn">
              Alterações por publicar
            </span>
          )}
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.message}
            </span>
          )}
        </span>
        <span className={`${c.row} ${mob.mfix}`}>
          <a href="/pt#contactos" target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
            <Icon name="eye" size={15} />
            <span className={mob.dOnly}>Pré-visualizar</span>
            <span className={mob.mOnly}>Ver</span>
          </a>
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending || !dirty} onClick={publish}>
            Publicar alterações
          </button>
        </span>
      </div>

      <div className={c.note} style={{ marginBottom: 24 }}>
        <Icon name="info" size={16} />
        <span>O que muda aqui aparece logo no site, sem o programador: barra do topo, Contacte-nos, Sobre nós e rodapé.</span>
      </div>

      <div className={k.cols} style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", alignItems: "start" }}>
        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Loja e showroom</h2>
          </div>
          <div className={k.body}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {storesState.map((s, i) => (
                <StoreCard
                  key={s.code}
                  s={s}
                  onChange={(p) => {
                    setStores(storesState.map((x, j) => (j === i ? { ...x, ...p } : x)));
                    touch();
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Telefones e e-mails</h2>
          </div>
          <div className={k.body} style={{ gap: 0 }}>
            {channels.map((ch, i) => (
              <ChannelRow
                key={i}
                ch={ch}
                onChange={(p) => {
                  setChannels(channels.map((x, j) => (j === i ? { ...x, ...p } : x)));
                  touch();
                }}
                onRemove={() => {
                  if (!window.confirm(`Apagar ${ch.value || "este contacto"}?`)) return;
                  setChannels(channels.filter((_, j) => j !== i));
                  touch();
                }}
              />
            ))}
            <div className={c.row} style={{ gap: 8, paddingTop: 14 }}>
              <button
                type="button"
                className={`${c.btn} ${c.xs}`}
                onClick={() => {
                  setChannels([...channels, { kind: "phone", value: "", label: "", places: ["contacts", "footer"], on: false }]);
                  touch();
                }}
              >
                <Icon name="plus" size={13} />
                Telefone
              </button>
              <button
                type="button"
                className={`${c.btn} ${c.xs}`}
                onClick={() => {
                  setChannels([...channels, { kind: "email", value: "", label: "", places: ["contacts", "footer"], on: false }]);
                  touch();
                }}
              >
                <Icon name="plus" size={13} />
                E-mail
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className={d3.panel} style={{ marginTop: 24 }}>
        <div className={d3.panelHead}>
          <h2>Redes sociais</h2>
          <span className={c.xsMuted}>Arraste para mudar a ordem</span>
        </div>
        <div className={k.body}>
          <table className={d3.table}>
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Ícone</th>
                <th>Rede</th>
                <th>Nome do perfil</th>
                <th>Ligação</th>
                <th>Visível</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {social.map((s, i) => (
                <SocialRow
                  key={i}
                  s={s}
                  drag={{
                    onDragStart: () => setDrag(i),
                    onDragOver: (e) => e.preventDefault(),
                    onDrop: () => {
                      if (drag === null || drag === i) return;
                      const next = [...social];
                      const [m] = next.splice(drag, 1);
                      next.splice(i, 0, m);
                      setSocial(next);
                      setDrag(null);
                      touch();
                    },
                  }}
                  onChange={(p) => {
                    setSocial(social.map((x, j) => (j === i ? { ...x, ...p } : x)));
                    touch();
                  }}
                  onRemove={() => {
                    if (!window.confirm(`Tirar ${s.handle || "esta rede"}?`)) return;
                    setSocial(social.filter((_, j) => j !== i));
                    touch();
                  }}
                />
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className={`${c.btn} ${c.sm}`}
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              setSocial([...social, { network: "instagram", icon: "", handle: "", url: "", on: false }]);
              touch();
            }}
          >
            <Icon name="plus" size={14} />
            Adicionar rede social
          </button>
          <div className={c.note}>
            <Icon name="info" size={16} />
            <span className={c.small}>
              Ícone: PNG ou WebP quadrado, mínimo 64 × 64 px. Sem ícone carregado, o site usa o ícone padrão da rede; numa rede nova, um ícone genérico (<Icon name="globe" size={12} />).
            </span>
          </div>
          <span className={c.lbl}>Pré-visualização · rodapé</span>
          <div className={c.row} style={{ gap: 18, flexWrap: "wrap", background: "#1C1917", color: "#FAF7F2", padding: "14px 18px", fontSize: 13 }}>
            {social
              .filter((s) => s.on)
              .map((s, i) => (
                <span key={i} className={c.row} style={{ gap: 6 }}>
                  <SocialIcon link={s} size={15} />
                  {s.handle || "[perfil]"}
                </span>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
