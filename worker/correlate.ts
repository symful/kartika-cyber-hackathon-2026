import { all, first } from "./db";
import { hmacHex } from "./integrity";
import { getIncident, indicatorRows, indicatorIncidentCount, listIncidents, listCorrelations, upsertCorrelation } from "./queries";
import { blockedIndicators } from "./extras";
import correlationCfg from "../config/correlation.json";
import type { Correlation, Incident, IndicatorRow, Reason } from "./types";

const CFG = correlationCfg as {
  thresholds: { weak: number; moderate: number; strong: number };
  temporal: { nearHours: number; nearBonus: number; weekHours: number; weekBonus: number };
  specificity: { dfPenalty: number; commonDf: number; commonWeightCap: number; commonOnlyCap: number };
  blindMultiplier: number;
};

const kindWeight: Record<string, number> = {
  sha256: 100, email: 45, domain: 40, ip: 35, url: 30, md5: 25, lookalike: 20, filename: 15,
};

const kindLabel: Record<string, string> = {
  sha256: "file hash", email: "email address", domain: "domain", ip: "IP address",
  url: "URL", md5: "MD5 hash", lookalike: "lookalike domain", filename: "file name",
};

const genericKinds = new Set(["domain", "ip", "url", "email", "filename", "lookalike"]);

export const blindHash = async (salt: string, kind: string, norm: string): Promise<string> => {
  const sep = salt.indexOf(":");
  const version = sep > 0 ? salt.slice(0, sep) : "v1";
  const secret = sep > 0 ? salt.slice(sep + 1) : salt;
  const mac = await hmacHex(secret, version + ":" + kind + ":" + norm);
  return version + ":" + mac;
};

const blindKeys = (r: IndicatorRow): string[] =>
  [r.blind_hash, r.blind_hash_prev].filter((x): x is string => !!x);

const round1 = (n: number) => Math.round(n * 10) / 10;

function band(score: number) {
  if (score >= CFG.thresholds.strong) return "strong";
  if (score >= CFG.thresholds.moderate) return "moderate";
  if (score >= CFG.thresholds.weak) return "weak";
  return "none";
}

function entityKey(kind: string, norm: string): string {
  if (kind === "url") {
    try { return "host:" + new URL(norm).hostname.replace(/^www\./, ""); }
    catch { return "url:" + norm; }
  }
  if (kind === "domain" || kind === "lookalike") return "host:" + norm;
  if (kind === "ip") return "ip:" + norm;
  if (kind === "email") return "email:" + norm;
  if (kind === "sha256" || kind === "md5") return "hash:" + norm;
  return kind + ":" + norm;
}

type Match = {
  ra: IndicatorRow;
  rb: IndicatorRow;
  weight: number;
  blinded: boolean;
  common: boolean;
  df: number;
  base: number;
};

export async function scorePair(
  db: D1Database, a: Incident, b: Incident, salt: string, blockedSet?: Set<string>
): Promise<Correlation> {
  if (a.id > b.id) [a, b] = [b, a];
  const rowsA = await indicatorRows(db, a.id);
  const rowsB = await indicatorRows(db, b.id);
  const blocked = blockedSet ?? (await blockedIndicators(db));
  const activeA = rowsA.filter((r) => !blocked.has(r.id));
  const activeB = rowsB.filter((r) => !blocked.has(r.id));
  const sameUnit = !!a.unit && a.unit === b.unit;

  const byNorm = new Map<string, IndicatorRow>();
  const byBlind = new Map<string, IndicatorRow>();
  for (const rb of activeB) {
    if (rb.shared || sameUnit) byNorm.set(rb.kind + "|" + rb.norm_value, rb);
    for (const h of blindKeys(rb)) byBlind.set(rb.kind + "|" + h, rb);
  }

  // One contribution per canonical entity, so a URL and its host do not count twice.
  const matches = new Map<string, Match>();

  for (const ra of activeA) {
    const base = kindWeight[ra.kind];
    if (!base) continue;
    const key = ra.kind + "|" + ra.norm_value;

    let rb: IndicatorRow | null = null;
    let blinded = false;
    if (sameUnit || ra.shared) {
      rb = byNorm.get(key) ?? null;
      if (!rb) {
        for (const h of blindKeys(ra)) {
          const cand = byBlind.get(ra.kind + "|" + h) ?? null;
          if (cand) { rb = cand; blinded = true; break; }
        }
      }
    } else {
      for (const h of blindKeys(ra)) {
        const cand = byBlind.get(ra.kind + "|" + h) ?? null;
        if (cand) { rb = cand; blinded = true; break; }
      }
    }
    if (!rb) continue;

    let weight = base;
    let common = false;
    let df = 2;
    if (genericKinds.has(ra.kind)) {
      df = await indicatorIncidentCount(db, ra.kind, ra.norm_value);
      if (df <= 0) df = 2;
      weight = base / (1 + CFG.specificity.dfPenalty * (df - 1));
      if (df >= CFG.specificity.commonDf) {
        common = true;
        weight = Math.min(weight, 2);
      }
    }
    if (blinded) weight *= CFG.blindMultiplier;

    const entity = entityKey(ra.kind, ra.norm_value);
    const prev = matches.get(entity);
    if (!prev || weight > prev.weight) {
      matches.set(entity, { ra, rb, weight, blinded, common, df, base });
    }
  }

  const reasons: Reason[] = [];
  let normalTotal = 0;
  let commonTotal = 0;

  for (const m of matches.values()) {
    const label = kindLabel[m.ra.kind];
    const value = m.blinded ? "•••••• (blinded)" : m.ra.norm_value;
    let detail = `${label} match across both reports`;
    if (m.weight < m.base) detail += ` (specificity adjusted: seen in ${m.df} incidents)`;
    if (m.blinded) detail += " via blinded matching, raw value not disclosed";
    if (m.common) detail += "; treated as common infrastructure, contribution capped";

    if (m.common) commonTotal += m.weight;
    else normalTotal += m.weight;

    reasons.push({
      kind: m.ra.kind,
      value,
      weight: round1(m.common ? 0 : m.weight),
      detail,
      artifact_a: m.ra.artifact_id,
      artifact_b: m.rb.artifact_id,
      provenance_a: m.ra.source,
      provenance_b: m.rb.source,
      blinded: m.blinded,
      common: m.common,
    });
  }

  let total: number;
  if (normalTotal === 0) {
    total = Math.min(commonTotal, CFG.specificity.commonOnlyCap);
  } else {
    total = normalTotal + Math.min(commonTotal, CFG.specificity.commonWeightCap);
  }

  const gapHours = temporalGap(a.occurred_at, b.occurred_at);
  if (normalTotal > 0) {
    if (gapHours >= 0 && gapHours <= CFG.temporal.nearHours) {
      total += CFG.temporal.nearBonus;
      reasons.push({ kind: "temporal", value: `${round1(gapHours)}h`, weight: CFG.temporal.nearBonus, detail: `observations are ${round1(gapHours)} hours apart` });
    } else if (gapHours <= CFG.temporal.weekHours) {
      total += CFG.temporal.weekBonus;
      reasons.push({ kind: "temporal", value: `${round1(gapHours)}h`, weight: CFG.temporal.weekBonus, detail: `observations are ${round1(gapHours)} hours apart` });
    }
  }

  if (total > 100) total = 100;
  reasons.sort((x, y) => y.weight - x.weight);
  return {
    id: "", a_id: a.id, b_id: b.id, score: round1(total), band: band(total),
    reasons, status: "open", created_at: new Date().toISOString(),
  };
}

function temporalGap(a: string, b: string): number {
  const ta = Date.parse(a), tb = Date.parse(b);
  if (isNaN(ta) || isNaN(tb)) return -1;
  return Math.abs(ta - tb) / 3600000;
}

export async function recomputeFor(db: D1Database, incidentId: string, salt: string): Promise<Correlation[]> {
  const a = await getIncident(db, incidentId);
  if (!a) return [];
  const others = await listIncidents(db);
  const out: Correlation[] = [];
  for (const b of others) {
    if (b.id === a.id) continue;
    const c = await scorePair(db, a, b, salt);
    if (c.score >= 25) {
      await upsertCorrelation(db, c);
      out.push(c);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

export async function recomputeAll(db: D1Database, salt: string) {
  const inc = await listIncidents(db);
  for (const i of inc) await recomputeFor(db, i.id, salt);
}

export type GraphData = {
  nodes: { id: string; kind: string; label: string; score?: number; unit?: string }[];
  edges: { from: string; to: string; label: string; weight: number }[];
};

export async function buildGraph(db: D1Database): Promise<GraphData> {
  const inc = await listIncidents(db);
  const g: GraphData = { nodes: [], edges: [] };
  for (const i of inc) {
    g.nodes.push({ id: i.id, kind: "incident", label: `${i.code} · ${i.title}`, unit: i.unit, score: i.max_score });
  }
  const cors = await listCorrelations(db);
  const nodeIDs = new Set(g.nodes.map((n) => n.id));
  for (const c of cors) {
    if (c.score < 45) continue;
    g.edges.push({ from: c.a_id, to: c.b_id, label: String(Math.round(c.score)), weight: c.score });
    for (const r of c.reasons) {
      if (r.kind === "temporal" || r.common || r.weight < 20) continue;
      const nid = `ioc:${r.kind}:${r.value}`;
      if (!nodeIDs.has(nid)) {
        nodeIDs.add(nid);
        g.nodes.push({ id: nid, kind: "indicator", label: r.value.length > 28 ? r.value.slice(0, 25) + "..." : r.value, score: r.weight });
      }
      g.edges.push({ from: c.a_id, to: nid, label: "", weight: r.weight });
      g.edges.push({ from: c.b_id, to: nid, label: "", weight: r.weight });
    }
  }
  return g;
}

export async function uniqueIndicatorCount(db: D1Database): Promise<number> {
  const row = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM indicators`);
  return row?.n ?? 0;
}

export async function allCorrelations(db: D1Database) {
  return await listCorrelations(db);
}

export async function incidentPair(db: D1Database, id: string) {
  return await getIncident(db, id);
}

export async function auditCount(db: D1Database) {
  return (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM audit`))?.n ?? 0;
}

export async function settingsRows(db: D1Database) {
  return await all<{ key: string; value: string }>(db, `SELECT key,value FROM settings ORDER BY key`);
}
