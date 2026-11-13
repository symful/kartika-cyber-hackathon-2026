import { all, first, run, uid } from "./db";
import { addIndicator, createIncident } from "./queries";
import { initIndicatorMeta, blockedIndicators } from "./extras";
import { blindHash, scorePair } from "./correlate";
import { sha256Hex } from "./integrity";
import type { Incident } from "./types";

export type ScenarioResult = {
  name: string;
  expected: "link" | "no_link";
  actual: "link" | "no_link";
  score: number;
  pass: boolean;
  note: string;
};

/** Adversarial pairs, each created, scored, and removed independently. */
export async function runAdversarial(db: D1Database, salt: string): Promise<ScenarioResult[]> {
  const threshold = 45;
  const out: ScenarioResult[] = [];
  const blocked = await blockedIndicators(db);

  const createIncidentRow = async (code: string, occurred: string): Promise<string> => {
    const id = uid();
    await createIncident(db, {
      id, code, title: "Adversarial " + code, category: "Phishing", severity: "medium",
      status: "open", unit: "Satuan Adversarial", reporter: "benchmark",
      summary: "synthetic adversarial incident", occurred_at: occurred, created_by: "benchmark",
    });
    return id;
  };

  const add = async (incidentId: string, kind: string, value: string, seen: string) => {
    const norm = kind === "email" ? value.toLowerCase() : value.toLowerCase();
    await addIndicator(db, {
      incident_id: incidentId, kind, raw_value: value, norm_value: norm,
      first_seen: seen, source: "benchmark", shared: true,
      blind_hash: await blindHash(salt, kind, norm),
    });
    const row = await first<{ id: string }>(
      db, `SELECT id FROM indicators WHERE incident_id=? AND kind=? AND norm_value=?`,
      incidentId, kind, norm
    );
    if (row) await initIndicatorMeta(db, row.id, seen, kind);
  };

  const cleanup = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const ph = part.map(() => "?").join(",");
      await run(db, `DELETE FROM indicator_meta WHERE indicator_id IN (SELECT id FROM indicators WHERE incident_id IN (${ph}))`, ...part);
      await run(db, `DELETE FROM indicators WHERE incident_id IN (${ph})`, ...part);
      await run(db, `DELETE FROM incidents WHERE id IN (${ph})`, ...part);
    }
  };

  const scenario = async (
    name: string, expected: "link" | "no_link",
    setup: (mk: (code: string, occurred: string) => Promise<string>, add: (id: string, kind: string, value: string, seen: string) => Promise<void>) => Promise<[string, string]>,
    note: string
  ) => {
    const ids: string[] = [];
    try {
      const [a, b] = await setup(async (code, occurred) => {
        const id = await createIncidentRow(code, occurred);
        ids.push(id);
        return id;
      }, add);
      const incA = await first<Incident>(db, `SELECT * FROM incidents WHERE id=?`, a);
      const incB = await first<Incident>(db, `SELECT * FROM incidents WHERE id=?`, b);
      if (!incA || !incB) throw new Error("adversarial incident missing");
      const score = (await scorePair(db, incA, incB, salt, blocked)).score;
      out.push({
        name, expected, actual: score >= threshold ? "link" : "no_link", score,
        pass: (score >= threshold) === (expected === "link"), note,
      });
    } finally {
      await cleanup(ids);
    }
  };

  await scenario(
    "partial_overlap", "link",
    async (mk, add) => {
      const a = await mk("ADV-PARTIAL-A", new Date(Date.now() - 4 * 3600_000).toISOString());
      const b = await mk("ADV-PARTIAL-B", new Date(Date.now() - 2 * 3600_000).toISOString());
      const seen = new Date().toISOString();
      for (const id of [a, b]) {
        await add(id, "domain", "partial.example", seen);
        await add(id, "email", "sender@partial.example", seen);
      }
      return [a, b];
    },
    "Related incidents that share only a domain and an email, no hash."
  );

  await scenario(
    "hash_only_unrelated", "no_link",
    async (mk, add) => {
      const a = await mk("ADV-HASH-A", new Date(Date.now() - 30 * 86400_000).toISOString());
      const b = await mk("ADV-HASH-B", new Date(Date.now() - 20 * 86400_000).toISOString());
      const h = await sha256Hex("adversarial-shared-hash");
      const seen = new Date().toISOString();
      await add(a, "sha256", h, seen);
      await add(b, "sha256", h, seen);
      return [a, b];
    },
    "Same file hash in unrelated campaigns. A hash alone is ambiguous."
  );

  await scenario(
    "homoglyph_variant", "no_link",
    async (mk, add) => {
      const a = await mk("ADV-HOMO-A", new Date().toISOString());
      const b = await mk("ADV-HOMO-B", new Date().toISOString());
      const seen = new Date().toISOString();
      await add(a, "domain", "homoglyph.example", seen);
      await add(b, "domain", "h\u043emoglyph.example", seen); // Cyrillic o
      return [a, b];
    },
    "Latin and Cyrillic domain labels must not be treated as equal."
  );

  await scenario(
    "clock_skew", "link",
    async (mk, add) => {
      const a = await mk("ADV-SKEW-A", new Date(Date.now() - 10 * 86400_000).toISOString());
      const b = await mk("ADV-SKEW-B", new Date(Date.now() - 1 * 3600_000).toISOString());
      const h = await sha256Hex("adversarial-clock");
      const seen = new Date().toISOString();
      for (const id of [a, b]) {
        await add(id, "domain", "skew.example", seen);
        await add(id, "sha256", h, seen);
      }
      return [a, b];
    },
    "Identical strong indicators with a ten day gap must still link."
  );

  return out;
}

export type BenchmarkMetrics = {
  incidents: number;
  clusters: number;
  per_cluster: number;
  noise: number;
  ground_truth_pairs: number;
  evaluated_negatives: number;
  reported_pairs: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  precision: number;
  recall: number;
  false_positive_rate: number;
  false_negative_rate: number;
  threshold: number;
  shared_domain_cross_links: number;
  cdn_cross_links: number;
  elapsed_ms: number;
};

type Member = { id: string; cluster: number; pairGroup: number; unit: string; occurred: string; noise: boolean };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Stratified benchmark. True relationships are enumerated exactly; negatives
 * are sampled across three strata (shared hosting domain, CDN-only, random).
 * No correlation rows are persisted.
 */
export async function runBenchmark(
  db: D1Database,
  salt: string,
  opts: {
    clusters?: number; perCluster?: number; noise?: number;
    negativesPerStratum?: number; seed?: number;
  } = {}
): Promise<BenchmarkMetrics> {
  const started = Date.now();
  const clusters = opts.clusters ?? 60;
  const perCluster = opts.perCluster ?? 6;
  const noise = opts.noise ?? 40;
  const negativesPerStratum = opts.negativesPerStratum ?? 200;
  const threshold = 45;

  const members: Member[] = [];
  const created: string[] = [];
  const pairKey = (a: string, b: string) => (a < b ? a + "|" + b : b + "|" + a);

  const addRow = async (incidentId: string, kind: string, value: string, norm: string, seen: string) => {
    await addIndicator(db, {
      incident_id: incidentId, kind, raw_value: value, norm_value: norm,
      first_seen: seen, source: "benchmark", shared: true,
      blind_hash: await blindHash(salt, kind, norm),
    });
    const row = await first<{ id: string }>(
      db,
      `SELECT id FROM indicators WHERE incident_id=? AND kind=? AND norm_value=?`,
      incidentId, kind, norm
    );
    if (row) await initIndicatorMeta(db, row.id, seen, kind);
  };

  // --- clustered incidents: shared domain, hash, URL host; plus shared hosting per pair group ---
  for (let c = 0; c < clusters; c++) {
    const ids: string[] = [];
    const pairGroup = Math.floor(c / 2);
    for (let m = 0; m < perCluster; m++) {
      const id = uid();
      const occurred = new Date(Date.now() - (c * 2 + m) * 3600_000).toISOString();
      await createIncident(db, {
        id, code: `BM-C${c}-${m}`, title: `Benchmark cluster ${c} member ${m}`,
        category: "Phishing", severity: "high", status: "open",
        unit: m % 2 === 0 ? "Satuan Benchmark A" : "Satuan Benchmark B",
        reporter: "benchmark", summary: "synthetic benchmark incident",
        occurred_at: occurred, created_by: "benchmark",
      });
      created.push(id);
      ids.push(id);
      members.push({ id, cluster: c, pairGroup, unit: m % 2 === 0 ? "Satuan Benchmark A" : "Satuan Benchmark B", occurred, noise: false });

      const domain = `cluster-${c}.example`;
      const hash = await sha256Hex("benchmark-cluster:" + c);
      const hosting = `hosting-${pairGroup}.example`;
      await addRow(id, "domain", domain, domain, occurred);
      await addRow(id, "sha256", hash, hash, occurred);
      await addRow(id, "url", `https://${domain}/login`, `https://${domain}/login`, occurred);
      await addRow(id, "url", `https://${domain}/verify`, `https://${domain}/verify`, occurred);
      await addRow(id, "domain", hosting, hosting, occurred);
      await addRow(id, "domain", "cdn-shared.example", "cdn-shared.example", occurred);
    }
  }
  const truePairs: [string, string][] = [];
  for (let c = 0; c < clusters; c++) {
    const ids = members.filter((m) => m.cluster === c && !m.noise).map((m) => m.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) truePairs.push([ids[i], ids[j]]);
    }
  }

  // --- unrelated noise ---
  for (let n = 0; n < noise; n++) {
    const id = uid();
    const occurred = new Date(Date.now() - (n + 1) * 5400_000).toISOString();
    await createIncident(db, {
      id, code: `BM-N${n}`, title: `Benchmark noise ${n}`,
      category: "Phishing", severity: "low", status: "open",
      unit: "Satuan Benchmark C", reporter: "benchmark",
      summary: "synthetic benchmark noise", occurred_at: occurred, created_by: "benchmark",
    });
    created.push(id);
    members.push({ id, cluster: -1, pairGroup: -1, unit: "Satuan Benchmark C", occurred, noise: true });
    const domain = `noise-${n}.example`;
    await addRow(id, "domain", domain, domain, occurred);
    await addRow(id, "sha256", await sha256Hex("benchmark-noise:" + n), await sha256Hex("benchmark-noise:" + n), occurred);
    await addRow(id, "domain", "cdn-shared.example", "cdn-shared.example", occurred);
  }

  // --- stratified negative sample ---
  const random = rng(opts.seed ?? 1337);
  const picked = new Set<string>();
  const negatives: { a: Member; b: Member; stratum: "shared_domain" | "cdn" | "random" }[] = [];

  const pickNeg = (stratum: "shared_domain" | "cdn" | "random", pool: () => [Member, Member] | null) => {
    let attempts = 0;
    while (negatives.filter((n) => n.stratum === stratum).length < negativesPerStratum && attempts < negativesPerStratum * 30) {
      attempts++;
      const pair = pool();
      if (!pair) continue;
      const [a, b] = pair;
      if (a.cluster === b.cluster && !a.noise && !b.noise) continue;
      if (a.noise && b.noise) continue; // noise pairs share nothing, covered by random
      const key = pairKey(a.id, b.id);
      if (picked.has(key)) continue;
      picked.add(key);
      negatives.push({ a, b, stratum });
    }
  };

  const grouped = members.filter((m) => !m.noise);
  pickNeg("shared_domain", () => {
    const g = Math.floor(random() * (clusters / 2));
    const a = grouped[g * 2 * perCluster + Math.floor(random() * perCluster)];
    const b = grouped[(g * 2 + 1) * perCluster + Math.floor(random() * perCluster)];
    return a && b ? [a, b] : null;
  });

  const anyMember = members;
  pickNeg("cdn", () => {
    const a = anyMember[Math.floor(random() * anyMember.length)];
    const b = anyMember[Math.floor(random() * anyMember.length)];
    if (!a || !b) return null;
    const aGroup = a.noise ? -1 : a.pairGroup;
    const bGroup = b.noise ? -2 : b.pairGroup;
    return aGroup !== bGroup ? [a, b] : null;
  });

  pickNeg("random", () => {
    const a = anyMember[Math.floor(random() * anyMember.length)];
    const b = anyMember[Math.floor(random() * anyMember.length)];
    return a && b && a.id !== b.id ? [a, b] : null;
  });

  const asIncident = (m: Member): Incident => ({
    id: m.id, code: "", title: "", category: "", severity: "", status: "",
    unit: m.unit, reporter: "", summary: "", occurred_at: m.occurred,
    created_at: m.occurred, updated_at: m.occurred, created_by: "benchmark",
    artifact_count: 0, indicator_count: 0, lead_count: 0, max_score: 0,
  });

  let tp = 0, fn = 0;
  const blocked = await blockedIndicators(db);
  for (const [a, b] of truePairs) {
    const ma = members.find((m) => m.id === a)!;
    const mb = members.find((m) => m.id === b)!;
    const result = await scorePair(db, asIncident(ma), asIncident(mb), salt, blocked);
    if (result.score >= threshold) tp++;
    else fn++;
  }

  let fp = 0, sharedLinks = 0, cdnLinks = 0;
  for (const n of negatives) {
    const result = await scorePair(db, asIncident(n.a), asIncident(n.b), salt, blocked);
    if (result.score >= threshold) {
      fp++;
      if (n.stratum === "shared_domain") sharedLinks++;
      if (n.stratum === "cdn") cdnLinks++;
    }
  }
  const tn = negatives.length - fp;

  // --- cleanup in chunks (D1 caps bound parameters per statement) ---
  const chunkSize = 80;
  for (let i = 0; i < created.length; i += chunkSize) {
    const part = created.slice(i, i + chunkSize);
    const placeholders = part.map(() => "?").join(",");
    await run(db, `DELETE FROM indicator_meta WHERE indicator_id IN (SELECT id FROM indicators WHERE incident_id IN (${placeholders}))`, ...part);
    await run(db, `DELETE FROM indicators WHERE incident_id IN (${placeholders})`, ...part);
    await run(db, `DELETE FROM incidents WHERE id IN (${placeholders})`, ...part);
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const fpr = negatives.length === 0 ? 0 : fp / negatives.length;
  const round = (n: number) => Math.round(n * 1000) / 1000;

  return {
    incidents: created.length,
    clusters,
    per_cluster: perCluster,
    noise,
    ground_truth_pairs: truePairs.length,
    evaluated_negatives: negatives.length,
    reported_pairs: tp + fp,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    true_negatives: tn,
    precision: round(precision),
    recall: round(recall),
    false_positive_rate: round(fpr),
    false_negative_rate: round(1 - recall),
    threshold,
    shared_domain_cross_links: sharedLinks,
    cdn_cross_links: cdnLinks,
    elapsed_ms: Date.now() - started,
  };
}
