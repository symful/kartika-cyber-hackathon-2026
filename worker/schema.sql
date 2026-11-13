CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT, role TEXT, unit TEXT,
  salt TEXT, hash TEXT
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT
);
CREATE TABLE IF NOT EXISTS incidents(
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT, category TEXT, severity TEXT, status TEXT,
  unit TEXT, reporter TEXT, summary TEXT, occurred_at TEXT, created_at TEXT, updated_at TEXT, created_by TEXT
);
CREATE TABLE IF NOT EXISTS artifacts(
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, filename TEXT, mime TEXT, size INTEGER, sha256 TEXT,
  storage_path TEXT, content BLOB, share_scope TEXT DEFAULT 'full', note TEXT,
  uploaded_by TEXT, uploaded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_artifacts_inc ON artifacts(incident_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(sha256);
CREATE TABLE IF NOT EXISTS indicators(
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, artifact_id TEXT, kind TEXT NOT NULL, raw_value TEXT,
  norm_value TEXT NOT NULL, first_seen TEXT, source TEXT, shared INTEGER DEFAULT 1,
  specificity REAL DEFAULT 1, blind_hash TEXT, blind_hash_prev TEXT
);
CREATE INDEX IF NOT EXISTS idx_ind_inc ON indicators(incident_id);
CREATE INDEX IF NOT EXISTS idx_ind_norm ON indicators(kind, norm_value);
CREATE INDEX IF NOT EXISTS idx_ind_blind ON indicators(blind_hash);
CREATE TABLE IF NOT EXISTS correlations(
  id TEXT PRIMARY KEY, a_id TEXT NOT NULL, b_id TEXT NOT NULL, score REAL, band TEXT, reasons TEXT,
  status TEXT, decided_by TEXT, decided_at TEXT, created_at TEXT, UNIQUE(a_id,b_id)
);
CREATE TABLE IF NOT EXISTS events(
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, artifact_id TEXT, ts TEXT NOT NULL, source TEXT,
  kind TEXT, title TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_inc ON events(incident_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE TABLE IF NOT EXISTS tasks(
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, title TEXT, assignee TEXT, status TEXT,
  due_at TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS audit(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT, action TEXT, object_type TEXT,
  object_id TEXT, payload TEXT, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkpoints(
  id TEXT PRIMARY KEY, seq INTEGER, head_hash TEXT, signature TEXT, public_key TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS custody(
  id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, ts TEXT NOT NULL, actor TEXT, action TEXT,
  from_unit TEXT, to_unit TEXT, location TEXT, note TEXT, sha256 TEXT, payload TEXT,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_custody_art ON custody(artifact_id);
CREATE TABLE IF NOT EXISTS access_requests(
  id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, incident_id TEXT NOT NULL,
  requester TEXT, requester_unit TEXT, scope TEXT, reason TEXT, status TEXT,
  decided_by TEXT, decided_at TEXT, expires_at TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_art ON access_requests(artifact_id);
CREATE TABLE IF NOT EXISTS indicator_meta(
  indicator_id TEXT PRIMARY KEY, status TEXT, confidence TEXT, first_seen TEXT, last_seen TEXT,
  sightings INTEGER, expires_at TEXT, classification TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS techniques(
  id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, technique_id TEXT, name TEXT, artifact_id TEXT,
  explanation TEXT, confidence TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS assets(
  id TEXT PRIMARY KEY, name TEXT, hostname TEXT, unit TEXT, owner TEXT, criticality TEXT,
  status TEXT, notes TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS incident_assets(
  incident_id TEXT NOT NULL, asset_id TEXT NOT NULL, PRIMARY KEY(incident_id, asset_id)
);
CREATE TABLE IF NOT EXISTS playbooks(
  id TEXT PRIMARY KEY, name TEXT, incident_type TEXT, version INTEGER, steps TEXT
);
CREATE TABLE IF NOT EXISTS playbook_runs(
  id TEXT PRIMARY KEY, playbook_id TEXT, incident_id TEXT, status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS incident_meta(
  incident_id TEXT PRIMARY KEY, tlp TEXT, priority TEXT
);
CREATE TABLE IF NOT EXISTS artifact_analysis(
  artifact_id TEXT PRIMARY KEY, file_type TEXT, extension TEXT, mismatch INTEGER,
  entropy REAL, embedded_urls TEXT, suspicious_strings TEXT, macro INTEGER, nested INTEGER,
  rules TEXT, verdict TEXT, metadata TEXT, explanations TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS signing_keys(
  id TEXT PRIMARY KEY, public_key TEXT NOT NULL, source TEXT, created_at TEXT, retired_at TEXT
);
