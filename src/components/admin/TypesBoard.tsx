"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  createTypeAction,
  deleteTypeAction,
  renameTypeAction,
  saveTypeOrderAction,
  setShowInAction,
  uploadTypeImageAction,
  type TypeActionResult,
} from "@/app/gestao/actions/types";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import d3 from "./Dashboard.module.css";
import t from "./Types.module.css";

/**
 * EN: Interactive parts of "Gestão · Tipos de peça" (design V3): drag to order, rename, change the circular image,
 *     remove (only without pieces), where bridal accessories appear, and "Novo tipo de peça".
 * PT: Partes interactivas de Tipos de peça (V3): arrastar para ordenar, mudar o nome, trocar a imagem circular, remover
 *     (só sem peças), onde aparecem os acessórios de noiva e "Novo tipo de peça".
 */

type TypeRow = { id: string; name: string; imageUrl: string | null; pieces: number; bridalAccessory: boolean; showIn: "noivas" | "acessorios" | "both" };

function Feedback({ result }: { result: TypeActionResult | null }) {
  if (!result) return null;
  return (
    <span role={result.ok ? "status" : "alert"} className={result.ok ? c.ok : c.err}>
      {result.message}
    </span>
  );
}

function Circle({ url, size }: { url: string | null; size: number }) {
  return (
    <span className={t.circle} style={{ width: size, height: size }}>
      {url ? <Image src={url} alt="" width={size} height={size} /> : <Icon name="image" size={18} />}
    </span>
  );
}

export function TypesTable({ types, disabled }: { types: TypeRow[]; disabled: boolean }) {
  const [list, setList] = useState(types);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<TypeActionResult | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  const drop = (to: number) => {
    if (drag === null || drag === to) return;
    const next = [...list];
    const [moved] = next.splice(drag, 1);
    next.splice(to, 0, moved);
    setList(next);
    setDrag(null);
    start(async () => setRes(await saveTypeOrderAction(next.map((x) => x.id))));
  };

  return (
    <>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = target.current;
          e.target.value = "";
          if (!f || !id) return;
          const form = new FormData();
          form.set("file", f);
          start(async () => {
            const r = await uploadTypeImageAction(id, form);
            setRes(r);
            if (r.ok && r.url) setList((l) => l.map((x) => (x.id === id ? { ...x, imageUrl: r.url! } : x)));
          });
        }}
      />
      <Feedback result={res} />
      <table className={d3.table}>
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>Imagem</th>
            <th>Nome</th>
            <th className={d3.right}>Peças</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((x, i) => (
            <tr
              key={x.id}
              draggable={!disabled}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(i)}
              className={drag === i ? t.dragging : undefined}
            >
              <td>
                <span className={t.grip} aria-hidden="true">
                  <Icon name="grip" size={18} />
                </span>
              </td>
              <td>
                <Circle url={x.imageUrl} size={64} />
              </td>
              <td>
                <input
                  className={c.input}
                  style={{ width: 170 }}
                  defaultValue={x.name}
                  disabled={disabled}
                  aria-label={`Nome de ${x.name}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== x.name) start(async () => setRes(await renameTypeAction(x.id, v)));
                  }}
                />
              </td>
              <td className={d3.right}>
                <span className={c.num}>{x.pieces}</span>
              </td>
              <td>
                <button
                  type="button"
                  className={`${c.btn} ${c.xs}`}
                  disabled={disabled || pending}
                  title="Trocar imagem"
                  aria-label={`Trocar imagem de ${x.name}`}
                  onClick={() => {
                    target.current = x.id;
                    file.current?.click();
                  }}
                >
                  <Icon name="image" size={14} />
                </button>
              </td>
              <td>
                <button
                  type="button"
                  className={c.textBtn}
                  data-tone="bad"
                  disabled={disabled || pending || x.pieces > 0}
                  title={x.pieces > 0 ? "Mova as peças antes de remover" : "Remover"}
                  aria-label={`Remover ${x.name}`}
                  onClick={() => {
                    if (!window.confirm(`Remover o tipo “${x.name}”?`)) return;
                    start(async () => {
                      const r = await deleteTypeAction(x.id);
                      setRes(r);
                      if (r.ok) setList((l) => l.filter((y) => y.id !== x.id));
                    });
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const SHOW = [
  ["noivas", "Só Noivas"],
  ["acessorios", "Só Acessórios"],
  ["both", "Nos dois"],
] as const;

export function BridalAccessories({ types, disabled }: { types: TypeRow[]; disabled: boolean }) {
  const [list, setList] = useState(types);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<TypeActionResult | null>(null);
  return (
    <>
      <Feedback result={res} />
      <table className={d3.table}>
        <thead>
          <tr>
            <th />
            <th>Tipo</th>
            <th>Aparece em</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id}>
              <td style={{ width: 70 }}>
                <Circle url={x.imageUrl} size={52} />
              </td>
              <td>{x.name}</td>
              <td>
                <div className={c.seg} role="group" aria-label={`Onde aparece ${x.name}`}>
                  {SHOW.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={x.showIn === k}
                      disabled={disabled || pending}
                      onClick={() => {
                        setList((l) => l.map((y) => (y.id === x.id ? { ...y, showIn: k } : y)));
                        start(async () => setRes(await setShowInAction(x.id, k)));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function NewTypeForm({ groups, defaultGroup, disabled }: { groups: { id: string; name: string }[]; defaultGroup: string; disabled: boolean }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState(defaultGroup);
  const [image, setImage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<TypeActionResult | null>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className={t.form}>
      <label className={c.field}>
        <span className={c.lbl}>Nome</span>
        <input className={c.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Vestidos curtos" disabled={disabled} />
      </label>
      <label className={c.field}>
        <span className={c.lbl}>Grupo</span>
        <select className={c.select} value={group} onChange={(e) => setGroup(e.target.value)} disabled={disabled}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className={c.field}>
        <span className={c.lbl}>Imagem do tipo · moldura circular</span>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const form = new FormData();
            form.set("file", f);
            start(async () => {
              const r = await uploadTypeImageAction("", form);
              if (r.ok && r.url) setImage(r.url);
              else setRes(r);
            });
          }}
        />
        <button
          type="button"
          className={t.drop}
          disabled={disabled}
          onClick={() => file.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            const form = new FormData();
            form.set("file", f);
            start(async () => {
              const r = await uploadTypeImageAction("", form);
              if (r.ok && r.url) setImage(r.url);
              else setRes(r);
            });
          }}
        >
          {image ? (
            <Image src={image} alt="" width={180} height={180} />
          ) : (
            <>
              <Icon name="image" size={26} />
              <span className={c.xsMuted}>Arraste a imagem ou escolha um ficheiro</span>
            </>
          )}
        </button>
        <div className={c.note}>
          <Icon name="info" size={16} />
          <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
            Imagem do tipo: aparece num círculo centrado, com o nome por baixo. Quadrada ou 3:4 · mínimo 800 × 800 px · JPG ou WebP · até 1 MB. Sem imagem, o site usa a foto de uma peça deste
            tipo.
          </span>
        </div>
      </div>
      <Feedback result={res} />
      <button
        type="button"
        className={`${c.btnPrimary} ${c.sm}`}
        disabled={disabled || pending || name.trim().length < 2}
        onClick={() =>
          start(async () => {
            const r = await createTypeAction({ name, groupId: group, imageUrl: image });
            setRes(r);
            if (r.ok) {
              setName("");
              setImage(null);
            }
          })
        }
      >
        Criar tipo
      </button>
    </div>
  );
}
