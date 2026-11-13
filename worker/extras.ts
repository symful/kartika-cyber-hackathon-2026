import { all, first, now, run, uid } from "./db";
import { createTask } from "./queries";
import type {
  AccessRequest, Asset, FileAnalysis, IndicatorMeta, Playbook, PlaybookRun, PlaybookStep, Technique,
} from "./types";

export async function setIncidentMeta(db: D1Database, incidentId: string, tlp: string, priority = "normal") {
  await run(
    db,
    `INSERT INTO incident_meta(incident_id,tlp,priority) VALUES(?,?,?)
     ON CONFLICT(incident_id) DO UPDATE SET tlp=excluded.tlp, priority=excluded.priority`,
    incidentId, tlp, priority
  );
}

export async function getIncidentMeta(db: D1Database, incidentId: string): Promise<{ tlp: string; priority: string }> {
  const row = await first<{ tlp: string; priority: string }>(
    db, `SELECT tlp,priority FROM incident_meta WHERE incident_id=?`, incidentId
  );
  return { tlp: row?.tlp ?? "amber", priority: row?.priority ?? "normal" };
}

const expiry = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

export async function initIndicatorMeta(
  db: D1Database, indicatorId: string, firstSeen: string, classification: string, sightings = 1
) {
  await run(
    db,
    `INSERT INTO indicator_meta(indicator_id,status,confidence,first_seen,last_seen,sightings,expires_at,classification,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?)
     ON CONFLICT(indicator_id) DO UPDATE SET
       last_seen=excluded.last_seen, sightings=indicator_meta.sightings+1, updated_at=excluded.updated_at`,
    indicatorId, "suspicious", "medium", firstSeen, now(), sightings, expiry(30), classification, now()
  );
}

export async function indicatorMetaForIncident(db: D1Database, incidentId: string): Promise<IndicatorMeta[]> {
  return await all<IndicatorMeta>(
    db,
    `SELECT m.indicator_id,m.status,m.confidence,m.first_seen,m.last_seen,m.sightings,
      m.expires_at,m.classification,m.updated_at
     FROM indicator_meta m JOIN indicators i ON i.id=m.indicator_id WHERE i.incident_id=?`,
    incidentId
  );
}

export async function updateIndicatorMeta(
  db: D1Database, indicatorId: string, patch: { status?: string; confidence?: string }
) {
  const cur = await first<IndicatorMeta>(db, `SELECT * FROM indicator_meta WHERE indicator_id=?`, indicatorId);
  if (!cur) return;
  await run(
    db,
    `UPDATE indicator_meta SET status=?, confidence=?, updated_at=? WHERE indicator_id=?`,
    patch.status ?? cur.status, patch.confidence ?? cur.confidence, now(), indicatorId
  );
}

export async function blockedIndicators(db: D1Database): Promise<Set<string>> {
  const rows = await all<{ indicator_id: string }>(
    db,
    `SELECT indicator_id FROM indicator_meta WHERE status IN ('false_positive','benign','expired')`
  );
  return new Set(rows.map((r) => r.indicator_id));
}

export async function createAccessRequest(
  db: D1Database,
  input: { artifact_id: string; incident_id: string; requester: string; requester_unit: string; scope: string; reason: string }
): Promise<string> {
  const id = uid();
  await run(
    db,
    `INSERT INTO access_requests(id,artifact_id,incident_id,requester,requester_unit,scope,reason,status,created_at)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    id, input.artifact_id, input.incident_id, input.requester, input.requester_unit,
    input.scope, input.reason, "pending", now()
  );
  return id;
}

export async function listAccessRequests(
  db: D1Database, filter: { requester?: string; incidentId?: string; artifactId?: string } = {}
): Promise<AccessRequest[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.requester) { where.push("requester=?"); args.push(filter.requester); }
  if (filter.incidentId) { where.push("incident_id=?"); args.push(filter.incidentId); }
  if (filter.artifactId) { where.push("artifact_id=?"); args.push(filter.artifactId); }
  const sql =
    `SELECT id,artifact_id,incident_id,requester,requester_unit,scope,reason,status,
       COALESCE(decided_by,'') AS decided_by,COALESCE(decided_at,'') AS decided_at,
       COALESCE(expires_at,'') AS expires_at,created_at
     FROM access_requests` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY created_at DESC`;
  return await all<AccessRequest>(db, sql, ...args);
}

export async function decideAccessRequest(
  db: D1Database, id: string, status: string, actor: string, ttlDays = 3
): Promise<AccessRequest | null> {
  const row = await first<AccessRequest>(db, `SELECT * FROM access_requests WHERE id=?`, id);
  if (!row) return null;
  const expires = status === "approved" ? expiry(ttlDays) : "";
  await run(
    db,
    `UPDATE access_requests SET status=?, decided_by=?, decided_at=?, expires_at=? WHERE id=?`,
    status, actor, now(), expires, id
  );
  return { ...row, status, decided_by: actor, decided_at: now(), expires_at: expires };
}

export async function saveAnalysis(
  db: D1Database, artifactId: string, a: Omit<FileAnalysis, "artifact_id" | "created_at">
) {
  await run(
    db,
    `INSERT INTO artifact_analysis(artifact_id,file_type,extension,mismatch,entropy,embedded_urls,suspicious_strings,macro,nested,rules,verdict,metadata,explanations,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(artifact_id) DO UPDATE SET
       file_type=excluded.file_type, extension=excluded.extension, mismatch=excluded.mismatch,
       entropy=excluded.entropy, embedded_urls=excluded.embedded_urls,
       suspicious_strings=excluded.suspicious_strings, macro=excluded.macro, nested=excluded.nested,
       rules=excluded.rules, verdict=excluded.verdict, metadata=excluded.metadata,
       explanations=excluded.explanations`,
    artifactId, a.file_type, a.extension, a.mismatch ? 1 : 0, a.entropy,
    JSON.stringify(a.embedded_urls), JSON.stringify(a.suspicious_strings), a.macro ? 1 : 0, a.nested ? 1 : 0,
    JSON.stringify(a.rules), a.verdict, JSON.stringify(a.metadata), JSON.stringify(a.explanations), now()
  );
}

type AnalysisRow = {
  artifact_id: string;
  file_type: string;
  extension: string;
  mismatch: number;
  entropy: number;
  embedded_urls: string;
  suspicious_strings: string;
  macro: number;
  nested: number;
  rules: string;
  verdict: string;
  metadata: string;
  explanations: string;
  created_at: string;
};

export async function getAnalysis(db: D1Database, artifactId: string): Promise<FileAnalysis | null> {
  const row = await first<AnalysisRow>(db, `SELECT * FROM artifact_analysis WHERE artifact_id=?`, artifactId);
  if (!row) return null;
  return {
    artifact_id: row.artifact_id,
    file_type: row.file_type,
    extension: row.extension,
    mismatch: !!row.mismatch,
    entropy: row.entropy,
    embedded_urls: JSON.parse(row.embedded_urls || "[]") as string[],
    suspicious_strings: JSON.parse(row.suspicious_strings || "[]") as string[],
    macro: !!row.macro,
    nested: !!row.nested,
    rules: JSON.parse(row.rules || "[]") as FileAnalysis["rules"],
    verdict: row.verdict || "clean",
    metadata: JSON.parse(row.metadata || "{}") as Record<string, string | number>,
    explanations: JSON.parse(row.explanations || "[]") as string[],
    created_at: row.created_at,
  };
}

export async function techniquesForIncident(db: D1Database, incidentId: string): Promise<Technique[]> {
  return await all<Technique>(
    db,
    `SELECT id,incident_id,technique_id,name,COALESCE(artifact_id,'') AS artifact_id,
      COALESCE(explanation,'') AS explanation,confidence,status,created_at
     FROM techniques WHERE incident_id=? ORDER BY technique_id`,
    incidentId
  );
}

export async function addTechnique(db: D1Database, t: Partial<Technique> & { incident_id: string }) {
  const id = t.id || uid();
  await run(
    db,
    `INSERT INTO techniques(id,incident_id,technique_id,name,artifact_id,explanation,confidence,status,created_at)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    id, t.incident_id, t.technique_id ?? "", t.name ?? "", t.artifact_id ?? "",
    t.explanation ?? "", t.confidence ?? "medium", t.status ?? "candidate", now()
  );
  return id;
}

export async function assetsForIncident(db: D1Database, incidentId: string): Promise<Asset[]> {
  return await all<Asset>(
    db,
    `SELECT a.id,a.name,a.hostname,a.unit,a.owner,a.criticality,a.status,COALESCE(a.notes,'') AS notes,a.created_at
     FROM assets a JOIN incident_assets ia ON ia.asset_id=a.id WHERE ia.incident_id=? ORDER BY a.criticality DESC`,
    incidentId
  );
}

export async function listAssets(db: D1Database): Promise<Asset[]> {
  return await all<Asset>(
    db,
    `SELECT id,name,hostname,unit,owner,criticality,status,COALESCE(notes,'') AS notes,created_at
     FROM assets ORDER BY criticality DESC, name`
  );
}

export async function createAsset(db: D1Database, a: Partial<Asset>): Promise<string> {
  const id = a.id || uid();
  await run(
    db,
    `INSERT INTO assets(id,name,hostname,unit,owner,criticality,status,notes,created_at)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    id, a.name ?? "", a.hostname ?? "", a.unit ?? "", a.owner ?? "", a.criticality ?? "medium",
    a.status ?? "active", a.notes ?? "", now()
  );
  return id;
}

export async function linkAsset(db: D1Database, incidentId: string, assetId: string) {
  await run(
    db,
    `INSERT INTO incident_assets(incident_id,asset_id) VALUES(?,?) ON CONFLICT DO NOTHING`,
    incidentId, assetId
  );
}

export async function unlinkAsset(db: D1Database, incidentId: string, assetId: string) {
  await run(db, `DELETE FROM incident_assets WHERE incident_id=? AND asset_id=?`, incidentId, assetId);
}

export async function listPlaybooks(db: D1Database): Promise<Playbook[]> {
  const rows = await all<Omit<Playbook, "steps"> & { steps: string }>(db, `SELECT * FROM playbooks ORDER BY name`);
  return rows.map((r) => ({ ...r, steps: JSON.parse(r.steps || "[]") as PlaybookStep[] }));
}

export async function createPlaybook(
  db: D1Database, p: { id?: string; name: string; incident_type: string; version?: number; steps: PlaybookStep[] }
): Promise<string> {
  const id = p.id || uid();
  await run(
    db,
    `INSERT INTO playbooks(id,name,incident_type,version,steps) VALUES(?,?,?,?,?)`,
    id, p.name, p.incident_type, p.version ?? 1, JSON.stringify(p.steps)
  );
  return id;
}

export async function playbookRunsForIncident(db: D1Database, incidentId: string): Promise<PlaybookRun[]> {
  return await all<PlaybookRun>(
    db,
    `SELECT id,playbook_id,incident_id,status,created_at FROM playbook_runs WHERE incident_id=? ORDER BY created_at DESC`,
    incidentId
  );
}

export async function runPlaybook(
  db: D1Database, playbookId: string, incidentId: string, assignee: string
): Promise<{ runId: string; tasks: number } | null> {
  const book = (await listPlaybooks(db)).find((p) => p.id === playbookId);
  if (!book) return null;
  const runId = uid();
  await run(
    db,
    `INSERT INTO playbook_runs(id,playbook_id,incident_id,status,created_at) VALUES(?,?,?,?,?)`,
    runId, playbookId, incidentId, "active", now()
  );
  for (const step of book.steps) {
    await createTask(db, {
      incident_id: incidentId,
      title: step.title,
      assignee: assignee,
      status: "open",
      due_at: "",
    });
  }
  return { runId, tasks: book.steps.length };
}
