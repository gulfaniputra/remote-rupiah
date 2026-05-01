export interface CsvPreview { headers: string[]; rows: Record<string, string>[]; totalRowCount: number }

export function parseCsvStream(csv: string, maxRows = 5): CsvPreview {
  const t = csv.trim();
  if (!t) return { headers: [], rows: [], totalRowCount: 0 };
  const lines = splitLines(t), headers = parseLine(lines[0]);
  const data = lines.slice(1).filter(l => l.trim());
  return { headers, totalRowCount: data.length,
    rows: data.slice(0, maxRows).map(line => { const v = parseLine(line); return Object.fromEntries(headers.map((h, j) => [h, v[j] ?? ""])); }) };
}

export async function parseCsvFromStream(stream: ReadableStream<Uint8Array>, maxRows = 5): Promise<CsvPreview> {
  const r = stream.getReader(), d = new TextDecoder();
  let s = "";
  for (let chunk = await r.read(); !chunk.done; chunk = await r.read()) s += d.decode(chunk.value, { stream: true });
  return parseCsvStream(s + d.decode(), maxRows);
}

function splitLines(text: string): string[] {
  const lines: string[] = []; let cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { q = !q; cur += c; }
    else if ((c === "\n" || c === "\r") && !q) { if (c === "\r" && text[i+1] === "\n") i++; lines.push(cur); cur = ""; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines;
}

function parseLine(line: string): string[] {
  const fields: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { fields.push(cur); cur = ""; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}
