import ruleset from "../config/yara.json";

export type RuleMatch = {
  rule: string;
  description: string;
  severity: string;
  tags: string[];
  matches: string[];
};

type RuleDef = {
  name: string;
  description: string;
  severity: string;
  tags: string[];
  condition: "any" | "all";
  strings: {
    type: "text" | "hex" | "regex";
    value: string;
    nocase?: boolean;
    wide?: boolean;
  }[];
};

const RULES: RuleDef[] = (ruleset as { rules: RuleDef[] }).rules;

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, "");
  const out: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

function findHex(data: Uint8Array, hex: string): boolean {
  const sig = hexToBytes(hex);
  if (!sig.length) return false;
  const limit = data.length - sig.length;
  for (let i = 0; i <= limit; i++) {
    let hit = true;
    for (let j = 0; j < sig.length; j++) {
      if (data[i + j] !== sig[j]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

function wide(text: string): string {
  return [...text].map((c) => c + "\u0000").join("");
}

function findText(haystack: string, needle: string, opts: { nocase?: boolean; wide?: boolean }): string | null {
  const candidates = opts.wide ? [wide(needle), needle] : [needle];
  for (const c of candidates) {
    if (!c) continue;
    if (opts.nocase) {
      const idx = haystack.toLowerCase().indexOf(c.toLowerCase());
      if (idx >= 0) return needle;
    } else {
      const idx = haystack.indexOf(c);
      if (idx >= 0) return needle;
    }
  }
  return null;
}

// A small, deterministic YARA-compatible subset: text, wide text, hex, and
// regex atoms with any/all conditions. It runs fully offline and never executes
// the sample.
export function matchRules(data: Uint8Array, text: string): RuleMatch[] {
  const out: RuleMatch[] = [];
  for (const rule of RULES) {
    const hits: string[] = [];
    let evaluated = 0;
    let satisfied = 0;

    for (const s of rule.strings) {
      evaluated++;
      let hit = false;
      if (s.type === "hex") {
        hit = findHex(data, s.value);
      } else if (s.type === "regex") {
        try {
          hit = new RegExp(s.value).test(text);
        } catch {
          hit = false;
        }
      } else {
        hit = findText(text, s.value, { nocase: s.nocase, wide: s.wide }) !== null;
      }
      if (hit) { satisfied++; hits.push(s.value); }
    }

    const matched = rule.condition === "all" ? satisfied === evaluated && evaluated > 0 : satisfied > 0;
    if (matched) {
      out.push({
        rule: rule.name,
        description: rule.description,
        severity: rule.severity,
        tags: rule.tags,
        matches: hits.slice(0, 6),
      });
    }
  }
  return out;
}

export function verdictFor(matches: RuleMatch[], extra: { mismatch: boolean; macro: boolean }): string {
  if (matches.some((m) => m.severity === "high")) return "malicious";
  if (matches.some((m) => m.severity === "medium") || extra.macro || extra.mismatch) return "suspicious";
  if (matches.length > 0) return "low-risk";
  return "clean";
}
