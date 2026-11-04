import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * EN: Minimal Excel (.xlsx) reader and writer for the V3 imports (Gestão · Clientes "Modelo Excel / Importar clientes"
 *     and Gestão · Importar "Excel + ZIP"). An .xlsx is a ZIP of XML files: we read the first sheet's cells as text
 *     and write one sheet, with optional pick lists (the ▾ columns of the design). No dependency.
 * PT: Leitor e escritor mínimo de Excel (.xlsx) para as importações do V3. Um .xlsx é um ZIP de ficheiros XML: lemos as
 *     células da primeira folha como texto e escrevemos uma folha, com listas de escolha opcionais (as colunas ▾).
 */

// ── ZIP ─────────────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  data: () => Buffer;
}

/** EN: Entries of a ZIP file (central directory). PT: Ficheiros de um ZIP (directório central). */
export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("NOT_A_ZIP");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("BAD_ZIP");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    out.push({
      name,
      data: () => {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(start, start + size);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error("ZIP_METHOD");
      },
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** EN: A ZIP without compression (enough for small templates). PT: Um ZIP sem compressão (basta para modelos pequenos). */
function writeZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // EN: UTF-8 names. PT: nomes em UTF-8.
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(f.data.length, 18);
    head.writeUInt32LE(f.data.length, 22);
    head.writeUInt16LE(name.length, 26);
    parts.push(head, name, f.data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(f.data.length, 20);
    dir.writeUInt32LE(f.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += 30 + name.length + f.data.length;
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dirSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

// ── XLSX ────────────────────────────────────────────────────────────────

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** EN: All text runs of a node (<t>…</t>). PT: Todo o texto de um nó. */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join("");

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** EN: The first sheet as rows of text (empty cells = ""). PT: A primeira folha como linhas de texto. */
export function readXlsx(buf: Buffer): string[][] {
  const entries = new Map(readZip(buf).map((e) => [e.name, e]));
  const shared = entries.get("xl/sharedStrings.xml");
  const strings = shared ? [...shared.data().toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  // EN: The first sheet in the workbook order. PT: A primeira folha pela ordem do livro.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = entries.get("xl/workbook.xml")?.data().toString("utf8");
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.data().toString("utf8");
  const rid = wb?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = rid && rels ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null;
  if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheet = entries.get(sheetPath);
  if (!sheet) throw new Error("NO_SHEET");
  const xml = sheet.data().toString("utf8");
  const rows: string[][] = [];
  for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNo = Number(r[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = strings[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (v !== undefined) value = unescapeXml(v);
      cells[ref ? colIndex(ref) : cells.length] = value.trim();
    }
    rows[rowNo - 1] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (x) => x ?? []);
}

/**
 * EN: One sheet with a bold header row; `lists` adds a pick list (▾) to a column for the next 1 000 rows.
 * PT: Uma folha com o cabeçalho a negrito; `lists` junta uma lista de escolha (▾) a uma coluna nas 1 000 linhas seguintes.
 */
export function writeXlsx(sheetName: string, rows: (string | number | null)[][], opts: { lists?: Record<number, string[]>; widths?: number[] } = {}): Buffer {
  const cell = (v: string | number | null, r: number, c: number) => {
    const ref = `${colName(c)}${r + 1}`;
    const style = r === 0 ? ' s="1"' : "";
    if (v === null || v === "") return "";
    if (typeof v === "number") return `<c r="${ref}"${style}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
  };
  const data = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join("")}</row>`).join("");
  const cols = opts.widths?.length ? `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const lists = Object.entries(opts.lists ?? {});
  const validations = lists.length
    ? `<dataValidations count="${lists.length}">${lists
        .map(([c, values]) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${colName(Number(c))}2:${colName(Number(c))}1001"><formula1>"${escapeXml(values.join(","))}"</formula1></dataValidation>`)
        .join("")}</dataValidations>`
    : "";
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData>${validations}</worksheet>`;
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": sheet,
  };
  return writeZip(Object.entries(files).map(([name, xml]) => ({ name, data: Buffer.from(xml, "utf8") })));
}
