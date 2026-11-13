import { addIndicator, createArtifact, createEvent } from "./queries";
import { first } from "./db";
import { appendAudit } from "./audit";
import { parseArtifact } from "./parse";
import { sha256Hex } from "./integrity";
import { blindHash } from "./correlate";
import { appendCustody } from "./custody";
import { analyzeBytes } from "./static";
import { initIndicatorMeta, saveAnalysis } from "./extras";
import { d1Storage, type EvidenceStorage } from "./storage";

export type IngestInput = {
  incidentId: string;
  filename: string;
  mime: string;
  data: Uint8Array;
  actor: string;
  actorUnit?: string;
  shareScope?: string;
  note?: string;
  salt: string;
  store?: EvidenceStorage;
};

export type IngestResult = {
  artifactId: string;
  sha256: string;
  indicatorCount: number;
  eventCount: number;
  summary: string;
  indicators: { kind: string; value: string; source: string }[];
};

export async function ingestArtifact(db: D1Database, input: IngestInput): Promise<IngestResult> {
  const sum = await sha256Hex(input.data);
  const artifactId = await createArtifact(db, {
    incident_id: input.incidentId,
    filename: input.filename,
    mime: input.mime || "application/octet-stream",
    size: input.data.length,
    sha256: sum,
    storage_path: `d1://${sum.slice(0, 16)}`,
    content: new Uint8Array(0),
    share_scope: input.shareScope ?? "full",
    note: input.note ?? "",
    uploaded_by: input.actor,
  });

  await (input.store ?? d1Storage(db)).put(artifactId, input.data);

  const parsed = await parseArtifact(input.data, input.filename, input.mime || "");
  const analysis = analyzeBytes(input.data, input.filename);
  await saveAnalysis(db, artifactId, analysis);

  await appendCustody(db, {
    artifactId, actor: input.actor, action: "collected",
    fromUnit: input.actorUnit ?? "", location: "field upload",
    note: input.note || "Evidence uploaded by reporting unit", sha256: sum,
  });
  await appendCustody(db, {
    artifactId, actor: input.actor, action: "hashed",
    fromUnit: input.actorUnit ?? "", location: "RANTAI ingest",
    note: "SHA-256 calculated at intake and stored in the evidence manifest", sha256: sum,
  });
  if (analysis.mismatch) {
    await appendCustody(db, {
      artifactId, actor: "system", action: "flagged",
      location: "static analysis",
      note: `Extension ${analysis.extension} does not match detected type ${analysis.file_type}`, sha256: sum,
    });
  }

  for (const i of parsed.indicators) {
    await addIndicator(db, {
      incident_id: input.incidentId,
      artifact_id: artifactId,
      kind: i.kind,
      raw_value: i.value,
      norm_value: i.norm,
      first_seen: i.seen,
      source: i.source,
      shared: true,
      blind_hash: await blindHash(input.salt, i.kind, i.norm),
    });
    const row = await first<{ id: string }>(
      db,
      `SELECT id FROM indicators WHERE incident_id=? AND kind=? AND norm_value=?`,
      input.incidentId, i.kind, i.norm
    );
    if (row) await initIndicatorMeta(db, row.id, i.seen, i.kind);
  }

  await createEvent(db, {
    incident_id: input.incidentId,
    artifact_id: artifactId,
    ts: new Date().toISOString(),
    source: input.filename,
    kind: "artifact",
    title: "Evidence ingested: " + input.filename,
    detail: parsed.summary,
  });

  for (const e of parsed.events.slice(0, 40)) {
    await createEvent(db, {
      incident_id: input.incidentId,
      artifact_id: artifactId,
      ts: e.ts,
      source: input.filename,
      kind: e.kind,
      title: e.title,
      detail: e.detail,
    });
  }

  await appendAudit(db, input.actor, "artifact.ingested", "artifact", artifactId, {
    incident_id: input.incidentId,
    filename: input.filename,
    sha256: sum,
    size: input.data.length,
    indicators: parsed.indicators.length,
    events: parsed.events.length,
  });

  return {
    artifactId,
    sha256: sum,
    indicatorCount: parsed.indicators.length,
    eventCount: parsed.events.length,
    summary: parsed.summary,
    indicators: parsed.indicators.slice(0, 40).map((i) => ({ kind: i.kind, value: i.value, source: i.source })),
  };
}
