"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveSystemAction, type SettingsResult } from "@/app/gestao/actions/settings";
import { LOYALTY_LEVELS } from "@/data/help";
import { Icon } from "@/components/ui/Icon";
import type { SystemSettings } from "@/server/admin/system";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";
import mob from "./Mobile.module.css";

/**
 * EN: "Gestão · Definições" of design V3-G-Definicoes (only the Superadministrador changes them). PT: Definições do V3.
 */

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={c.toggleRow}>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={c.toggle} onClick={() => onChange(!on)} />
      <span>{label}</span>
    </label>
  );
}

/** EN: A whole number with a unit after it ("50 %", "30 dias"). PT: Um número inteiro com a unidade. */
function Num({ label, value, unit, onChange, min = 0 }: { label: string; value: number; unit?: string; onChange: (v: number) => void; min?: number }) {
  return (
    <label className={c.field}>
      <span className={c.lbl}>{label}</span>
      <span className={c.row} style={{ gap: 8 }}>
        <input className={`${c.input} ${c.num}`} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.max(min, Number(e.target.value.replace(/\D/g, "")) || 0))} />
        {unit && <span className={c.xsMuted}>{unit}</span>}
      </span>
    </label>
  );
}

export function SystemEditor(props: { settings: SystemSettings; editable: boolean }) {
  const [d, setD] = useState(props.settings);
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<SystemSettings>) => {
    setD((x) => ({ ...x, ...p }));
    setDirty(true);
    setRes(null);
  };
  const r = d.reservations;
  const setR = (p: Partial<SystemSettings["reservations"]>) => set({ reservations: { ...r, ...p } });
  const l = d.loyalty;
  const setL = (p: Partial<SystemSettings["loyalty"]>) => set({ loyalty: { ...l, ...p } });
  const setLevel = (i: number, p: Partial<SystemSettings["loyalty"]["levels"][number]>) => setL({ levels: l.levels.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return (
    <fieldset disabled={!props.editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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
        <span className={mob.mfix}>
          <button
            type="button"
            className={`${c.btnPrimary} ${c.sm}`}
            disabled={pending || !dirty}
            onClick={() =>
              start(async () => {
                const out = await saveSystemAction(d);
                setRes(out);
                if (out.ok) setDirty(false);
              })
            }
          >
            Guardar alterações
          </button>
        </span>
      </div>

      <div className={k.cols} style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Reservas</h2>
            </div>
            <div className={k.body}>
              <div className={c.three}>
                <Num label="Sinal da reserva" value={r.depositPct} unit="%" min={1} onChange={(v) => setR({ depositPct: Math.min(100, v) })} />
                <Num label="Prazo · colecções e ocasiões" value={r.days} unit="dias" min={1} onChange={(v) => setR({ days: v })} />
                <Num label="Prazo · noivas e Bridal" value={r.bridalDays} unit="dias" min={1} onChange={(v) => setR({ bridalDays: v })} />
              </div>
              <div className={c.three}>
                <Num label="Avisar antes do fim" value={r.remindDays} unit="dias" onChange={(v) => setR({ remindDays: v })} />
                <label className={c.field}>
                  <span className={c.lbl}>Prolongar · Eterna / Bridal</span>
                  <span className={c.row} style={{ gap: 6 }}>
                    <span className={c.xsMuted}>+</span>
                    <input className={`${c.input} ${c.num}`} style={{ width: 64 }} inputMode="numeric" aria-label="Prolongar Eterna (dias)" value={String(r.extendDays)} onChange={(e) => setR({ extendDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                    <span className={c.xsMuted}>/ +</span>
                    <input className={`${c.input} ${c.num}`} style={{ width: 64 }} inputMode="numeric" aria-label="Prolongar Bridal (dias)" value={String(r.bridalExtendDays)} onChange={(e) => setR({ bridalExtendDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                    <span className={c.xsMuted}>dias</span>
                  </span>
                </label>
                <Num label="Prolongamentos por reserva" value={r.maxExtensions} onChange={(v) => setR({ maxExtensions: v })} />
              </div>
              <Toggle on={r.allowExtend} onChange={(v) => setR({ allowExtend: v })} label="Permitir prolongar (só a equipa)" />
              <Toggle on={r.askMoreTime} onChange={(v) => setR({ askMoreTime: v })} label="Botão “Pedir mais tempo” na conta e na confirmação da cliente" />
              <span className={c.xsMuted} style={{ paddingLeft: 56, marginTop: -6 }}>
                Desligado, o botão desaparece do site e os prazos não se estendem a pedido.
              </span>
              <Toggle on={r.showReserved} onChange={(v) => setR({ showReserved: v })} label="Mostrar peças reservadas no site, com o selo “Reservada”" />
              <Toggle on={r.notifyStaff} onChange={(v) => setR({ notifyStaff: v })} label="Avisar a gestão por WhatsApp a cada nova reserva" />
              <label className={c.field}>
                <span className={c.lbl}>Mensagem de aviso à cliente</span>
                <textarea className={c.input} rows={3} value={r.message} onChange={(e) => setR({ message: e.target.value })} />
                <span className={c.help}>{"{nome}, {código}, {data} e {loja} trocam-se pelos dados da reserva."}</span>
              </label>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Provas · Bridal</h2>
            </div>
            <div className={k.body}>
              <Toggle on={d.fittings} onChange={(v) => set({ fittings: v })} label="Provas ligadas · só Eterna Bridal (Loja 22)" />
              <div className={c.note}>
                <Icon name="info" size={16} />
                <span className={c.small} style={{ flex: 1 }}>
                  Pacotes (Satin, Silk, Cashmere), valores, vestidos extra, dias e horas editam-se em <b style={{ fontWeight: 500 }}>Provas · Bridal → Pacotes e regras</b>.
                </span>
                <Link href="/gestao/provas" className={`${c.btn} ${c.xs}`}>
                  Abrir
                </Link>
              </div>
              <span className={c.xsMuted}>“Pode ir a prova” define-se em cada produto e por tipo de peça (ligado por defeito nos vestidos de noiva).</span>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Preço nos cartões</h2>
            </div>
            <div className={k.body}>
              <Toggle on={d.cardPrice} onChange={(v) => set({ cardPrice: v })} label="Mostrar o preço nos cartões" />
              <Toggle on={d.cardPriceCampaigns} onChange={(v) => set({ cardPriceCampaigns: v })} label="Excepção: as campanhas mostram sempre o preço" />
              <span className={c.xsMuted}>
                Vale para todos os cartões do site (página inicial, colecções, categorias, pesquisa e favoritos). Desligado, o cartão mostra a referência, as cores e os tamanhos. A página da peça, o carrinho e o checkout mostram sempre o preço.
              </span>
            </div>
          </section>
        </div>

        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Programa de fidelidade</h2>
            </div>
            <div className={k.body}>
              <Toggle on={l.on} onChange={(v) => setL({ on: v })} label="Programa de fidelidade ligado" />
              <label className={c.field} style={{ maxWidth: 280 }}>
                <span className={c.lbl}>1 ponto =</span>
                <span className={c.row} style={{ gap: 8 }}>
                  <input className={`${c.input} ${c.num}`} inputMode="numeric" value={String(l.mtPerPoint)} onChange={(e) => setL({ mtPerPoint: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
                  <span className={c.xsMuted}>MT</span>
                </span>
              </label>
              <table className={d3.table}>
                <thead>
                  <tr>
                    <th>Nível</th>
                    <th>De</th>
                    <th>Até</th>
                    <th>Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {l.levels.map((x, i) => {
                    const base = LOYALTY_LEVELS.find((b) => b.key === x.key)!;
                    const last = i === l.levels.length - 1;
                    return (
                      <tr key={x.key}>
                        <td>
                          <span className={c.row} style={{ gap: 8 }}>
                            <span style={{ color: base.color, display: "inline-flex" }}>
                              <Icon name={base.icon} size={18} />
                            </span>
                            {base.name.pt}
                          </span>
                        </td>
                        <td>
                          <input
                            className={`${c.input} ${c.num}`}
                            style={{ width: 90 }}
                            inputMode="numeric"
                            aria-label={`${base.name.pt} · de`}
                            value={String(x.min)}
                            readOnly={i === 0}
                            onChange={(e) => {
                              const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                              // EN: The previous level ends just before. PT: O nível anterior acaba logo antes.
                              setL({ levels: l.levels.map((y, j) => (j === i ? { ...y, min: v } : j === i - 1 ? { ...y, max: Math.max(y.min, v - 1) } : y)) });
                            }}
                          />
                        </td>
                        <td>{last ? <input className={`${c.input} ${c.num}`} style={{ width: 90 }} value="—" readOnly aria-label={`${base.name.pt} · até`} /> : <input className={`${c.input} ${c.num}`} style={{ width: 90 }} value={String(x.max ?? "")} readOnly aria-label={`${base.name.pt} · até`} />}</td>
                        <td>
                          <span className={c.row} style={{ gap: 6 }}>
                            <input
                              className={`${c.input} ${c.num}`}
                              style={{ width: 70 }}
                              inputMode="numeric"
                              aria-label={`${base.name.pt} · desconto`}
                              value={String(x.pct)}
                              onChange={(e) => setLevel(i, { pct: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                            />
                            <span className={c.xsMuted}>%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <span className={c.xsMuted}>“Até” acompanha o “De” do nível seguinte.</span>
              <Toggle on={l.storePoints} onChange={(v) => setL({ storePoints: v })} label="Compras na loja dão pontos (associadas pelo telefone)" />
              <Toggle on={l.onReservations} onChange={(v) => setL({ onReservations: v })} label="Desconto aplica-se a reservas e a vestidos de noiva" />
              <div className={c.field}>
                <span className={c.lbl}>Com saldos e campanhas</span>
                <div className={c.seg}>
                  <button type="button" aria-pressed={l.withSales === "max"} onClick={() => setL({ withSales: "max" })}>
                    Aplica-se o maior
                  </button>
                  <button type="button" aria-pressed={l.withSales === "stack"} onClick={() => setL({ withSales: "stack" })}>
                    Juntam-se
                  </button>
                </div>
              </div>
              <span className={c.xsMuted}>Revisão automática a 1 de janeiro com as compras do ano anterior.</span>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Módulo de entregas</h2>
            </div>
            <div className={k.body}>
              <Toggle on={d.delivery} onChange={(v) => set({ delivery: v })} label="Entregas ao domicílio" />
              <div className={c.note}>
                <Icon name="info" size={16} />
                <span className={c.small}>Desligado: o site só mostra “Levantar na loja”; a gestão esconde Entregas, a app do entregador, zonas, comissões e o pagamento na entrega.</span>
              </div>
              <label className={c.field} style={{ maxWidth: 420 }}>
                <span className={c.lbl}>Fornecedor de mapas</span>
                <select className={c.select} value={d.maps} onChange={(e) => set({ maps: e.target.value as SystemSettings["maps"] })}>
                  <option value="osm">OpenStreetMap · testes (grátis)</option>
                  <option value="google">Google Maps · produção (recomendado)</option>
                </select>
              </label>
              <span className={c.xsMuted}>Com qualquer fornecedor: pino arrastável, “A minha localização” e “Ponto de referência”.</span>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Assistente (chat)</h2>
            </div>
            <div className={k.body}>
              <Toggle on={d.assistant.site} onChange={(v) => set({ assistant: { ...d.assistant, site: v } })} label="Chat no site" />
              <Toggle on={d.assistant.whatsapp} onChange={(v) => set({ assistant: { ...d.assistant, whatsapp: v } })} label="Assistente no WhatsApp" />
              <span className={c.xsMuted}>Desligado, o botão do chat sai do site e as mensagens do WhatsApp vão directas à equipa. As respostas ficam guardadas.</span>
              <Link href="/gestao/assistente" className={`${c.btn} ${c.xs}`} style={{ alignSelf: "flex-start" }}>
                Abrir Assistente
              </Link>
            </div>
          </section>
        </div>
      </div>

      <div className={c.note} style={{ marginTop: 24 }}>
        <Icon name="info" size={16} />
        <span className={c.small} style={{ flex: 1 }}>
          A loja, o showroom, os telefones, os e-mails e as redes sociais editam-se em <b style={{ fontWeight: 500 }}>Site → Contactos e redes sociais</b>.
        </span>
        <Link href="/gestao/contactos" className={`${c.btn} ${c.xs}`}>
          Abrir
        </Link>
      </div>
    </fieldset>
  );
}
