"use client";

import { useState, useTransition } from "react";
import { closeChatAction, replyChatAction, saveAssistantAction } from "@/app/gestao/actions/assistant";
import { TOPIC_SOURCES, type AssistantSettings, type Topic, type TopicKind } from "@/data/assistant";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";

/**
 * EN: "Gestão · Assistente: chat e WhatsApp" of design V3-G-Assistente. PT: Assistente do V3.
 */

type Msg = { id: string; from: "customer" | "bot" | "team"; text: string; at: string };
export interface InboxItem {
  id: string;
  channel: "site" | "whatsapp";
  who: string;
  at: string;
  last: string;
  messages: Msg[];
}
interface Stats {
  total: number;
  site: number;
  whatsapp: number;
  handed: number;
  pending: number;
  resolvedPct: number;
  waSent: number;
}

const KIND_LABEL: Record<TopicKind, string> = {
  price: "Preço da peça (automático)",
  stock: "Tamanhos e stock (automático)",
  reservations: "Reservas (automático)",
  payments: "Pagamentos (automático)",
  fittings: "Provas · Bridal (automático)",
  hours: "Horário e morada (automático)",
  order: "Estado da encomenda (automático)",
  exchanges: "Texto fixo",
  deliveries: "Entregas (automático)",
  custom: "Texto fixo",
};
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={c.toggle} onClick={() => onChange(!on)} />;
}

export function AssistantEditor(props: { settings: AssistantSettings; stats: Stats; inbox: InboxItem[]; waNumber: string; waReady: boolean; delivery: boolean }) {
  const [s, setS] = useState(props.settings);
  const [inbox, setInbox] = useState(props.inbox);
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<number | null>(null);
  const [reply, setReply] = useState<InboxItem | null>(null);
  const [text, setText] = useState("");

  const patch = (p: Partial<AssistantSettings>) => {
    setS((x) => ({ ...x, ...p }));
    setDirty(true);
    setRes(null);
  };
  const setTopic = (i: number, p: Partial<Topic>) => patch({ topics: s.topics.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const save = (next = s) =>
    start(async () => {
      const r = await saveAssistantAction(next);
      setRes(r);
      if (r.ok) setDirty(false);
    });
  // EN: The two main switches change the site at once ("Muda logo no site"). PT: Os dois interruptores mudam logo.
  const flip = (key: "site" | "whatsapp") => {
    const next = { ...s, [key]: !s[key] };
    setS(next);
    save(next);
  };
  const t = edit !== null ? s.topics[edit] : null;
  const month = MONTHS[new Date().getMonth()];
  const freePct = Math.min(100, Math.round((props.stats.waSent / 1000) * 100));

  return (
    <>
      <div className={k.bar}>
        <span>
          {dirty && (
            <span className={c.st} data-tone="warn">
              Alterações por guardar
            </span>
          )}
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.message}
            </span>
          )}
        </span>
        <span className={c.row}>
          <a href="/pt" target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
            <Icon name="eye" size={15} />
            Experimentar
          </a>
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending || !dirty} onClick={() => save()}>
            Guardar alterações
          </button>
        </span>
      </div>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Ligar e desligar o assistente</h2>
          <span className={c.xsMuted}>Só o Administrador e o Superadministrador</span>
        </div>
        <div className={k.body}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {(
              [
                ["site", "Chat no site", s.site ? "O botão do chat aparece em todas as páginas e responde sozinho." : "O botão do chat desaparece do site. As clientes continuam a ter o WhatsApp e o telefone em Contacte-nos.", "Todas as páginas da loja, no computador e no telemóvel."],
                ["whatsapp", "Assistente no WhatsApp", s.whatsapp ? "Responde no número da loja e passa à equipa quando é preciso." : "As mensagens chegam directamente à equipa, na app WhatsApp Business, como hoje.", `Número da loja · ${props.waNumber}.`],
              ] as const
            ).map(([key, name, sub, foot]) => (
              <div key={key} className={k.box} style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                <Toggle on={s[key]} onChange={() => flip(key)} label={name} />
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className={c.small}>
                    <b style={{ fontWeight: 500 }}>{name}</b> · <span style={{ color: s[key] ? "var(--success)" : "var(--muted)" }}>{s[key] ? "Ligado" : "Desligado"}</span>
                  </span>
                  <span className={c.small}>{sub}</span>
                  <span className={c.xsMuted}>{foot}</span>
                </span>
              </div>
            ))}
          </div>
          <span className={c.xsMuted}>Muda logo no site, sem programador, e fica no registo de auditoria. As perguntas e respostas ficam guardadas: ao voltar a ligar, o assistente responde como antes.</span>
        </div>
      </section>

      <div className={d3.kpis} style={{ margin: "24px 0" }}>
        <div className={d3.kpi}>
          <span className={c.lbl}>Conversas · {month}</span>
          <b>{props.stats.total}</b>
          <span className={c.xsMuted}>
            Site {props.stats.site} · WhatsApp {props.stats.whatsapp}
          </span>
        </div>
        <div className={d3.kpi}>
          <span className={c.lbl}>Resolvidas pelo assistente</span>
          <b>{props.stats.resolvedPct}%</b>
          <span className={c.xsMuted}>Sem precisar da equipa</span>
        </div>
        <div className={d3.kpi}>
          <span className={c.lbl}>Passadas à equipa</span>
          <b>{props.stats.handed}</b>
          <span className={c.xsMuted}>{inbox.length} por responder</span>
        </div>
        <div className={d3.kpi}>
          <span className={c.lbl}>WhatsApp · mensagens grátis</span>
          <b>{props.stats.waSent} / 1 000</b>
          <span className={c.xsMuted}>Este mês, regra da Meta</span>
        </div>
      </div>

      <div className={k.cols} style={{ gridTemplateColumns: "minmax(0, 1fr) 380px", alignItems: "start" }}>
        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Perguntas e respostas</h2>
          </div>
          <div className={k.body}>
            <table className={d3.table}>
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>Palavras que o activam</th>
                  <th>Resposta</th>
                  <th>Canais</th>
                  <th>Ligado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.topics.map((x, i) => {
                  const off = x.kind === "deliveries" && !props.delivery;
                  return (
                    <tr key={x.id}>
                      <td>
                        <b style={{ fontWeight: 500 }}>{x.name}</b>
                      </td>
                      <td className={c.small}>{x.keywords.join(" · ")}</td>
                      <td className={c.xsMuted}>{x.kind === "custom" || x.kind === "exchanges" ? x.text.slice(0, 60) + (x.text.length > 60 ? "…" : "") : off ? TOPIC_SOURCES.deliveries : TOPIC_SOURCES[x.kind]}</td>
                      <td>
                        <span className={c.row} style={{ gap: 4 }}>
                          {x.site && !off && <span className={c.tag}>Site</span>}
                          {x.whatsapp && !off && <span className={c.tag}>WhatsApp</span>}
                        </span>
                      </td>
                      <td>
                        <Toggle on={x.on && !off} onChange={(v) => setTopic(i, { on: v })} label={`Ligar ${x.name}`} />
                      </td>
                      <td>
                        <button type="button" className={c.textBtn} onClick={() => setEdit(i)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              className={`${c.btn} ${c.sm}`}
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                patch({ topics: [...s.topics, { id: `p-${Date.now().toString(36)}`, name: "Nova pergunta", keywords: [], kind: "custom", text: "", site: true, whatsapp: true, on: true }] });
                setEdit(s.topics.length);
              }}
            >
              <Icon name="plus" size={14} />
              Nova pergunta
            </button>
            <div className={c.note}>
              <Icon name="info" size={16} />
              <span className={c.small}>
                As respostas usam os dados do site: quando muda um preço, um pacote ou um horário na gestão, o assistente já responde com o novo. Não usa inteligência artificial paga: não há custo por resposta.
              </span>
            </div>
          </div>
        </section>

        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Para a equipa</h2>
              {inbox.length > 0 && <span className={d3.count}>{inbox.length}</span>}
            </div>
            <div className={k.body} style={{ gap: 0 }}>
              {inbox.length === 0 && <span className={c.small} style={{ color: "var(--muted)" }}>Nenhuma conversa à espera.</span>}
              {inbox.map((x) => (
                <div key={x.id} className={c.row} style={{ gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ width: 36, height: 36, borderRadius: 999, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={x.channel === "whatsapp" ? "whatsapp" : "monitor"} size={16} />
                  </span>
                  <span className={c.small} style={{ flex: 1 }}>
                    <b style={{ fontWeight: 500 }}>
                      {x.who} · {ago(x.at)}
                    </b>
                    <br />
                    <span className={c.xsMuted}>{x.last}</span>
                  </span>
                  <button
                    type="button"
                    className={`${c.btn} ${c.xs}`}
                    onClick={() => {
                      setReply(x);
                      setText("");
                    }}
                  >
                    {x.channel === "whatsapp" && <Icon name="whatsapp" size={13} />}
                    Responder
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Passar a uma pessoa</h2>
            </div>
            <div className={k.body}>
              <label className={c.toggleRow}>
                <Toggle on={s.alwaysHuman} onChange={(v) => patch({ alwaysHuman: v })} label="Mostrar sempre Falar com uma pessoa" />
                <span>Mostrar sempre “Falar com uma pessoa”</span>
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Passar à equipa depois de</span>
                <select className={c.select} style={{ maxWidth: 240 }} value={s.handoffAfter} onChange={(e) => patch({ handoffAfter: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "resposta" : "respostas"} sem resolver
                    </option>
                  ))}
                </select>
              </label>
              <div className={c.half}>
                <label className={c.field}>
                  <span className={c.lbl}>Equipa · seg–sex</span>
                  <input className={c.input} value={s.teamWeek} onChange={(e) => patch({ teamWeek: e.target.value })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Equipa · sábado</span>
                  <input className={c.input} value={s.teamSat} onChange={(e) => patch({ teamSat: e.target.value })} />
                </label>
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Fora de horas</span>
                <textarea className={c.input} rows={3} value={s.offHours} onChange={(e) => patch({ offHours: e.target.value })} />
              </label>
              <label className={c.toggleRow}>
                <Toggle on={s.waSilence} onChange={(v) => patch({ waSilence: v })} label="Calar o assistente 24 horas" />
                <span>No WhatsApp, quando a equipa responde, o assistente fica calado 24 horas</span>
              </label>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Canais</h2>
            </div>
            <div className={k.body}>
              <span className={c.small}>
                <b style={{ fontWeight: 500 }}>WhatsApp Business</b> · {props.waNumber}{" "}
                <span className={c.st} data-tone={props.waReady ? "ok" : "warn"}>
                  {props.waReady ? "Ligado" : "Por ligar"}
                </span>
              </span>
              <span className={c.xsMuted}>Coexistência: o número continua na app WhatsApp Business do telemóvel da loja; o assistente responde pelo mesmo número.</span>
              {!props.waReady && <span className={c.xsMuted}>Para ligar, o programador põe as chaves da Meta (WhatsApp Cloud API) nas definições do servidor. Até lá, as respostas da equipa abrem a app WhatsApp.</span>}
              <span className={c.lbl}>Mensagens grátis da Meta este mês</span>
              <span className={c.miniBar}>
                <span style={{ width: `${freePct}%` }} />
              </span>
              <span className={c.xsMuted}>{props.stats.waSent} de 1 000. Depois, a Meta cobra cada resposta (cêntimos de dólar).</span>
            </div>
          </section>
        </div>
      </div>

      {t && edit !== null && (
        <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <div className={c.modal} role="dialog" aria-modal="true" aria-label={t.name} style={{ width: 640 }}>
            <div className={c.panelH}>
              <h3>{t.name}</h3>
              <button type="button" className={c.icoBtn} onClick={() => setEdit(null)} aria-label="Fechar">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className={c.panelB}>
              <label className={c.field}>
                <span className={c.lbl}>Tema</span>
                <input className={c.input} value={t.name} onChange={(e) => setTopic(edit, { name: e.target.value })} />
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Palavras que o activam</span>
                <input
                  className={c.input}
                  value={t.keywords.join(" · ")}
                  placeholder="ajuste · bainha · à medida"
                  onChange={(e) =>
                    setTopic(edit, {
                      keywords: e.target.value
                        .split(/[·,;]/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <span className={c.help}>Separe com “·” ou vírgulas. Palavras curtas (“M”, “38”) contam só como palavra inteira.</span>
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Resposta</span>
                <select className={c.select} value={t.kind} onChange={(e) => setTopic(edit, { kind: e.target.value as TopicKind })}>
                  {Object.entries(KIND_LABEL)
                    .filter(([v]) => v !== "exchanges" || t.kind === "exchanges")
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                </select>
                {t.kind !== "custom" && t.kind !== "exchanges" && <span className={c.help}>{TOPIC_SOURCES[t.kind]}.</span>}
              </label>
              {(t.kind === "custom" || t.kind === "exchanges") && (
                <label className={c.field}>
                  <span className={c.lbl}>Texto da resposta</span>
                  <textarea className={c.input} rows={4} value={t.text} onChange={(e) => setTopic(edit, { text: e.target.value })} />
                </label>
              )}
              <div className={c.row} style={{ gap: 18 }}>
                <label className={c.check}>
                  <input type="checkbox" checked={t.site} onChange={() => setTopic(edit, { site: !t.site })} />
                  Site
                </label>
                <label className={c.check}>
                  <input type="checkbox" checked={t.whatsapp} onChange={() => setTopic(edit, { whatsapp: !t.whatsapp })} />
                  WhatsApp
                </label>
              </div>
              <div className={c.end} style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className={c.textBtn}
                  data-tone="bad"
                  onClick={() => {
                    if (!window.confirm(`Apagar a pergunta ${t.name}?`)) return;
                    patch({ topics: s.topics.filter((_, j) => j !== edit) });
                    setEdit(null);
                  }}
                >
                  Apagar pergunta
                </button>
                <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={() => setEdit(null)}>
                  Feito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reply && (
        <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && setReply(null)}>
          <div className={c.modal} role="dialog" aria-modal="true" aria-label={`Responder · ${reply.who}`} style={{ width: 560 }}>
            <div className={c.panelH}>
              <h3>{reply.who}</h3>
              <button type="button" className={c.icoBtn} onClick={() => setReply(null)} aria-label="Fechar">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className={c.panelB}>
              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column-reverse", gap: 8, background: "var(--surface)", padding: 12 }}>
                {[...reply.messages].reverse().map((m) => (
                  <div
                    key={m.id}
                    className={c.small}
                    style={{
                      alignSelf: m.from === "customer" ? "flex-start" : "flex-end",
                      maxWidth: "85%",
                      padding: "8px 11px",
                      borderRadius: 12,
                      background: m.from === "customer" ? "var(--raised, #fff)" : m.from === "team" ? "var(--contrast)" : "transparent",
                      color: m.from === "team" ? "var(--on-contrast)" : undefined,
                      border: m.from === "bot" ? "1px dashed var(--line)" : "1px solid var(--line)",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {m.from === "bot" && <span className={c.xsMuted}>Assistente · </span>}
                    {m.text}
                  </div>
                ))}
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Resposta</span>
                <textarea className={c.input} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                <span className={c.help}>{reply.channel === "whatsapp" ? (props.waReady ? "Vai pelo WhatsApp da loja." : "Abre a app WhatsApp com o texto, para enviar.") : "Aparece na janela do chat da cliente."}</span>
              </label>
              <div className={c.end} style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className={c.textBtn}
                  onClick={() =>
                    start(async () => {
                      const r = await closeChatAction(reply.id);
                      setRes(r);
                      if (r.ok) {
                        setInbox(inbox.filter((x) => x.id !== reply.id));
                        setReply(null);
                      }
                    })
                  }
                >
                  Fechar sem responder
                </button>
                <button
                  type="button"
                  className={`${c.btnPrimary} ${c.sm}`}
                  disabled={pending || !text.trim()}
                  onClick={() =>
                    start(async () => {
                      const r = await replyChatAction(reply.id, text);
                      setRes(r);
                      if (r.ok) {
                        if ("whatsappUrl" in r && r.whatsappUrl) window.open(r.whatsappUrl, "_blank", "noopener");
                        setInbox(inbox.filter((x) => x.id !== reply.id));
                        setReply(null);
                      }
                    })
                  }
                >
                  Responder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
