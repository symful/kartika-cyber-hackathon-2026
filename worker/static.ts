import { unzipSync } from "fflate";
import type { FileAnalysis } from "./types";
import { matchRules, verdictFor, type RuleMatch } from "./yara";

type AnalysisResult = Omit<FileAnalysis, "artifact_id" | "created_at"> & { rules: RuleMatch[]; verdict: string };

const MAGIC: { sig: number[]; type: string; exts: string[] }[] = [
  { sig: [0x25, 0x50, 0x44, 0x46], type: "PDF", exts: ["pdf"] },
  { sig: [0x4d, 0x5a], type: "Windows PE", exts: ["exe", "dll", "scr", "sys"] },
  { sig: [0x50, 0x4b, 0x03, 0x04], type: "ZIP / OOXML", exts: ["zip", "docx", "xlsx", "pptx", "jar", "apk"] },
  { sig: [0x7f, 0x45, 0x4c, 0x46], type: "ELF", exts: ["elf", "bin", "so"] },
  { sig: [0x89, 0x50, 0x4e, 0x47], type: "PNG", exts: ["png"] },
  { sig: [0xff, 0xd8, 0xff], type: "JPEG", exts: ["jpg", "jpeg"] },
  { sig: [0x52, 0x61, 0x72, 0x21], type: "RAR", exts: ["rar"] },
  { sig: [0x37, 0x7a, 0xbc, 0xaf], type: "7-Zip", exts: ["7z"] },
  { sig: [0xd0, 0xcf, 0x11, 0xe0], type: "OLE (MS Office legacy)", exts: ["doc", "xls", "ppt", "msg"] },
];

const DOCUMENT_EXTS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"]);

const SUSPICIOUS = [
  "powershell", "cmd.exe", "wscript", "cscript", "createobject", "autoopen", "document_open",
  "vba", "base64", "mimikatz", "invoke-expression", "certutil", "regsvr32", "rundll32", "mshta",
  "wmic", "schtasks", "bitsadmin",
];

function detect(data: Uint8Array): { type: string; expected: string[] } {
  for (const m of MAGIC) {
    if (m.sig.every((b, i) => data[i] === b)) return { type: m.type, expected: m.exts };
  }
  return { type: "Unknown / text", expected: [] };
}

function shannon(data: Uint8Array): number {
  if (!data.length) return 0;
  const counts = new Array<number>(256).fill(0);
  const limit = Math.min(data.length, 1 << 20);
  for (let i = 0; i < limit; i++) counts[data[i]]++;
  let h = 0;
  for (const c of counts) {
    if (!c) continue;
    const p = c / limit;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 100) / 100;
}

function ascii(data: Uint8Array, limit = 400_000): string {
  const n = Math.min(data.length, limit);
  let s = "";
  let last = 0;
  for (let i = 0; i < n; i++) {
    const c = data[i];
    if (c === 0 || c < 9 || (c > 13 && c < 32) || c > 126) {
      s += " ";
      if (++last > 4096) break;
    } else {
      last = 0;
      s += String.fromCharCode(c);
    }
  }
  return s;
}

function peInfo(data: Uint8Array): { machine: string; sections: number; compiled: string } | null {
  if (data.length < 0x40 || data[0] !== 0x4d || data[1] !== 0x5a) return null;
  try {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const pe = dv.getUint32(0x3c, true);
    if (pe + 24 > data.length) return null;
    if (data[pe] !== 0x50 || data[pe + 1] !== 0x45) return null;
    const machine = dv.getUint16(pe + 4, true);
    const sections = dv.getUint16(pe + 6, true);
    const ts = dv.getUint32(pe + 8, true);
    return {
      machine: "0x" + machine.toString(16),
      sections,
      compiled: ts ? new Date(ts * 1000).toISOString() : "",
    };
  } catch {
    return null;
  }
}

const MAX_ENTRIES = 200;
const MAX_ENTRY_BYTES = 10 << 20;
const MAX_TOTAL_BYTES = 50 << 20;

export function analyzeBytes(data: Uint8Array, filename: string): AnalysisResult {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const { type } = detect(data);
  const text = ascii(data);

  const urls = Array.from(new Set((text.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? []).map((u) => u.slice(0, 200)))).slice(0, 10);
  const lower = text.toLowerCase();
  const hits = SUSPICIOUS.filter((k) => lower.includes(k)).slice(0, 12);

  let macro = false;
  let nested = false;
  let bomb = false;
  let malformed = false;
  const explanations: string[] = [];
  const metadata: Record<string, string | number> = {};
  const rules = matchRules(data, text);

  if (type === "ZIP / OOXML") {
    let entries = 0;
    let total = 0;
    try {
      const files = unzipSync(data, {
        filter: (f) => {
          if (entries++ >= MAX_ENTRIES) { bomb = true; return false; }
          const size = f.originalSize ?? f.size ?? 0;
          if (size > MAX_ENTRY_BYTES) { bomb = true; return false; }
          total += size;
          if (total > MAX_TOTAL_BYTES) { bomb = true; return false; }
          return true;
        },
      });
      const names = Object.keys(files);
      nested = names.length > 0;
      metadata.entries = names.length;
      metadata.uncompressed_bytes = total;
      if (total > 5 << 20 && total / Math.max(data.length, 1) > 100) bomb = true;

      macro = names.some((n) => /vbaProject\.bin$/i.test(n) || /macros/i.test(n));
      if (!macro) macro = names.some((n) => /\.(exe|dll|js|vbs|scr|lnk)$/i.test(n));

      let inner = "";
      for (const n of names.slice(0, 30)) {
        if (!/\.(xml|txt|html?|js|vbs|rels)$/i.test(n)) continue;
        const bytes = files[n];
        if (bytes && bytes.length < 400_000) inner += ascii(bytes, 400_000) + "\n";
        if (inner.length > 800_000) break;
      }
      if (inner) {
        for (const r of matchRules(data, inner)) {
          const existing = rules.find((x) => x.rule === r.rule);
          if (!existing) rules.push(r);
        }
      }
    } catch {
      malformed = true;
    }
  } else if (type === "PDF") {
    metadata.pdf_javascript = /\/javascript|\/openaction|\/launch/i.test(text) ? "yes" : "no";
  }

  const pe = peInfo(data);
  if (pe) {
    metadata.pe_machine = pe.machine;
    metadata.pe_sections = pe.sections;
    if (pe.compiled) metadata.pe_compiled = pe.compiled;
  }

  const expectedByExt = MAGIC.find((m) => m.exts.includes(ext));
  const mismatch =
    (expectedByExt !== undefined && expectedByExt.type !== type) ||
    (DOCUMENT_EXTS.has(ext) && (type === "Windows PE" || type === "ELF"));

  if (bomb) {
    rules.push({ rule: "archive_bomb", description: "Rasio dekompresi ekstrem atau ukuran arsip melebihi batas aman.", severity: "high", tags: ["archive", "denial-of-service"], matches: [] });
    explanations.push("Arsip melewati batas entri, ukuran, atau rasio dekompresi. Isi tidak diekstrak lebih lanjut.");
  }
  if (malformed) {
    rules.push({ rule: "archive_malformed", description: "Struktur arsip rusak atau tidak lengkap.", severity: "low", tags: ["archive"], matches: [] });
    explanations.push("Arsip gagal dibaca. Bisa jadi rusak, terpotong, atau sengaja dibuat tidak valid.");
  }
  if (mismatch) explanations.push(`Ekstensi .${ext} tidak cocok dengan tipe sebenarnya ${type}.`);
  if (macro) explanations.push("Ditemukan makro atau entri executable di dalam dokumen. Dokumen kantor normal tidak memuat ini.");
  if (pe) explanations.push(`Executable Windows terdeteksi (${pe.machine}, ${pe.sections} seksi).`);
  for (const r of rules) {
    if (r.rule === "archive_bomb" || r.rule === "archive_malformed") continue;
    if (r.severity === "high") explanations.push(`${r.description} (${r.rule})`);
  }

  const entropy = shannon(data);
  if (entropy >= 7.2) {
    explanations.push(
      type === "ZIP / OOXML" || type === "PDF"
        ? `Entropi ${entropy} wajar untuk berkas terkompresi atau terenkripsi.`
        : `Entropi ${entropy} sangat tinggi untuk tipe ${type}, indikasi muatan terenkripsi atau dipaket ulang.`
    );
  }

  return {
    file_type: type,
    extension: ext,
    mismatch,
    entropy,
    embedded_urls: urls,
    suspicious_strings: hits,
    macro,
    nested,
    rules,
    verdict: verdictFor(rules, { mismatch, macro }),
    metadata,
    explanations,
  };
}
