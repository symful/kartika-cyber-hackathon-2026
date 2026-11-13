export type IOC = {
  kind: string;
  value: string;
  norm: string;
  seen: string;
  source: string;
};

const reEmail = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,24}/gi;
const reURL = /\b(?:https?|hxxps?|ftp):\/\/[^\s"'<>)\]]+/gi;
const reSHA256 = /\b[a-f0-9]{64}\b/gi;
const reMD5 = /\b[a-f0-9]{32}\b/gi;
const reIPv4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const reDomain = /\b(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi;
const reFilename =
  /\b[a-z0-9][a-z0-9._\-]{0,80}\.(?:zip|rar|7z|pdf|docm?|xlsm?|pptm?|html?|js|lnk|scr|bat|ps1|exe|apk|iso|txt|csv)\b/gi;

const fileExt = new Set([
  "pdf","doc","docx","docm","xls","xlsx","xlsm","ppt","pptx","zip","rar","7z","exe","dll",
  "html","htm","js","txt","csv","log","png","jpg","jpeg","gif","mp4","lnk","scr","bat",
  "ps1","json","xml","eml","msg","apk","iso","md","css","py","go",
]);

const publicInfra = new Set([
  "gmail.com","googlemail.com","outlook.com","hotmail.com","live.com","yahoo.com","icloud.com",
  "google.com","microsoft.com","office.com","apple.com","amazonaws.com","cloudflare.com",
  "akamai.net","github.com","githubusercontent.com","facebook.com","instagram.com","twitter.com",
  "x.com","linkedin.com","whatsapp.com","t.me","bit.ly","youtube.com","wikipedia.org",
  "mozilla.org","windowsupdate.com","digicert.com",
]);

const brands = ["kartika", "kartikacsirt", "tniad", "tni-ad", "pussiberad", "codepolitan"];

// A domain needs a plausible TLD. Without this, "staf.keuangan" from a log
// column looks like a domain and creates false correlations.
const validTLD = new Set([
  "com","net","org","edu","gov","mil","int","io","co","id","my","sg","au","uk","us",
  "ru","cn","jp","kr","de","fr","nl","br","in","ph","th","vn","info","biz","xyz",
  "online","site","shop","top","club","app","dev","cloud","tech","ai","me","tv","cc",
  "ws","tk","ml","ga","cf","gq","link","live","pro","example","test","invalid",
  "localhost","onion","ac","asia","biz.id","co.id","or.id","go.id","mil.id",
]);

const CONFUSABLES: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ѕ: "s", ԁ: "d",
  ӏ: "l", һ: "h", ѵ: "v", ԛ: "q", ԝ: "w", ɡ: "g", ɩ: "i", ʏ: "y", α: "a", ο: "o",
  ρ: "p", ν: "v", τ: "t", ı: "i", ȷ: "j", ℓ: "l",
};

export function normalize(s: string): string {
  return s
    .replace(/hxxps/gi, "https")
    .replace(/hxxp/gi, "http")
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\((at)\)|\[at\]|\[@\]/gi, "@")
    .trim()
    .replace(/^["'<>()\[\]{},;]+|["'<>()\[\]{},;]+$/g, "")
    .toLowerCase();
}

export function dehomoglyph(s: string): string {
  return [...s].map((ch) => CONFUSABLES[ch] ?? ch).join("");
}

const stripWWW = (s: string) => s.replace(/^www\./, "");

function validDomain(d: string): boolean {
  if (!d || !d.includes(".") || d.length > 253) return false;
  const labels = d.split(".");
  const tld = labels[labels.length - 1];
  if (fileExt.has(tld) || tld.length < 2) return false;
  if (!validTLD.has(tld)) return false;
  return labels.every((l) => l.length > 0 && l.length <= 63);
}

function levenshtein(a: string, b: string): number {
  const ra = [...a], rb = [...b];
  let prev = Array.from({ length: rb.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ra.length; i++) {
    const cur = [i];
    for (let j = 1; j <= rb.length; j++) {
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (ra[i - 1] === rb[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[rb.length];
}

export function lookalike(domain: string): string | null {
  const base = dehomoglyph(domain.toLowerCase());
  const first = base.split(".")[0];
  if (domain.startsWith("xn--") || domain.includes(".xn--")) return "IDN punycode label";
  for (const b of brands) {
    if (base !== domain && base.includes(b)) return "homograph of " + b;
    if (first !== b && levenshtein(first, b) === 1) return "typosquat near " + b;
  }
  return null;
}

export function extract(text: string, source: string, seen: string): IOC[] {
  const out: IOC[] = [];
  const add = (kind: string, value: string, norm: string) => {
    if (norm) out.push({ kind, value, norm, seen, source });
  };
  const t = text.replace(/hxxps/gi, "https").replace(/hxxp/gi, "http").replace(/\[\.\]|\(\.\)/g, ".");

  for (const m of t.matchAll(reEmail)) {
    const n = m[0].toLowerCase().replace(/[.,;]+$/, "");
    add("email", m[0], n);
  }
  for (const m of t.matchAll(reURL)) {
    try {
      const u = new URL(normalize(m[0]));
      const host = stripWWW(u.hostname.toLowerCase());
      add("url", m[0], u.protocol + "//" + host + u.pathname);
      if (validDomain(host) && !publicInfra.has(host)) add("domain", host, host);
    } catch {
      /* ignore malformed */
    }
  }
  for (const m of t.matchAll(reSHA256)) add("sha256", m[0], m[0].toLowerCase());
  for (const m of t.matchAll(reMD5)) add("md5", m[0], m[0].toLowerCase());
  for (const m of t.matchAll(reIPv4)) {
    const ip = m[0];
    const parts = ip.split(".").map(Number);
    if (parts.every((p) => p >= 0 && p <= 255)) add("ip", ip, ip);
  }
  for (const m of t.matchAll(reFilename)) add("filename", m[0], m[0].toLowerCase());
  for (const m of t.matchAll(reDomain)) {
    const d = stripWWW(m[0].toLowerCase().replace(/\.$/, ""));
    if (!validDomain(d) || publicInfra.has(d)) continue;
    add("domain", m[0], d);
    const why = lookalike(d);
    if (why) add("lookalike", d, d + " | " + why);
  }
  return dedupe(out);
}

export function dedupe(inp: IOC[]): IOC[] {
  const seen = new Set<string>();
  const out: IOC[] = [];
  for (const i of inp) {
    const k = i.kind + "|" + i.norm;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.norm.localeCompare(b.norm) : a.kind.localeCompare(b.kind)));
}
