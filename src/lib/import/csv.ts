/**
 * EN: Small RFC 4180 CSV reader (quotes, "" escapes, line breaks inside quotes). Returns one object per row,
 *     keyed by the header. Enough for Shopify exports without an extra dependency.
 * PT: Leitor de CSV (aspas, "" e quebras de linha dentro de aspas). Devolve um objecto por linha, com as colunas
 *     do cabeçalho. Chega para as exportações do Shopify sem mais dependências.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // EN: drop BOM. PT: tirar o BOM.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}
