import { unzipSync, strFromU8 } from "fflate";
import { extract, dedupe, type IOC } from "./ioc";
import { sha256Hex, bytes } from "./integrity";

export type ParsedEvent = { ts: string; kind: string; title: string; detail: string };
export type Parsed = { indicators: IOC[]; events: ParsedEvent[]; summary: string };

const dec = new TextDecoder("utf-8", { fatal: false });
const isTexty = (u: Uint8Array) => {
  const n = Math.min(u.length, 4096);
  for (let i = 0; i < n; i++) {
    const c = u[i];
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) return false;
  }
  return true;
};
const truncate = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n) + "…");

function summarize(p: Parsed): string {
  if (!p.indicators.length) return "No comparable indicators were found in this artifact.";
  const counts: Record<string, number> = {};
  for (const i of p.indicators) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
  const order = ["domain", "ip", "url", "email", "sha256", "filename", "lookalike", "md5"];
  return "Extracted " + order.filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`).join(", ") + ".";
}

export async function parseArtifact(data: Uint8Array, filename: string, mime: string): Promise<Parsed> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "eml" || mime.includes("message/rfc822")) return parseEML(data, filename);
  if (ext === "csv") return parseCSV(data, filename);
  if (ext === "zip") return parseZIP(data, filename);
  if (["txt", "log", "md", "json"].includes(ext) || (isTexty(data) && !mime.startsWith("image/"))) {
    return parseText(dec.decode(data), filename);
  }
  const p: Parsed = { indicators: [{ kind: "filename", value: filename, norm: filename.toLowerCase(), seen: new Date().toISOString(), source: "artifact" }], events: [], summary: "" };
  p.summary = summarize(p);
  return p;
}

function parseText(text: string, filename: string): Parsed {
  const p: Parsed = { indicators: [], events: [], summary: "" };
  const seenDefault = new Date().toISOString();
  text.split(/\r?\n/).forEach((line, idx) => {
    if (!line.trim()) return;
    const src = `${filename} line ${idx + 1}`;
    p.indicators.push(...extract(line, src, seenDefault));
    const ts = leadingTimestamp(line);
    if (ts) p.events.push({ ts, kind: "log", title: "Observation in " + filename, detail: truncate(line.trim(), 220) });
  });
  p.indicators = dedupe(p.indicators);
  p.summary = summarize(p);
  return p;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCSV(data: Uint8Array, filename: string): Parsed {
  const p: Parsed = { indicators: [], events: [], summary: "" };
  const lines = dec.decode(data).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return parseText("", filename);
  const header = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
  let tsIdx = -1;
  header.forEach((h, i) => {
    if (["ts","time","timestamp","datetime","date","@timestamp","event_time","waktu"].includes(h)) tsIdx = i;
  });
  const eventIdx = header.indexOf("event") >= 0 ? header.indexOf("event") : header.indexOf("action");
  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    const line = row.join(" ");
    const seen = tsIdx >= 0 ? parseTime(row[tsIdx]) ?? new Date().toISOString() : new Date().toISOString();
    p.indicators.push(...extract(line, `${filename} row ${i + 1}`, seen));
    if (tsIdx >= 0) {
      p.events.push({
        ts: seen,
        kind: "log",
        title: truncate(eventIdx >= 0 ? row[eventIdx] || "Log event" : "Log event", 80),
        detail: truncate(line, 240),
      });
    }
    if (p.events.length >= 120) break;
  }
  p.indicators = dedupe(p.indicators);
  p.summary = summarize(p);
  return p;
}

function parseHeaders(raw: string): { headers: Record<string, string>; body: string } {
  const idx = raw.search(/\r?\n\r?\n/);
  const head = idx >= 0 ? raw.slice(0, idx) : raw;
  const body = idx >= 0 ? raw.slice(idx).replace(/^\r?\n\r?\n/, "") : "";
  const headers: Record<string, string> = {};
  let last = "";
  for (const line of head.split(/\r?\n/)) {
    if (/^\s/.test(line) && last) {
      headers[last] += " " + line.trim();
      continue;
    }
    const m = line.match(/^([A-Za-z0-9\-]+):\s*(.*)$/);
    if (m) {
      last = m[1].toLowerCase();
      headers[last] = m[2].trim();
    }
  }
  return { headers, body };
}

function qpDecode(s: string): string {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function b64Decode(s: string): Uint8Array {
  try {
    return Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function fileNameOf(headers: Record<string, string>): string {
  const cd = headers["content-disposition"] ?? "";
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1].replace(/^"|"$/g, ""));
  const plain = cd.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : "";
}

async function walkMime(raw: string, filename: string, seen: string, p: Parsed, depth = 0): Promise<void> {
  if (depth > 3) return;
  const { headers, body } = parseHeaders(raw);
  const ct = headers["content-type"] ?? "";
  const boundary = ct.match(/boundary="?([^";]+)"?/i)?.[1];
  if (ct.toLowerCase().startsWith("multipart/") && boundary) {
    const chunks = body.split(new RegExp("--" + boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:--)?"));
    for (const chunk of chunks) {
      if (!chunk.trim() || chunk.trim() === "--") continue;
      await walkMime(chunk.trim(), filename, seen, p, depth + 1);
    }
    return;
  }
  const name = fileNameOf(headers);
  if (name) {
    const enc = (headers["content-transfer-encoding"] ?? "").toLowerCase();
    const data = enc.includes("base64") ? b64Decode(body) : bytes(enc.includes("quoted-printable") ? qpDecode(body) : body);
    const sum = await sha256Hex(data);
    p.indicators.push({ kind: "sha256", value: sum, norm: sum, seen, source: `${filename} attachment ${name}` });
    p.indicators.push({ kind: "filename", value: name, norm: name.toLowerCase(), seen, source: `${filename} attachment` });
    p.events.push({ ts: seen, kind: "attachment", title: "Attachment: " + name, detail: "SHA-256 " + sum });
    return;
  }
  if (ct.toLowerCase().startsWith("text/")) {
    const enc = (headers["content-transfer-encoding"] ?? "").toLowerCase();
    const text = enc.includes("quoted-printable") ? qpDecode(body) : body;
    p.indicators.push(...extract(text, `${filename} body`, seen));
  }
}

async function parseEML(data: Uint8Array, filename: string): Promise<Parsed> {
  const p: Parsed = { indicators: [], events: [], summary: "" };
  const raw = dec.decode(data);
  const { headers, body } = parseHeaders(raw);
  let seen = new Date().toISOString();
  if (headers.date) {
    const d = new Date(headers.date);
    if (!isNaN(d.getTime())) seen = d.toISOString();
  }
  for (const h of ["from", "reply-to", "return-path", "to", "cc", "subject", "message-id"]) {
    if (headers[h]) p.indicators.push(...extract(headers[h], `${filename} header ${h}`, seen));
  }
  if (headers.date) {
    p.events.push({ ts: seen, kind: "email", title: "Email received", detail: truncate(`From: ${headers.from ?? ""}  Subject: ${headers.subject ?? ""}`, 240) });
  }
  if ((headers["content-type"] ?? "").toLowerCase().startsWith("multipart/") && /boundary=/i.test(headers["content-type"] ?? "")) {
    await walkMime(raw, filename, seen, p);
  } else {
    p.indicators.push(...extract(body, `${filename} body`, seen));
  }
  p.indicators = dedupe(p.indicators);
  p.summary = summarize(p);
  return p;
}

async function parseZIP(data: Uint8Array, filename: string): Promise<Parsed> {
  const p: Parsed = { indicators: [], events: [], summary: "" };
  const seen = new Date().toISOString();
  try {
    const files = unzipSync(data);
    for (const [name, content] of Object.entries(files)) {
      if (name.endsWith("/")) continue;
      p.indicators.push({ kind: "filename", value: name, norm: name.toLowerCase(), seen, source: `${filename} entry` });
      const sum = await sha256Hex(content);
      p.indicators.push({ kind: "sha256", value: sum, norm: sum, seen, source: `${filename} entry ${name}` });
      if (isTexty(content) && content.length < 2 << 20) {
        p.indicators.push(...extract(strFromU8(content), `${filename} → ${name}`, seen));
      }
      p.events.push({ ts: seen, kind: "archive", title: "Archive entry: " + name, detail: "SHA-256 " + sum });
    }
  } catch {
    p.indicators.push({ kind: "filename", value: filename, norm: filename.toLowerCase(), seen, source: "artifact" });
  }
  p.indicators = dedupe(p.indicators);
  p.summary = summarize(p);
  return p;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseTime(s: string): string | null {
  s = (s ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] ?? 0)));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function leadingTimestamp(line: string): string | null {
  const parts = line.trim().split(/\s+/);
  if (!parts.length) return null;
  return parseTime(parts[0]) ?? (parts[1] ? parseTime(parts[0] + " " + parts[1]) : null);
}

export function localTimestamp(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
