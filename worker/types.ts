export type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  unit: string;
};

export type UserRecord = User & { salt: string; hash: string };

export type Incident = {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  unit: string;
  reporter: string;
  summary: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  artifact_count: number;
  indicator_count: number;
  lead_count: number;
  max_score: number;
};

export type Artifact = {
  id: string;
  incident_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  storage_path: string;
  share_scope: string;
  note: string;
  uploaded_by: string;
  uploaded_at: string;
};

export type DuplicateRef = {
  id: string;
  code: string;
  title: string;
  unit: string;
};

export type ArtifactDetail = Artifact & {
  verified: boolean;
  restricted: boolean;
  duplicates: DuplicateRef[];
};

export type Indicator = {
  id: string;
  incident_id: string;
  artifact_id: string;
  kind: string;
  raw_value: string;
  norm_value: string;
  first_seen: string;
  source: string;
  shared: boolean;
  specificity: number;
  blind_hash?: string;
  blind_hash_prev?: string;
};

export type IndicatorRow = Indicator & {
  unit: string;
  incident_code: string;
  blind_hash: string;
  blind_hash_prev: string;
};

export type Reason = {
  kind: string;
  value: string;
  weight: number;
  detail: string;
  artifact_a?: string;
  artifact_b?: string;
  provenance_a?: string;
  provenance_b?: string;
  blinded?: boolean;
  common?: boolean;
};

export type Correlation = {
  id: string;
  a_id: string;
  b_id: string;
  score: number;
  band: string;
  reasons: Reason[];
  status: string;
  decided_by?: string;
  decided_at?: string;
  created_at: string;
  a?: Incident;
  b?: Incident;
};

export type EventRow = {
  id: string;
  incident_id: string;
  artifact_id: string;
  ts: string;
  source: string;
  kind: string;
  title: string;
  detail: string;
  incident_code?: string;
  unit?: string;
};

export type Task = {
  id: string;
  incident_id: string;
  title: string;
  assignee: string;
  status: string;
  due_at: string;
  created_at: string;
};

export type AuditEntry = {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  object_type: string;
  object_id: string;
  payload: string;
  prev_hash: string;
  hash: string;
};

export type Checkpoint = {
  id: string;
  seq: number;
  head_hash: string;
  signature: string;
  public_key: string;
  created_at: string;
};

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
  user?: User;
};

export type GraphNode = {
  id: string;
  kind: "incident" | "indicator";
  label: string;
  score?: number;
  unit?: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  label: string;
  weight: number;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type PivotIncident = {
  id: string;
  code: string;
  title: string;
  unit: string;
  severity: string;
  status: string;
  occurred_at: string;
  first_seen: string;
  source: string;
  artifact_id: string;
  shared: boolean;
};

export type PivotResult = {
  kind: string;
  value: string;
  incidents: PivotIncident[];
  hidden: number;
};

export type IngestResult = {
  artifactId?: string;
  filename?: string;
  error?: string;
  sha256?: string;
  indicatorCount?: number;
  eventCount?: number;
  summary?: string;
  indicators?: { kind: string; value: string; source: string }[];
  duplicates?: DuplicateRef[];
};

export type IncidentDetail = {
  incident: Incident;
  artifacts: ArtifactDetail[];
  indicators: Indicator[];
  events: EventRow[];
  tasks: Task[];
  leads: Correlation[];
  audit: AuditEntry[];
  raw_access: boolean;
  tlp: string;
  priority: string;
  techniques: Technique[];
  assets: Asset[];
  access_requests: AccessRequest[];
  indicator_meta: IndicatorMeta[];
  playbook_runs: PlaybookRun[];
};

export type VerifyResult = {
  ok: boolean;
  checked: number;
  head: string;
  issues: string[];
  broken_seq?: number;
  verified_at: string;
};

export type CheckpointVerification = {
  ok: boolean;
  checked: number;
  issues: string[];
};

export type AuditVerifyResponse = {
  chain: VerifyResult;
  checkpoints: CheckpointVerification;
};

export type BundlePayload = {
  version: number;
  exported_at: string;
  unit: string;
  campaign: string;
  indicators: {
    kind: string;
    value: string;
    norm: string;
    first_seen: string;
    source_incident: string;
    unit: string;
  }[];
};

export type BundleExport = {
  bundle: BundlePayload;
  signature: string;
  public_key: string;
};

export type LoginResponse = { user: User };
export type MeResponse = { user: User | null };

export type CustodyEvent = {
  id: string;
  artifact_id: string;
  ts: string;
  actor: string;
  action: string;
  from_unit: string;
  to_unit: string;
  location: string;
  note: string;
  sha256: string;
  prev_hash: string;
  hash: string;
};

export type AnalysisRule = {
  rule: string;
  description: string;
  severity: string;
  tags: string[];
  matches: string[];
};

export type FileAnalysis = {
  artifact_id: string;
  file_type: string;
  extension: string;
  mismatch: boolean;
  entropy: number;
  embedded_urls: string[];
  suspicious_strings: string[];
  macro: boolean;
  nested: boolean;
  rules: AnalysisRule[];
  verdict: string;
  metadata: Record<string, string | number>;
  explanations: string[];
  created_at: string;
};

export type AccessRequest = {
  id: string;
  artifact_id: string;
  incident_id: string;
  requester: string;
  requester_unit: string;
  scope: string;
  reason: string;
  status: string;
  decided_by?: string;
  decided_at?: string;
  expires_at?: string;
  created_at: string;
};

export type Passport = {
  artifact: ArtifactDetail;
  custody: CustodyEvent[];
  chain_ok: boolean;
  chain_head: string;
  broken_seq?: string;
  tlp: string;
  analysis: FileAnalysis | null;
  access: AccessRequest[];
};

export type IndicatorMeta = {
  indicator_id: string;
  status: string;
  confidence: string;
  first_seen: string;
  last_seen: string;
  sightings: number;
  expires_at: string;
  classification: string;
  updated_at: string;
};

export type Technique = {
  id: string;
  incident_id: string;
  technique_id: string;
  name: string;
  artifact_id: string;
  explanation: string;
  confidence: string;
  status: string;
  created_at: string;
};

export type Asset = {
  id: string;
  name: string;
  hostname: string;
  unit: string;
  owner: string;
  criticality: string;
  status: string;
  notes: string;
  created_at: string;
};

export type PlaybookStep = { title: string; role: string; evidence_required?: string };

export type Playbook = {
  id: string;
  name: string;
  incident_type: string;
  version: number;
  steps: PlaybookStep[];
};

export type PlaybookRun = {
  id: string;
  playbook_id: string;
  incident_id: string;
  status: string;
  created_at: string;
};
