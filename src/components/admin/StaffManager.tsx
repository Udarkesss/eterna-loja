"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createStaffAction,
  deleteStaffAction,
  endSessionsAction,
  resetStaffPasswordAction,
  suspendStaffAction,
  updateStaffAction,
  type StaffResult,
} from "@/app/gestao/actions/staff";
import { Icon } from "@/components/ui/Icon";
import s from "./admin.module.css";

/**
 * EN: Team table + "Criar utilizador" (design "Gestão · A1"). The temporary password is shown once, with the
 *     WhatsApp message ready to send; it is never stored in clear text.
 * PT: Tabela da equipa + "Criar utilizador". A palavra-passe temporária aparece uma vez, com a mensagem de WhatsApp
 *     pronta a enviar; nunca fica guardada em texto.
 */

const ROLE_LABEL: Record<string, string> = { super: "Superadministrador", admin: "Administrador", gestor: "Gestor de loja", atendedor: "Atendedor", entregador: "Entregador" };
const STATUS: Record<string, [string, string, string]> = {
  active: ["Activo", "ok", "✓"],
  suspended: ["Suspenso", "", "–"],
  temp_password: ["Palavra-passe temporária", "warn", "◷"],
};
const AVATAR: Record<string, string> = { super: "#1C1917", admin: "#C8A97E", gestor: "#E9D8CF", atendedor: "#F3ECE6", entregador: "#8E9A86" };

interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  roleKey: string;
  roleName: string;
  storeCodes: string[];
  status: string;
  last: string;
  locked: boolean;
  can: boolean;
}

export function StaffManager({ me, users, allowedRoles, stores }: { me: { id: string; roleKey: string; storeCodes: string[] }; users: User[]; allowedRoles: string[]; stores: { code: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<StaffResult | null>(null);
  const [filter, setFilter] = useState({ q: "", role: "todos", store: "todas" });
  const [editing, setEditing] = useState<string | null>(null);
  const defaultRole = allowedRoles[allowedRoles.length - 1] ?? "atendedor";
  const blank = { role: defaultRole, name: "", username: "", phone: "", email: "", stores: me.roleKey === "gestor" ? me.storeCodes : [stores[0]?.code].filter(Boolean) as string[], vehicleType: "Mota", vehiclePlate: "", sendWhatsapp: true, sendEmail: true };
  const [f, setF] = useState(blank);

  const run = (fn: () => Promise<StaffResult>) => start(async () => setResult(await fn()));
  const visible = useMemo(() => {
    const q = filter.q.toLowerCase().replace(/\s/g, "");
    return users
      .filter((u) => filter.role === "todos" || u.roleKey === filter.role)
      .filter((u) => filter.store === "todas" || u.storeCodes.includes(filter.store))
      .filter((u) => !q || `${u.name}${u.username}${u.phone}`.toLowerCase().replace(/\s/g, "").includes(q));
  }, [users, filter]);

  const initials = (n: string) => n.replace(/[[\]]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {result?.message && (
        <div className={result.ok ? s.notice : s.error} style={{ flexDirection: "column", gap: 8 }}>
          <span>{result.message}</span>
          {result.password && (
            <span>
              Palavra-passe temporária: <strong style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 15 }}>{result.password}</strong> — só aparece agora.
            </span>
          )}
          {result.text && <div className={s.pre}>{result.text}</div>}
          {result.whatsappUrl && (
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.small}`} style={{ alignSelf: "flex-start" }}>
              <Icon name="whatsapp" size={14} />
              Enviar no WhatsApp
            </a>
          )}
        </div>
      )}

      <div className={s.filters}>
        <label className={s.label} style={{ flex: "1 1 240px" }}>
          Procurar
          <input className={s.input} type="search" placeholder="Nome, utilizador ou número" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </label>
        <label className={s.label}>
          Papel
          <select className={s.select} value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}>
            <option value="todos">Todos</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={s.label}>
          Loja
          <select className={s.select} value={filter.store} onChange={(e) => setFilter({ ...filter, store: e.target.value })}>
            <option value="todas">Todas</option>
            {stores.map((st) => (
              <option key={st.code} value={st.code}>
                Loja {st.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.split}>
        <section className={s.cardFlush}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>Equipa</h2>
            <span className={s.muted}>{visible.length} pessoas</span>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Papel e lojas</th>
                <th>Estado</th>
                <th>Acções</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const st = STATUS[u.status] ?? STATUS.active;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className={s.product}>
                        <span className={s.avatar} style={{ background: AVATAR[u.roleKey], color: u.roleKey === "super" ? "#FAF7F2" : "#1C1917" }}>
                          {initials(u.name)}
                        </span>
                        <span className={s.two}>
                          <span className={s.strong}>{u.name}</span>
                          <span className={s.muted}>
                            @{u.username} · {u.phone}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={s.two}>
                        <span>{u.roleName}</span>
                        <span className={s.muted}>{["super", "admin"].includes(u.roleKey) ? "Todas" : u.storeCodes.map((c) => `Loja ${c}`).join(" · ") || "—"}</span>
                      </span>
                    </td>
                    <td>
                      <span className={s.two}>
                        <span className={s.chip} data-tone={st[1] || undefined}>
                          {st[2]} {st[0]}
                        </span>
                        <span className={s.muted}>{u.locked ? "Bloqueado 15 min" : u.last}</span>
                      </span>
                    </td>
                    <td>
                      {u.can ? (
                        <span className={s.actions} style={{ gap: 6 }}>
                          <button className={`${s.btnOutline} ${s.small}`} onClick={() => setEditing(editing === u.id ? null : u.id)}>
                            Editar
                          </button>
                          <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run(() => suspendStaffAction(u.id, u.status !== "suspended"))}>
                            {u.status === "suspended" ? "Reactivar" : "Suspender"}
                          </button>
                          <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run(() => resetStaffPasswordAction(u.id))}>
                            Nova palavra-passe
                          </button>
                          <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run(() => endSessionsAction(u.id))}>
                            Terminar sessões
                          </button>
                          {me.roleKey === "super" && u.id !== me.id && (
                            <button
                              className={`${s.btnDanger} ${s.small}`}
                              disabled={pending}
                              onClick={() => window.confirm(`Apagar ${u.name}? Esta acção fica no registo de auditoria.`) && run(() => deleteStaffAction(u.id))}
                            >
                              Apagar
                            </button>
                          )}
                          {editing === u.id && <EditRow user={u} stores={stores} pending={pending} onSave={(input) => run(async () => { const r = await updateStaffAction(u.id, input); if (r.ok) setEditing(null); return r; })} />}
                        </span>
                      ) : (
                        <span className={s.muted}>{u.id === me.id ? "É a sua conta" : "Sem permissão"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {allowedRoles.length > 0 && (
          <section className={s.card}>
            <h2 className={s.h2}>Criar utilizador</h2>
            <label className={s.label}>
              Papel
              <select className={s.select} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {[...allowedRoles].reverse().map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <span className={s.hint}>
                {me.roleKey === "gestor"
                  ? "Como Gestor, só pode criar Atendedores e Entregadores das suas lojas."
                  : me.roleKey === "admin"
                    ? "Administradores e Superadministradores são criados só pelo Superadministrador."
                    : "Pode criar qualquer papel."}
              </span>
            </label>
            <label className={s.label}>
              Nome completo
              <input className={s.input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e apelido" />
            </label>
            <div className={s.row2}>
              <label className={s.label}>
                Nome de utilizador
                <input className={s.input} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, ".") })} placeholder="ex.: ana.m" />
              </label>
              <label className={s.label}>
                WhatsApp
                <input className={s.input} type="tel" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="84 123 4567" />
              </label>
            </div>
            <label className={s.label}>
              E-mail (opcional)
              <input className={s.input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome@eterna.co.mz" />
            </label>
            {!["super", "admin"].includes(f.role) && (
              <fieldset className={s.fieldset}>
                <legend className={s.legend}>Lojas</legend>
                <div className={s.checks}>
                  {stores
                    .filter((st) => me.roleKey !== "gestor" || me.storeCodes.includes(st.code))
                    .map((st) => (
                      <label key={st.code}>
                        <input type="checkbox" checked={f.stores.includes(st.code)} onChange={() => setF({ ...f, stores: f.stores.includes(st.code) ? f.stores.filter((c) => c !== st.code) : [...f.stores, st.code] })} />
                        Loja {st.code}
                        {st.code === "22" ? " · Bridal" : ""}
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
            {f.role === "entregador" && (
              <div className={s.fieldset} style={{ padding: 12, background: "var(--ivory)", border: "1px solid var(--line)" }}>
                <span className={s.legend}>Dados do entregador</span>
                <div className={s.row2}>
                  <label className={s.label}>
                    Veículo
                    <select className={s.select} value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}>
                      <option>Mota</option>
                      <option>Carro</option>
                      <option>Bicicleta</option>
                    </select>
                  </label>
                  <label className={s.label}>
                    Matrícula
                    <input className={s.input} value={f.vehiclePlate} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value.toUpperCase() })} placeholder="AAA 000 MC" />
                  </label>
                </div>
              </div>
            )}
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>Enviar palavra-passe temporária por</legend>
              <div className={s.checks}>
                <label>
                  <input type="checkbox" checked={f.sendWhatsapp} onChange={() => setF({ ...f, sendWhatsapp: !f.sendWhatsapp })} />
                  WhatsApp
                </label>
                <label>
                  <input type="checkbox" checked={f.sendEmail} onChange={() => setF({ ...f, sendEmail: !f.sendEmail })} />
                  E-mail
                </label>
              </div>
            </fieldset>
            <button
              className={s.btn}
              disabled={pending || !f.name || !f.username || !f.phone}
              onClick={() =>
                run(async () => {
                  const r = await createStaffAction({
                    name: f.name,
                    username: f.username,
                    phone: f.phone,
                    email: f.email,
                    role: f.role as never,
                    storeCodes: ["super", "admin"].includes(f.role) ? stores.map((st) => st.code) : f.stores,
                    vehicleType: f.vehicleType,
                    vehiclePlate: f.vehiclePlate,
                    sendWhatsapp: f.sendWhatsapp,
                    sendEmail: f.sendEmail,
                  });
                  if (r.ok) setF(blank);
                  return r;
                })
              }
            >
              <Icon name="userPlus" size={16} />
              Criar utilizador
            </button>
          </section>
        )}
      </div>
    </>
  );
}

function EditRow({ user, stores, pending, onSave }: { user: User; stores: { code: string }[]; pending: boolean; onSave: (i: { name: string; email: string; storeCodes: string[] }) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [codes, setCodes] = useState(user.storeCodes);
  return (
    <span className={s.fieldset} style={{ width: "100%", padding: 10, background: "var(--ivory)", border: "1px solid var(--line)" }}>
      <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" />
      <input className={s.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail" />
      <span className={s.checks}>
        {stores.map((st) => (
          <label key={st.code}>
            <input type="checkbox" checked={codes.includes(st.code)} onChange={() => setCodes(codes.includes(st.code) ? codes.filter((c) => c !== st.code) : [...codes, st.code])} />
            Loja {st.code}
          </label>
        ))}
      </span>
      <button className={`${s.btn} ${s.small}`} disabled={pending} onClick={() => onSave({ name, email, storeCodes: codes })}>
        Guardar
      </button>
    </span>
  );
}
