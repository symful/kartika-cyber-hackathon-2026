import { all, first, run, now, uid } from "./db";
import type { Artifact, Correlation, EventRow, Incident, Indicator, IndicatorRow, Task, User } from "./types";

type IndicatorRowDB = Omit<IndicatorRow, "shared"> & { shared: number };
type CorrelationRow = Omit<Correlation, "reasons"> & { reasons: string };

const incidentCols = `i.id,i.code,i.title,i.category,i.severity,i.status,i.unit,i.reporter,i.summary,
  i.occurred_at,i.created_at,i.updated_at,i.created_by,
  (SELECT COUNT(*) FROM artifacts a WHERE a.incident_id=i.id) AS artifact_count,
  (SELECT COUNT(*) FROM indicators x WHERE x.incident_id=i.id) AS indicator_count,
  (SELECT COUNT(*) FROM correlations c WHERE (c.a_id=i.id OR c.b_id=i.id) AND c.score>=25) AS lead_count,
  COALESCE((SELECT MAX(c.score) FROM correlations c WHERE c.a_id=i.id OR c.b_id=i.id),0) AS max_score`;

export async function listIncidents(db: D1Database, unit?: string): Promise<Incident[]> {
  const sql = `SELECT ${incidentCols} FROM incidents i` + (unit ? ` WHERE i.unit=?` : "") + ` ORDER BY i.occurred_at DESC`;
  return unit ? await all<Incident>(db, sql, unit) : await all<Incident>(db, sql);
}

export async function getIncident(db: D1Database, idOrCode: string): Promise<Incident | null> {
  return await first<Incident>(db, `SELECT ${incidentCols} FROM incidents i WHERE i.id=? OR i.code=?`, idOrCode, idOrCode);
}

export async function createIncident(db: D1Database, i: Partial<Incident>): Promise<string> {
  const id = i.id || uid();
  await run(
    db,
    `INSERT INTO incidents(id,code,title,category,severity,status,unit,reporter,summary,occurred_at,created_at,updated_at,created_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, i.code, i.title ?? "", i.category ?? "Phishing", i.severity ?? "medium", i.status ?? "open",
    i.unit ?? "", i.reporter ?? "", i.summary ?? "", i.occurred_at ?? now(), now(), now(), i.created_by ?? ""
  );
  return id;
}

export async function updateIncidentStatus(db: D1Database, id: string, status: string) {
  await run(db, `UPDATE incidents SET status=?, updated_at=? WHERE id=?`, status, now(), id);
}

export async function artifacts(db: D1Database, incidentId: string): Promise<Artifact[]> {
  return await all<Artifact>(
    db,
    `SELECT id,incident_id,filename,mime,size,sha256,COALESCE(storage_path,'') AS storage_path,
      share_scope,COALESCE(note,'') AS note,uploaded_by,uploaded_at
     FROM artifacts WHERE incident_id=? ORDER BY uploaded_at`,
    incidentId
  );
}

export async function getArtifact(db: D1Database, id: string): Promise<Artifact | null> {
  return await first<Artifact>(
    db,
    `SELECT id,incident_id,filename,mime,size,sha256,COALESCE(storage_path,'') AS storage_path,
      share_scope,COALESCE(note,'') AS note,uploaded_by,uploaded_at
     FROM artifacts WHERE id=?`,
    id
  );
}

export async function artifactContent(db: D1Database, id: string): Promise<Uint8Array | null> {
  const row = await first<{ content: ArrayBuffer | null }>(db, `SELECT content FROM artifacts WHERE id=?`, id);
  if (!row?.content) return null;
  return new Uint8Array(row.content);
}

export async function createArtifact(db: D1Database, a: Partial<Artifact> & { content: Uint8Array }) {
  const id = a.id || uid();
  await run(
    db,
    `INSERT INTO artifacts(id,incident_id,filename,mime,size,sha256,storage_path,content,share_scope,note,uploaded_by,uploaded_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, a.incident_id, a.filename, a.mime, a.size, a.sha256, a.storage_path ?? "",
    a.content, a.share_scope ?? "full", a.note ?? "", a.uploaded_by ?? "", now()
  );
  return id;
}

export async function indicators(db: D1Database, incidentId: string): Promise<Indicator[]> {
  const rows = await all<Omit<Indicator, "shared"> & { shared: number }>(
    db,
    `SELECT id,incident_id,COALESCE(artifact_id,'') AS artifact_id,kind,raw_value,norm_value,first_seen,source,shared,specificity
     FROM indicators WHERE incident_id=? ORDER BY kind,norm_value`,
    incidentId
  );
  return rows.map((r) => ({ ...r, shared: !!r.shared }));
}

export async function indicatorRows(db: D1Database, incidentId: string): Promise<IndicatorRow[]> {
  const rows = await all<IndicatorRowDB>(
    db,
    `SELECT x.id,x.incident_id,COALESCE(x.artifact_id,'') AS artifact_id,x.kind,x.raw_value,x.norm_value,
      x.first_seen,x.source,x.shared,x.specificity,COALESCE(x.blind_hash,'') AS blind_hash,
      COALESCE(x.blind_hash_prev,'') AS blind_hash_prev,i.unit,i.code AS incident_code
     FROM indicators x JOIN incidents i ON i.id=x.incident_id WHERE x.incident_id=?`,
    incidentId
  );
  return rows.map((r) => ({ ...r, shared: !!r.shared }));
}

export async function allIndicatorRows(db: D1Database): Promise<IndicatorRow[]> {
  const rows = await all<IndicatorRowDB>(
    db,
    `SELECT x.id,x.incident_id,COALESCE(x.artifact_id,'') AS artifact_id,x.kind,x.raw_value,x.norm_value,
      x.first_seen,x.source,x.shared,x.specificity,COALESCE(x.blind_hash,'') AS blind_hash,
      COALESCE(x.blind_hash_prev,'') AS blind_hash_prev,i.unit,i.code AS incident_code
     FROM indicators x JOIN incidents i ON i.id=x.incident_id`
  );
  return rows.map((r) => ({ ...r, shared: !!r.shared }));
}

export async function addIndicator(db: D1Database, m: Partial<Indicator> & { norm_value: string; kind: string }) {
  const dup = await first(
    db,
    `SELECT id FROM indicators WHERE incident_id=? AND kind=? AND norm_value=?`,
    m.incident_id, m.kind, m.norm_value
  );
  if (dup) return false;
  await run(
    db,
    `INSERT INTO indicators(id,incident_id,artifact_id,kind,raw_value,norm_value,first_seen,source,shared,specificity,blind_hash,blind_hash_prev)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    uid(), m.incident_id, m.artifact_id ?? "", m.kind, m.raw_value ?? m.norm_value, m.norm_value,
    m.first_seen ?? now(), m.source ?? "manual", m.shared === false ? 0 : 1, m.specificity ?? 1,
    m.blind_hash ?? "", ""
  );
  return true;
}

export async function indicatorIncidentCount(db: D1Database, kind: string, norm: string): Promise<number> {
  const row = await first<{ n: number }>(
    db,
    `SELECT COUNT(DISTINCT incident_id) AS n FROM indicators WHERE kind=? AND norm_value=?`,
    kind, norm
  );
  return row?.n ?? 0;
}

export async function setIndicatorShared(db: D1Database, id: string, shared: boolean) {
  await run(db, `UPDATE indicators SET shared=? WHERE id=?`, shared ? 1 : 0, id);
}

export async function createEvent(db: D1Database, e: Partial<EventRow>) {
  await run(
    db,
    `INSERT INTO events(id,incident_id,artifact_id,ts,source,kind,title,detail) VALUES(?,?,?,?,?,?,?,?)`,
    e.id || uid(), e.incident_id, e.artifact_id ?? "", e.ts ?? now(), e.source ?? "", e.kind ?? "", e.title ?? "", e.detail ?? ""
  );
}

export async function events(db: D1Database, incidentId: string): Promise<EventRow[]> {
  return await all<EventRow>(
    db,
    `SELECT e.id,e.incident_id,COALESCE(e.artifact_id,'') AS artifact_id,e.ts,e.source,e.kind,e.title,e.detail,
      i.code AS incident_code,i.unit
     FROM events e JOIN incidents i ON i.id=e.incident_id WHERE e.incident_id=? ORDER BY e.ts`,
    incidentId
  );
}

export async function allEvents(db: D1Database): Promise<EventRow[]> {
  return await all<EventRow>(
    db,
    `SELECT e.id,e.incident_id,COALESCE(e.artifact_id,'') AS artifact_id,e.ts,e.source,e.kind,e.title,e.detail,
      i.code AS incident_code,i.unit
     FROM events e JOIN incidents i ON i.id=e.incident_id ORDER BY e.ts`
  );
}

export async function createTask(db: D1Database, t: Partial<Task>): Promise<string> {
  const id = t.id || uid();
  await run(
    db,
    `INSERT INTO tasks(id,incident_id,title,assignee,status,due_at,created_at) VALUES(?,?,?,?,?,?,?)`,
    id, t.incident_id, t.title ?? "", t.assignee ?? "", t.status ?? "open", t.due_at ?? "", now()
  );
  return id;
}

export async function tasks(db: D1Database, incidentId: string): Promise<Task[]> {
  return await all<Task>(db, `SELECT * FROM tasks WHERE incident_id=? ORDER BY created_at`, incidentId);
}

export async function allTasks(db: D1Database): Promise<Task[]> {
  return await all<Task>(db, `SELECT * FROM tasks ORDER BY created_at`);
}

export async function updateTaskStatus(db: D1Database, id: string, status: string) {
  await run(db, `UPDATE tasks SET status=? WHERE id=?`, status, id);
}

export async function upsertCorrelation(db: D1Database, c: Partial<Correlation>) {
  const id = c.id || uid();
  await run(
    db,
    `INSERT INTO correlations(id,a_id,b_id,score,band,reasons,status,created_at) VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(a_id,b_id) DO UPDATE SET
       score=excluded.score, band=excluded.band, reasons=excluded.reasons,
       status=CASE WHEN correlations.status='open' THEN 'open' ELSE correlations.status END`,
    id, c.a_id, c.b_id, c.score, c.band, JSON.stringify(c.reasons ?? []), c.status ?? "open", now()
  );
}

function mapCorrelation(row: CorrelationRow): Correlation {
  return {
    ...row,
    reasons: row.reasons ? JSON.parse(row.reasons) : [],
  };
}

export async function listCorrelations(db: D1Database): Promise<Correlation[]> {
  const rows = await all<CorrelationRow>(
    db,
    `SELECT id,a_id,b_id,score,band,reasons,status,COALESCE(decided_by,'') AS decided_by,
      COALESCE(decided_at,'') AS decided_at,created_at FROM correlations ORDER BY score DESC, created_at DESC`
  );
  return rows.map(mapCorrelation);
}

export async function correlationsForIncident(db: D1Database, id: string): Promise<Correlation[]> {
  const rows = await all<CorrelationRow>(
    db,
    `SELECT id,a_id,b_id,score,band,reasons,status,COALESCE(decided_by,'') AS decided_by,
      COALESCE(decided_at,'') AS decided_at,created_at FROM correlations
     WHERE a_id=? OR b_id=? ORDER BY score DESC`,
    id, id
  );
  return rows.map((r) => {
    const c = mapCorrelation(r);
    if (c.a_id !== id) {
      c.a_id = r.b_id;
      c.b_id = r.a_id;
      c.reasons = c.reasons.map((x) => ({
        ...x,
        artifact_a: x.artifact_b,
        artifact_b: x.artifact_a,
        provenance_a: x.provenance_b,
        provenance_b: x.provenance_a,
      }));
    }
    return c;
  });
}

export async function getCorrelation(db: D1Database, id: string): Promise<Correlation | null> {
  const row = await first<CorrelationRow>(
    db,
    `SELECT id,a_id,b_id,score,band,reasons,status,COALESCE(decided_by,'') AS decided_by,
      COALESCE(decided_at,'') AS decided_at,created_at FROM correlations WHERE id=?`,
    id
  );
  return row ? mapCorrelation(row) : null;
}

export async function decideCorrelation(db: D1Database, id: string, status: string, actor: string) {
  await run(db, `UPDATE correlations SET status=?, decided_by=?, decided_at=? WHERE id=?`, status, actor, now(), id);
}

export async function users(db: D1Database): Promise<User[]> {
  return await all<User>(db, `SELECT id,username,name,role,unit FROM users ORDER BY role,name`);
}

export type DashboardData = {
  incidents: number;
  artifacts: number;
  indicators: number;
  open_leads: number;
  critical: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  chain_head: string;
  chain_length: number;
  recent: Incident[];
  top_leads: Correlation[];
  units: string[];
};

export async function dashboard(db: D1Database): Promise<DashboardData> {
  const count = async (sql: string, ...args: unknown[]) => (await first<{ n: number }>(db, sql, ...args))?.n ?? 0;
  const sevRows = await all<{ k: string; n: number }>(db, `SELECT severity AS k, COUNT(*) AS n FROM incidents GROUP BY severity`);
  const stRows = await all<{ k: string; n: number }>(db, `SELECT status AS k, COUNT(*) AS n FROM incidents GROUP BY status`);
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  sevRows.forEach((r) => (bySeverity[r.k] = r.n));
  stRows.forEach((r) => (byStatus[r.k] = r.n));
  const head = await first<{ seq: number; hash: string }>(db, `SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1`);
  const recent = (await listIncidents(db)).slice(0, 6);
  const topLeads = (await listCorrelations(db)).slice(0, 5);
  for (const l of topLeads) {
    l.a = (await getIncident(db, l.a_id)) ?? undefined;
    l.b = (await getIncident(db, l.b_id)) ?? undefined;
  }
  const units = (await all<{ unit: string }>(db, `SELECT DISTINCT unit FROM incidents ORDER BY unit`)).map((r) => r.unit);
  return {
    incidents: await count(`SELECT COUNT(*) AS n FROM incidents`),
    artifacts: await count(`SELECT COUNT(*) AS n FROM artifacts`),
    indicators: await count(`SELECT COUNT(*) AS n FROM indicators`),
    open_leads: await count(`SELECT COUNT(*) AS n FROM correlations WHERE status='open' AND score>=45`),
    critical: await count(`SELECT COUNT(*) AS n FROM incidents WHERE severity='critical'`),
    by_severity: bySeverity,
    by_status: byStatus,
    chain_head: head?.hash ?? "",
    chain_length: head?.seq ?? 0,
    recent,
    top_leads: topLeads,
    units,
  };
}
