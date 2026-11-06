"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { commitImportPhotosAction, finishPhotoImportAction, planPhotoImportAction, readTablesAction, removeOrphansAction, uploadImportPhotoAction } from "@/app/gestao/actions/photos";
import { buildName, toColor, toSize } from "@/lib/import/shopify";
import type { PhotoGroup, PhotoPlan, TableRow } from "@/server/import/photos";
import type { Localized, ProductColor } from "@/types";
import s from "./admin.module.css";

/**
 * EN: "Produtos → Importar → Fotos de uma pasta". 1) choose Eterna's folder (with "Imagens/Editadas", "Imagens/Não
 *     Editadas" and the Word tables in "Tabelas"), 2) check the plan (nothing changes yet), 3) import: each photo is
 *     shrunk here and sent alone. Running it again skips the products already done. The original folder is only read.
 * PT: 1) escolher a pasta da Eterna (com "Imagens/Editadas", "Imagens/Não Editadas" e as tabelas Word em "Tabelas"),
 *     2) ver o plano (ainda nada muda), 3) importar: cada foto é reduzida aqui e enviada sozinha. Voltar a correr salta
 *     os produtos já feitos. A pasta só é lida.
 */

const CODE = /^[A-Z0-9][A-Z0-9-]{0,39}$/;
const SIZE = /^(\d{1,2}W?|XXS|XS|S|M|L|XL|XXL|XXXL)$/i;
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const MAX_PHOTOS = 12;
const PARALLEL = 3;

interface Entry {
  file: File;
  source: string; // EN: path from "Editadas"/"Não Editadas". PT: caminho a partir da pasta.
  code: string;
  rank: number; // EN: 0 main photo … 4 back. PT: 0 principal … 4 costas.
  stem: string;
  folder: string;
  edited: boolean;
  sizes: string[];
  /** EN: Colour written in the file name ("011911-BEGE", "012657 BROWN"). PT: Cor escrita no nome do ficheiro. */
  color: string | null;
}
interface NewProduct {
  name: Localized;
  colors: ProductColor[];
  price: number;
  variants: { size: string; stock: number; color: string | null }[];
  complete: boolean;
}
interface Task {
  code: string;
  label: string;
  kind: "edited" | "raw" | "create";
  entries: Entry[];
  folder: string;
  sizes: string[];
  product?: NewProduct;
  done?: boolean;
}
interface Info {
  desc: string;
  price: number | null;
  /** EN: colour (as written) + size → pieces. PT: cor (como escrita) + tamanho → peças. */
  stock: Map<string, { color: string; size: string; n: number }>;
}

// EN: Colour words of the file names that are not Portuguese. PT: Cores dos nomes dos ficheiros que não estão em português.
const COLOR_WORDS: Record<string, string> = {
  BLACK: "PRETO",
  BROWN: "CASTANHO",
  WHITE: "BRANCO",
  IVORY: "MARFIM",
  MARFIL: "MARFIM",
  RED: "VERMELHO",
  BLUE: "AZUL",
  GREEN: "VERDE",
  PINK: "ROSA",
  BEIGE: "BEGE",
  GOLD: "DOURADO",
  SILVER: "PRATEADO",
  GREY: "CINZENTO",
  GRAY: "CINZENTO",
};
const PHOTO_WORDS = /^(thumbnail|thimbnail|front|back|bk|side\d*|v\d+|f|ab|cl|scaled)$/i;

/** EN: First word of the file name that is a known colour (a last letter "A"-"H" = other angle). PT: Cor no nome. */
function colorWord(words: string[]): string | null {
  for (const raw of words) {
    if (PHOTO_WORDS.test(raw) || !/^[A-Za-zÀ-ú]{3,}$/.test(raw)) continue;
    for (const w of [raw.toUpperCase(), raw.toUpperCase().replace(/[A-H]$/, "")]) {
      const pt = COLOR_WORDS[w] ?? w;
      const unknown = new Set<string>();
      toColor(pt, unknown);
      if (!unknown.size) return pt;
    }
  }
  return null;
}

/** EN: Same rule as the server (src/server/import/photos.ts). PT: A mesma regra do servidor. */
function baseCode(code: string): string {
  const b = code.replace(/[A-H]{1,2}$/, "");
  return b.length >= 3 && b !== code && /\d$/.test(b) ? b : code;
}

function readFolder(files: File[]) {
  const entries: Entry[] = [];
  const tables = files.filter((f) => /\.docx$/i.test(f.name) && !f.name.startsWith("~$"));
  const skipped = { outside: 0, format: 0, copies: 0, name: 0, repeated: 0 };
  const seen = new Set<string>();
  for (const file of files) {
    if (/\.docx$/i.test(file.name)) continue;
    const parts = (file.webkitRelativePath || file.name).normalize("NFC").split("/");
    const at = parts.findIndex((p) => /^(n[aã]o\s+)?editadas$/i.test(p.trim()));
    if (at < 0 || parts.length < at + 3) {
      skipped.outside++;
      continue;
    }
    const name = parts[parts.length - 1];
    if (!IMAGE.test(name)) {
      skipped.format++;
      continue;
    }
    // EN: "SAP073A.jpg.webp" → "SAP073A". PT: Extensões repetidas.
    let stem = name;
    while (IMAGE.test(stem)) stem = stem.replace(/\.[^.]+$/, "");
    stem = stem.trim();
    if (/\s*-\s*c[oó]pia(\s*\d+)?$/i.test(stem)) {
      skipped.copies++;
      continue;
    }
    // EN: The code is the first part of the name (no store code has "-", "_" or spaces): "7G178-thumbnail",
    //     "SUIT376_front", "012657 BROWN", "011911-BEGE-SIDE". The rest only orders the photos: thumbnail/front = main,
    //     back/BK = last, anything else (side, colour, v2, "(2)") = other photos.
    // PT: O código é a primeira parte do nome; o resto só ordena as fotos: thumbnail/front = principal, back = última.
    const [head, ...tail] = stem.replace(/\s*\(\d+\)$/, "").split(/[-_ ]+/);
    const rest = tail.join(" ").toLowerCase();
    let rank = /\(\d+\)$/.test(stem) ? 3 : 1;
    if (/\b(thumbnail|thimbnail|front|f)\b/.test(rest)) rank = 0;
    else if (/\b(back|bk)\b/.test(rest)) rank = 4;
    else if (rest) rank = Math.max(rank, 2);
    const code = head.trim().toUpperCase();
    if (rank === 1 && baseCode(code) !== code) rank = 2;
    if (!CODE.test(code) || !/\d/.test(code)) {
      skipped.name++;
      continue;
    }
    const edited = !/^n/i.test(parts[at].trim());
    stem = stem.toLowerCase();
    const key = `${edited}|${code}|${stem}`;
    if (seen.has(key)) {
      skipped.repeated++;
      continue;
    }
    seen.add(key);
    entries.push({
      file,
      source: parts.slice(at).join("/"),
      code,
      rank,
      stem,
      folder: parts[at + 1].trim(),
      edited,
      sizes: parts.slice(at + 2, -1).map((p) => p.trim().toUpperCase()).filter((p) => SIZE.test(p)),
      color: colorWord(tail),
    });
  }
  return { entries, skipped, tables };
}

/**
 * EN: Table rows → info per code. The collection tables (Acessórios, Noivas, Essenza) give name, colour and price;
 *     the stock comes from "Stock Total" when the code is there (one row = one piece of that size).
 * PT: Linhas das tabelas → informação por código. As tabelas das colecções dão nome, cor e preço; o stock vem do
 *     "Stock Total" quando o código lá está (uma linha = uma peça desse tamanho).
 */
function readInfo(docs: { name: string; rows: TableRow[] }[]) {
  const rank = (n: string) => (/stock/i.test(n) ? 1 : 0);
  const sorted = [...docs].sort((a, b) => rank(a.name) - rank(b.name));
  const info = new Map<string, Info>();
  for (const doc of sorted) {
    const counts = new Map<string, Info["stock"]>();
    for (const r of doc.rows) {
      const size = toSize(r.size);
      // EN: "NAVY DOURADO" and "NAVY/DOURADO" are the same colour. PT: Mesma cor escrita de duas formas.
      const key = `${r.color.toUpperCase().replace(/[\s/]+/g, "")}|${size}`;
      const m = counts.get(r.code) ?? new Map();
      const cur0 = m.get(key);
      m.set(key, { color: cur0?.color ?? r.color.trim(), size, n: (cur0?.n ?? 0) + 1 });
      counts.set(r.code, m);
      const cur = info.get(r.code);
      if (!cur) info.set(r.code, { desc: r.desc, price: r.price, stock: new Map() });
      else {
        cur.desc ||= r.desc;
        cur.price ??= r.price;
      }
    }
    for (const [code, m] of counts) {
      const cur = info.get(code)!;
      if (!cur.stock.size || rank(doc.name)) cur.stock = m;
    }
  }
  return info;
}

function buildTasks(entries: Entry[], plan: PhotoPlan, info: Map<string, Info>) {
  const byProduct = new Map<string, { edited: Entry[]; raw: Entry[] }>();
  const create = new Map<string, Entry[]>();
  for (const e of entries) {
    const target = plan.resolved[e.code];
    if (target) {
      const slot = byProduct.get(target) ?? { edited: [], raw: [] };
      (e.edited ? slot.edited : slot.raw).push(e);
      byProduct.set(target, slot);
    } else if (e.edited) {
      const b = baseCode(e.code);
      create.set(b, [...(create.get(b) ?? []), e]);
    }
  }
  const order = (list: Entry[], code: string) =>
    [...list].sort((a, b) => Number(a.code !== code) - Number(b.code !== code) || a.rank - b.rank || a.stem.localeCompare(b.stem)).slice(0, MAX_PHOTOS);
  const sizesOf = (list: Entry[]) => [...new Set(list.flatMap((e) => e.sizes))];
  const tasks: Task[] = [];
  for (const [code, slot] of byProduct) {
    const list = slot.edited.length ? slot.edited : slot.raw;
    const entriesOrdered = order(list, code);
    const sources = plan.products[code]?.sources ?? [];
    const same = sources.length === entriesOrdered.length && entriesOrdered.every((e, i) => sources[i] === `pasta:${e.source}`);
    tasks.push({ code, label: plan.products[code]?.name ?? code, kind: slot.edited.length ? "edited" : "raw", entries: entriesOrdered, folder: list[0].folder, sizes: sizesOf(list), done: same });
  }
  for (const [code, list] of create) {
    const folder = plan.folders[list[0].folder];
    const i = info.get(code) ?? list.map((e) => info.get(e.code)).find(Boolean);
    // EN: Variants only from what the edited folder shows (owner 2026-11-06): its size folders and the colours in the
    //     file names. The tables give price and how many pieces each of those variants has (0 if not listed).
    //     Nothing else is made up: without size folders the product has no variants (the team adds them).
    // PT: Variantes só do que a pasta de editadas mostra (dona 06-11-2026): as pastas de tamanho e as cores nos nomes
    //     dos ficheiros. As tabelas dão o preço e quantas peças tem cada variante (0 se não estiver lá).
    //     Nada mais se inventa: sem pastas de tamanho o produto fica sem variantes (a equipa acrescenta).
    const norm = (c: string) => c.toUpperCase().replace(/[\s/]+/g, "");
    const rows = [...(i?.stock.values() ?? [])];
    const sizes = sizesOf(list).map(toSize);
    const fileColors = [...new Set(list.map((e) => e.color).filter((c): c is string => !!c))];
    const colorNames = fileColors;
    const colors = [...new Map(colorNames.map((c) => toColor(c, new Set())).map((c) => [c.key, c])).values()];
    const stockOf = (size: string, color: string | null) =>
      rows.filter((r) => r.size === size && (!color || colors.length < 2 || norm(r.color) === norm(color))).reduce((n, r) => n + r.n, 0);
    const price = i?.price ?? 0;
    const variants = (colors.length > 1 ? colorNames : [colorNames[0] ?? null]).flatMap((c) =>
      sizes.map((size) => ({ size, stock: stockOf(size, c), color: c ? toColor(c, new Set()).key : null })),
    );
    // EN: Without a piece type, the folder gives the name ("Modeladores" → "Modelador"). PT: Sem tipo, o nome vem da pasta.
    const one = list[0].folder.replace(/(õ)es$/i, "ão").replace(/([rlz])es$/i, "$1").replace(/s$/i, "");
    const name = folder?.typeSlug ? buildName(folder.typeSlug, i?.desc ?? "", colors) : { pt: one, en: one };
    const complete = price > 0 && !!folder?.typeId && variants.some((v) => v.stock > 0);
    tasks.push({ code, label: name.pt, kind: "create", entries: order(list, code), folder: list[0].folder, sizes: sizesOf(list), product: { name, colors, price, variants, complete } });
  }
  return tasks.sort((a, b) => a.code.localeCompare(b.code));
}

/** EN: Shrinks a photo in the browser (JPEG, ≤1600×2000, <1 MB). PT: Reduz a foto no browser. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width, 2000 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // EN: transparent PNGs on white. PT: PNG transparentes sobre branco.
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.86, 0.72, 0.58]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size < 950_000) return blob;
  }
  throw new Error("foto grande demais");
}

export function PhotoFolderImport({ canPublish }: { canPublish: boolean }) {
  const [removed, setRemoved] = useState("");
  const [removing, setRemoving] = useState(false);
  const [phase, setPhase] = useState<"pick" | "reading" | "review" | "running" | "done">("pick");
  const [error, setError] = useState("");
  const [read, setRead] = useState<ReturnType<typeof readFolder> | null>(null);
  const [plan, setPlan] = useState<PhotoPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [count, setCount] = useState({ n: 0, replaced: 0, created: 0, photos: 0, failed: 0 });
  const [failures, setFailures] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [total, setTotal] = useState(0);
  const [tableNote, setTableNote] = useState("");
  const stop = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // EN: Folder picking is not a standard attribute in React's types. PT: A escolha de pasta não está nos tipos.
    input.current?.setAttribute("webkitdirectory", "");
  }, []);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError("");
    setPhase("reading");
    const r = readFolder(files);
    if (!r.entries.length) {
      setError("Não encontrei fotos dentro de «Editadas» ou «Não Editadas». Escolha a pasta da Eterna (a que tem «Imagens» e «Tabelas»).");
      setPhase("pick");
      return;
    }
    const docs: { name: string; rows: TableRow[] }[] = [];
    for (const t of r.tables) {
      const form = new FormData();
      form.set("file", t);
      const res = await readTablesAction(form);
      if (res.ok) docs.push({ name: t.name, rows: res.rows });
      else setFailures((f) => [...f, `${t.name}: ${res.message}`]);
    }
    const info = readInfo(docs);
    const tableCodes = [...info.keys()];
    setTableNote(docs.length ? `${docs.length} tabelas lidas (${docs.map((d) => d.name.replace(/\.docx$/i, "")).join(", ")}) · ${info.size} códigos com preço e tamanhos` : "Sem tabelas Word: os produtos novos ficam sem preço.");
    const groups = new Map<string, PhotoGroup>();
    for (const x of r.entries) {
      const key = `${x.edited}|${x.code}|${x.folder}`;
      const g = groups.get(key) ?? { code: x.code, folder: x.folder, edited: x.edited, sizes: [] };
      g.sizes = [...new Set([...g.sizes, ...x.sizes])];
      groups.set(key, g);
    }
    const res = await planPhotoImportAction({ groups: [...groups.values()], tableCodes });
    if (!res.ok) {
      setError(res.message);
      setPhase("pick");
      return;
    }
    setRead(r);
    setPlan(res.plan);
    setTasks(buildTasks(r.entries, res.plan, info));
    setPhase("review");
  }

  const stats = useMemo(() => {
    const by = (k: Task["kind"]) => tasks.filter((t) => t.kind === k);
    const create = by("create");
    return { edited: by("edited"), raw: by("raw"), complete: create.filter((t) => t.product?.complete), incomplete: create.filter((t) => !t.product?.complete), done: tasks.filter((t) => t.done).length };
  }, [tasks]);

  async function runOne(t: Task) {
    const photos: { url: string; source: string }[] = [];
    for (const e of t.entries) {
      try {
        const blob = await shrink(e.file);
        const form = new FormData();
        form.set("code", t.code);
        form.set("source", e.source);
        form.set("file", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        const r = await uploadImportPhotoAction(form);
        if (r.ok) photos.push({ url: r.url, source: e.source });
        else setFailures((f) => [...f, `${t.code} · ${e.source}: ${r.message}`]);
      } catch {
        setFailures((f) => [...f, `${t.code} · ${e.source}: não foi possível abrir a foto`]);
      }
    }
    if (!photos.length) return { ok: false, photos: 0 };
    const folder = plan?.folders[t.folder];
    const create =
      t.kind === "create" && t.product && folder
        ? { typeId: folder.typeId, store: folder.store, name: t.product.name, colors: t.product.colors, price: t.product.price, variants: t.product.variants, publish: publish && t.product.complete }
        : undefined;
    const r = await commitImportPhotosAction({ code: t.code, photos, create });
    if (!r.ok) {
      setFailures((f) => [...f, `${t.code}: ${r.message}`]);
      return { ok: false, photos: 0 };
    }
    return { ok: true, photos: photos.length, created: r.result === "created" };
  }

  async function run() {
    stop.current = false;
    setPhase("running");
    setFailures([]);
    const queue = tasks.filter((t) => !t.done);
    setTotal(queue.length);
    const c = { n: 0, replaced: 0, created: 0, photos: 0, failed: 0 };
    setCount({ ...c });
    let next = 0;
    const worker = async () => {
      while (!stop.current && next < queue.length) {
        const t = queue[next++];
        const r = await runOne(t);
        c.n++;
        if (r.ok) {
          c.photos += r.photos;
          if (r.created) c.created++;
          else c.replaced++;
          t.done = true;
        } else c.failed++;
        setCount({ ...c });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await finishPhotoImportAction(`${c.replaced} produtos com fotos novas, ${c.created} criados no armazém, ${c.photos} fotos${c.failed ? `, ${c.failed} falharam` : ""}${stop.current ? " (parada)" : ""}`);
    setPhase("done");
  }

  async function removeOrphans() {
    if (!plan?.orphans.length) return;
    const n = plan.orphans.length;
    if (!window.confirm(`Retirar da loja ${n} produtos que não estão no Shopify, nas fotos editadas nem nas tabelas? Os que já tiveram encomendas ou reservas ficam arquivados; os outros são apagados.`)) return;
    setRemoving(true);
    const r = await removeOrphansAction(plan.orphans.map((o) => o.id));
    setRemoving(false);
    if (!r.ok) {
      setRemoved(r.message);
      return;
    }
    setRemoved(`${r.deleted} apagados · ${r.archived} arquivados (tinham encomendas ou reservas).`);
    setPlan({ ...plan, orphans: [] });
  }

  const todo = tasks.filter((t) => !t.done).length;
  const pct = total ? Math.round((count.n / total) * 100) : 100;
  const skippedTotal = read ? Object.values(read.skipped).reduce((a, b) => a + b, 0) : 0;
  const list = (items: Task[], extra: (t: Task) => string) => (
    <ul className={s.list}>
      {items.slice(0, 300).map((t) => (
        <li key={t.code} className={s.listItem}>
          <span className={s.strong}>{t.code}</span>
          <span className={s.muted}>
            {t.label} · {extra(t)}
            {t.done ? " · já importado" : ""}
          </span>
        </li>
      ))}
      {items.length > 300 && <li className={s.muted}>E mais {items.length - 300}.</li>}
    </ul>
  );

  return (
    <>
      {(phase === "pick" || phase === "reading") && (
        <section className={s.card}>
          <h2 className={s.h2}>1. Escolher a pasta</h2>
          <p className={s.muted}>
            Escolha a pasta da <b>Eterna</b>, a que tem dentro «Imagens» (com «Editadas» e «Não Editadas») e «Tabelas». O nome de cada foto é o código da peça (ex.:
            7G178-thumbnail.jpg); as tabelas Word dão o preço, a cor e os tamanhos das peças novas. Os ficheiros originais não mudam: o site guarda cópias reduzidas.
          </p>
          <label className={s.label}>
            Pasta das fotos
            <input ref={input} type="file" multiple onChange={pick} className={s.input} disabled={phase === "reading"} />
          </label>
          {phase === "reading" && <p className={s.hint}>A ler a pasta e a cruzar com os produtos da loja…</p>}
          {error && <p className={s.error}>{error}</p>}
        </section>
      )}

      {phase === "review" && plan && read && (
        <>
          <div className={s.stats}>
            <div className={s.stat}>
              <span className={s.statLabel}>Fotos editadas</span>
              <span className={s.statValue}>{stats.edited.length}</span>
              <span className={s.statSub}>produtos da loja com fotos novas</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Fotos não editadas</span>
              <span className={s.statValue}>{stats.raw.length}</span>
              <span className={s.statSub}>produtos sem editada</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Novos completos</span>
              <span className={s.statValue}>{stats.complete.length}</span>
              <span className={s.statSub}>com preço, tamanho e stock</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Novos no armazém</span>
              <span className={s.statValue}>{stats.incomplete.length}</span>
              <span className={s.statSub}>falta informação</span>
            </div>
            <div className={s.stat}>
              <span className={s.statLabel}>Ficam como estão</span>
              <span className={s.statValue}>{plan.untouched.length}</span>
              <span className={s.statSub}>sem foto na pasta</span>
            </div>
          </div>
          <section className={s.card}>
            <h2 className={s.h2}>2. Verificar antes de importar</h2>
            <p className={s.muted}>
              {read.entries.length} fotos lidas · {skippedTotal} ignoradas ({read.skipped.copies} cópias, {read.skipped.repeated} repetidas noutras pastas de tamanho,{" "}
              {read.skipped.format} noutros formatos, {read.skipped.outside + read.skipped.name} fora das pastas ou com nome sem código)
              {stats.done ? ` · ${stats.done} produtos já importados antes (saltam-se)` : ""}.
            </p>
            <p className={s.muted}>{tableNote}</p>
            <p className={s.warning}>
              As fotos actuais destes produtos são substituídas. Os produtos novos ficam em rascunho (armazém); os que não têm preço, tipo ou stock nas tabelas só vão para a
              loja depois de a equipa completar a ficha.
            </p>
            {canPublish && stats.complete.length > 0 && (
              <label className={s.check}>
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                Publicar logo os {stats.complete.length} produtos novos completos (senão ficam também em rascunho)
              </label>
            )}
            <div className={s.actions}>
              <button type="button" className={s.btn} onClick={run} disabled={!todo}>
                Importar {todo} produtos
              </button>
              <button type="button" className={s.btnOutline} onClick={() => setPhase("pick")}>
                Voltar
              </button>
            </div>
          </section>
          <details className={s.card}>
            <summary className={s.h2}>Com fotos editadas ({stats.edited.length})</summary>
            {list(stats.edited, (t) => `${t.entries.length} fotos`)}
          </details>
          <details className={s.card}>
            <summary className={s.h2}>Com fotos não editadas ({stats.raw.length})</summary>
            {list(stats.raw, (t) => `${t.entries.length} fotos`)}
          </details>
          <details className={s.card}>
            <summary className={s.h2}>Novos completos ({stats.complete.length})</summary>
            {list(stats.complete, (t) => `${t.folder} · ${t.product!.price.toLocaleString("pt-PT")} MT · ${t.product!.variants.map((v) => `${v.size} ×${v.stock}`).join(", ")} · ${t.entries.length} fotos`)}
          </details>
          <details className={s.card}>
            <summary className={s.h2}>Novos no armazém, falta informação ({stats.incomplete.length})</summary>
            {list(stats.incomplete, (t) => {
              const p = t.product!;
              const miss = [p.price ? "" : "preço", plan.folders[t.folder]?.typeId ? "" : "tipo", p.variants.some((v) => v.stock > 0) ? "" : "stock"].filter(Boolean).join(", ");
              return `${t.folder} · falta ${miss} · ${t.entries.length} fotos`;
            })}
          </details>
          <section className={s.card}>
            <h2 className={s.h2}>Fora do Shopify, das fotos editadas e das tabelas ({plan.orphans.length})</h2>
            <p className={s.muted}>
              Produtos da loja que não vêm do Shopify, não têm foto editada e não estão em nenhuma tabela. Os que já tiveram encomendas ou reservas ficam arquivados (saem da
              loja, o histórico fica); os outros são apagados.
            </p>
            {plan.orphans.length > 0 && (
              <ul className={s.list}>
                {plan.orphans.slice(0, 300).map((o) => (
                  <li key={o.id} className={s.listItem}>
                    <span className={s.strong}>{o.code}</span>
                    <span className={s.muted}>
                      {o.name}
                      {o.history ? " · fica arquivado" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {removed && <p className={s.hint}>{removed}</p>}
            {canPublish && plan.orphans.length > 0 && (
              <div className={s.actions}>
                <button type="button" className={s.btnOutline} onClick={removeOrphans} disabled={removing}>
                  {removing ? "A retirar…" : `Retirar ${plan.orphans.length} produtos`}
                </button>
              </div>
            )}
          </section>
          <details className={s.card}>
            <summary className={s.h2}>Produtos da loja sem foto na pasta ({plan.untouched.length})</summary>
            <p className={s.muted}>{plan.untouched.join(" · ")}</p>
          </details>
        </>
      )}

      {(phase === "running" || phase === "done") && (
        <section className={s.card}>
          <h2 className={s.h2}>{phase === "running" ? "3. A importar…" : stop.current ? "Importação parada" : "Importação concluída"}</h2>
          <div className={s.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%`, background: "var(--privee)" }} />
          </div>
          <p>
            {count.n} de {total} · {count.replaced} com fotos novas · {count.created} produtos novos · {count.photos} fotos
            {count.failed ? ` · ${count.failed} falharam` : ""}
          </p>
          {phase === "running" ? (
            <>
              <p className={s.hint}>Mantenha esta página aberta. Se a fechar, escolha a pasta outra vez: os produtos já feitos saltam-se.</p>
              <div className={s.actions}>
                <button type="button" className={s.btnOutline} onClick={() => (stop.current = true)}>
                  Parar
                </button>
              </div>
            </>
          ) : (
            <div className={s.actions}>
              <Link href="/gestao/produtos" className={s.btn}>
                Ver produtos
              </Link>
              <Link href="/gestao/produtos?tab=Rascunhos" className={s.btnOutline}>
                Ver rascunhos
              </Link>
            </div>
          )}
          {failures.length > 0 && (
            <ul className={s.list}>
              {failures.slice(0, 40).map((f) => (
                <li key={f} className={s.listItem}>
                  <span className={s.muted}>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
