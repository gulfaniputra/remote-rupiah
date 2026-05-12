import { parse, CsvParseStream } from "@std/csv";

export interface CsvPreview { headers: string[]; rows: Record<string, string>[]; totalRowCount: number }

/**
 * Parses a CSV string and returns a preview.
 * Note: Still kept for compatibility, but parseCsvFromStream is preferred for memory safety.
 */
export function parseCsvStream(csv: string, maxRows = 5): CsvPreview {
  const records = parse(csv, { skipFirstRow: false }) as string[][];
  if (records.length === 0) return { headers: [], rows: [], totalRowCount: 0 };
  
  const headers = records[0];
  const data = records.slice(1);
  const rows = data.slice(0, maxRows).map(v => 
    Object.fromEntries(headers.map((h, j) => [h, v[j] ?? ""]))
  );
  
  return { headers, rows, totalRowCount: data.length };
}

/**
 * Parses a CSV stream without loading the entire file into memory.
 */
export async function parseCsvFromStream(stream: ReadableStream<Uint8Array>, maxRows = 5): Promise<CsvPreview> {
  const lineStream = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream());

  let headers: string[] = [];
  const rows: Record<string, string>[] = [];
  let count = 0;

  for await (const record of lineStream) {
    if (count === 0) {
      headers = record;
    } else {
      if (rows.length < maxRows) {
        rows.push(Object.fromEntries(headers.map((h, i) => [h, record[i] ?? ""])));
      }
    }
    count++;
  }

  return { headers, rows, totalRowCount: Math.max(0, count - 1) };
}
