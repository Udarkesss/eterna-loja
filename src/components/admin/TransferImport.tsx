"use client";

import { useRef, useState } from "react";
import { transferPartAction, transferPhotoAction } from "@/app/gestao/actions/transfer";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";

/**
 * EN: "Trazer os dados do computador": reads the file made by `npm run transfer:export` in the browser (nothing is
 *     uploaded in one go): first the photos one by one, then the data in small parts. Can be run again: it updates.
 * PT: Lê no browser o ficheiro feito com `npm run transfer:export` (nada é enviado de uma vez): primeiro as fotos uma a
 *     uma, depois os dados em partes pequenas. Pode repetir-se: actualiza.
 */

interface Header {
  version: number;
  createdAt: string;
  categories: unknown[];
  stores: unknown[];
  products: { code: string; images?: { url: string }[] }[];
  sections: unknown[];
  tiles: unknown[];
  settings: unknown[];
  customers: unknown[];
  files: { path: string; type: string; offset: number; size: number }[];
}

export function TransferImport() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [head, setHead] = useState<{ h: Header; start: number } | null>(null);
  const [step, setStep] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  async function pick(f: File | undefined) {
    setErrors([]);
    setFinished(false);
    if (!f) return;
    const first = new TextDecoder().decode(await f.slice(0, 32).arrayBuffer());
    const len = Number(first.split("\n")[0]);
    const nl = first.indexOf("\n") + 1;
    if (!len || !nl) return setErrors(["Este ficheiro não é um ficheiro de dados da Eterna (.dados)."]);
    const h = JSON.parse(new TextDecoder().decode(await f.slice(nl, nl + len).arrayBuffer())) as Header;
    setFile(f);
    setHead({ h, start: nl + len });
  }

  async function run() {
    if (!file || !head) return;
    setRunning(true);
    setErrors([]);
    const { h, start } = head;
    const fails: string[] = [];
    const urls: Record<string, string> = {};

    // EN: 1. Photos, 4 at a time. PT: 1. Fotos, 4 de cada vez.
    setStep("Fotos");
    setTotal(h.files.length);
    setDone(0);
    let next = 0;
    let count = 0;
    const worker = async () => {
      while (next < h.files.length) {
        const f = h.files[next++];
        const form = new FormData();
        form.set("path", f.path);
        form.set("file", new File([file.slice(start + f.offset, start + f.offset + f.size)], f.path.split("/").pop()!, { type: f.type }));
        let r = await transferPhotoAction(form).catch((e: unknown) => ({ ok: false as const, message: String(e) }));
        if (!r.ok) r = await transferPhotoAction(form).catch((e: unknown) => ({ ok: false as const, message: String(e) }));
        if (r.ok && r.url) urls[f.path] = r.url;
        else fails.push(`${f.path}: ${r.ok ? "sem endereço" : r.message}`);
        setDone(++count);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    // EN: 2. Data, in small parts (the server accepts up to 1 MB per call). PT: 2. Dados, em partes pequenas.
    const send = async (label: string, part: string, rows: unknown[], size: number, extra: Record<string, unknown> = {}) => {
      setStep(label);
      setTotal(rows.length);
      setDone(0);
      for (let i = 0; i < rows.length; i += size) {
        const chunk = rows.slice(i, i + size);
        // EN: Only the photo addresses this part needs. PT: Só os endereços das fotos desta parte.
        const own = extra.urls ? { urls: Object.fromEntries((chunk as { images?: { url: string }[] }[]).flatMap((p) => p.images ?? []).filter((im) => urls[im.url]).map((im) => [im.url, urls[im.url]])) } : {};
        const r = await transferPartAction(JSON.stringify({ part, rows: chunk, ...extra, ...own })).catch((e: unknown) => ({ ok: false as const, message: String(e) }));
        if (!r.ok) fails.push(`${label} ${i + 1}–${i + chunk.length}: ${r.message}`);
        setDone(Math.min(rows.length, i + size));
      }
    };
    await send("Categorias", "categories", h.categories, 500);
    await send("Lojas", "stores", h.stores, 50);
    await send("Peças", "products", h.products, 15, { urls });
    await send("Conteúdo do site", "sections", h.sections, 6);
    await send("Ocasiões", "tiles", h.tiles, 50);
    await send("Definições", "settings", h.settings, 4);
    await send("Clientes", "customers", h.customers, 50);
    const summary = `${h.products.length} peças · ${Object.keys(urls).length} fotos · ${h.sections.length} secções · ${h.customers.length} clientes · ficheiro de ${h.createdAt.slice(0, 10)}`;
    await transferPartAction(JSON.stringify({ part: "done", summary }));
    setErrors(fails);
    setStep("");
    setRunning(false);
    setFinished(true);
  }

  const h = head?.h;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <input ref={input} type="file" accept=".dados" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className={c.row} style={{ gap: 12, flexWrap: "wrap" }}>
        <button type="button" className={`${c.btn} ${c.sm}`} disabled={running} onClick={() => input.current?.click()}>
          <Icon name="upload" size={15} />
          {file ? file.name : "Escolher o ficheiro .dados"}
        </button>
        {h && !running && !finished && (
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={run}>
            Trazer os dados
          </button>
        )}
      </div>
      {h && (
        <p className={c.small}>
          Ficheiro de {new Date(h.createdAt).toLocaleString("pt-PT")}: {h.products.length} peças, {h.files.length} fotos, {h.categories.length} categorias, {h.sections.length} secções do
          site, {h.tiles.length} ocasiões, {h.settings.length} definições e {h.customers.length} clientes. O que já existe aqui com o mesmo código é actualizado.
        </p>
      )}
      {running && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className={c.small}>
            <b style={{ fontWeight: 500 }}>{step}</b> · {done} de {total}
          </span>
          <progress max={total || 1} value={done} style={{ width: "100%" }} />
          <span className={c.xsMuted}>Não feche esta página até terminar.</span>
        </div>
      )}
      {finished && errors.length === 0 && (
        <span role="status" className={c.ok}>
          Dados trazidos. Abra o site para confirmar.
        </span>
      )}
      {errors.length > 0 && (
        <div role="alert" className={c.err} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <b style={{ fontWeight: 500 }}>{errors.length} problemas (pode repetir: o que já entrou é só actualizado):</b>
          {errors.slice(0, 12).map((e) => (
            <span key={e}>{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}
