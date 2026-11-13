import { all, first, now, run, uid } from "./db";
import { canonical, sha256Hex } from "./integrity";
import type { CustodyEvent } from "./types";

const GENESIS = "0".repeat(64);

export type CustodyInput = {
  artifactId: string;
  actor: string;
  action: string;
  fromUnit?: string;
  toUnit?: string;
  location?: string;
  note?: string;
  sha256?: string;
};

export async function appendCustody(db: D1Database, input: CustodyInput): Promise<CustodyEvent> {
  const last = await first<{ hash: string }>(
    db,
    `SELECT hash FROM custody WHERE artifact_id=? ORDER BY rowid DESC LIMIT 1`,
    input.artifactId
  );
  const prev = last?.hash ?? GENESIS;
  const ts = now();
  const payload = canonical({
    artifact_id: input.artifactId,
    ts,
    actor: input.actor,
    action: input.action,
    from_unit: input.fromUnit ?? "",
    to_unit: input.toUnit ?? "",
    location: input.location ?? "",
    note: input.note ?? "",
    sha256: input.sha256 ?? "",
  });
  const hash = await sha256Hex(prev + payload);
  const id = uid();
  await run(
    db,
    `INSERT INTO custody(id,artifact_id,ts,actor,action,from_unit,to_unit,location,note,sha256,payload,prev_hash,hash)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, input.artifactId, ts, input.actor, input.action, input.fromUnit ?? "", input.toUnit ?? "",
    input.location ?? "", input.note ?? "", input.sha256 ?? "", payload, prev, hash
  );
  return {
    id, artifact_id: input.artifactId, ts, actor: input.actor, action: input.action,
    from_unit: input.fromUnit ?? "", to_unit: input.toUnit ?? "", location: input.location ?? "",
    note: input.note ?? "", sha256: input.sha256 ?? "", prev_hash: prev, hash,
  };
}

export async function custodyFor(db: D1Database, artifactId: string): Promise<CustodyEvent[]> {
  const rows = await all<CustodyEvent>(
    db,
    `SELECT id,artifact_id,ts,actor,action,COALESCE(from_unit,'') AS from_unit,COALESCE(to_unit,'') AS to_unit,
      COALESCE(location,'') AS location,COALESCE(note,'') AS note,COALESCE(sha256,'') AS sha256,
      prev_hash,hash FROM custody WHERE artifact_id=? ORDER BY rowid`,
    artifactId
  );
  return rows;
}

export type CustodyVerify = {
  ok: boolean;
  checked: number;
  head: string;
  issues: string[];
  broken_seq?: string;
};

export async function verifyCustody(db: D1Database, artifactId: string): Promise<CustodyVerify> {
  const rows = await all<{ id: string; payload: string; prev_hash: string; hash: string }>(
    db,
    `SELECT id,payload,prev_hash,hash FROM custody WHERE artifact_id=? ORDER BY rowid`,
    artifactId
  );
  const res: CustodyVerify = { ok: true, checked: 0, head: GENESIS, issues: [] };
  let prev = GENESIS;
  for (const r of rows) {
    res.checked++;
    const recomputed = await sha256Hex(prev + r.payload);
    if (r.prev_hash !== prev) {
      res.ok = false;
      res.broken_seq ??= r.id;
      res.issues.push(`link mismatch at custody entry ${r.id}`);
    }
    if (r.hash !== recomputed) {
      res.ok = false;
      res.broken_seq ??= r.id;
      res.issues.push(`payload mismatch at custody entry ${r.id}`);
    }
    prev = r.hash;
    res.head = r.hash;
  }
  return res;
}

export async function approvedAccess(
  db: D1Database, username: string, artifactId: string
): Promise<boolean> {
  const row = await first<{ id: string }>(
    db,
    `SELECT id FROM access_requests
     WHERE artifact_id=? AND requester=? AND status='approved'
       AND (expires_at IS NULL OR expires_at='' OR expires_at>?)`,
    artifactId, username, now()
  );
  return !!row;
}
