export type {
  User,
  Incident,
  Artifact,
  ArtifactDetail,
  DuplicateRef,
  Indicator,
  Reason,
  Correlation,
  EventRow,
  Task,
  AuditEntry,
  Checkpoint,
  DashboardData,
  GraphData,
  GraphNode,
  GraphEdge,
  PivotIncident,
  PivotResult,
  IngestResult,
  IncidentDetail,
  VerifyResult,
  CheckpointVerification,
  AuditVerifyResponse,
  BundlePayload,
  BundleExport,
  LoginResponse,
  MeResponse,
  CustodyEvent,
  FileAnalysis,
  AnalysisRule,
  AccessRequest,
  Passport,
  IndicatorMeta,
  Technique,
  Asset,
  Playbook,
  PlaybookStep,
  PlaybookRun,
} from "../worker/types";

import type { User } from "../worker/types";

export type NotifyTone = "ok" | "error" | "info";
export type Notify = (msg: string, tone?: NotifyTone) => void;
export type Goto = (name: string, id?: string) => void;

export type PageProps = {
  user: User;
  goto: Goto;
  notify: Notify;
};
