import { all, first, run, now, uid, getSetting, setSetting } from "./db";
import { sha256Hex, canonical, signB64, verifyB64, generateSigningKey, unb64 } from "./integrity";
import type { AuditEntry, Checkpoint } from "./types";

const GENESIS = "0".repeat(64);

export async function appendAudit(
  db: D1Database, actor: string, action: string, objectType: string, objectID: string, payload: unknown
): Promise<AuditEntry> {
  const body = canonical(payload ?? {});
  const last = await first<{ hash: string }>(db, `SELECT hash FROM audit ORDER BY seq DESC LIMIT 1`);
  const prev = last?.hash ?? GENESIS;
  const hash = await sha256Hex(prev + body);
  const ts = now();
  const res = await run(
    db,
    `INSERT INTO audit(ts,actor,action,object_type,object_id,payload,prev_hash,hash) VALUES(?,?,?,?,?,?,?,?)`,
    ts, actor, action, objectType, objectID, body, prev, hash
  );
  return { seq: res.meta?.last_row_id ?? 0, ts, actor, action, object_type: objectType, object_id: objectID, payload: body, prev_hash: prev, hash };
}

export async function listAudit(db: D1Database, limit = 300, incidentId = ""): Promise<AuditEntry[]> {
  if (incidentId) {
    return await all<AuditEntry>(
      db,
      `SELECT * FROM audit WHERE payload LIKE ? OR (object_type='incident' AND object_id=?)
       ORDER BY seq DESC LIMIT ?`,
      `%${incidentId}%`, incidentId, limit
    );
  }
  return await all<AuditEntry>(db, `SELECT * FROM audit ORDER BY seq DESC LIMIT ?`, limit);
}

export type VerifyResult = {
  ok: boolean;
  checked: number;
  head: string;
  issues: string[];
  broken_seq?: number;
  verified_at: string;
};

export async function verifyAudit(db: D1Database): Promise<VerifyResult> {
  const rows = await all<AuditEntry>(db, `SELECT seq,payload,prev_hash,hash FROM audit ORDER BY seq`);
  const res: VerifyResult = { ok: true, checked: 0, head: GENESIS, issues: [], verified_at: now() };
  let prev = GENESIS;
  for (const r of rows) {
    res.checked++;
    const recomputed = await sha256Hex(prev + r.payload);
    if (r.prev_hash !== prev) {
      res.ok = false;
      res.broken_seq ??= r.seq;
      res.issues.push(`link mismatch at seq ${r.seq}: stored prev_hash does not match the previous entry`);
    }
    if (r.hash !== recomputed) {
      res.ok = false;
      res.broken_seq ??= r.seq;
      res.issues.push(`payload mismatch at seq ${r.seq}: stored hash does not match SHA256(prev_hash || payload)`);
    }
    prev = r.hash;
    res.head = r.hash;
  }
  return res;
}

export async function tamperAudit(db: D1Database, seq: number) {
  const row = await first<{ payload: string }>(db, `SELECT payload FROM audit WHERE seq=?`, seq);
  if (!row) throw new Error("audit entry not found");
  await setSetting(db, `tamper_backup_${seq}`, row.payload);
  const tampered = row.payload.replace('"', "'");
  const next = tampered === row.payload ? row.payload + " " : tampered;
  await run(db, `UPDATE audit SET payload=? WHERE seq=?`, next, seq);
  return { before: row.payload, after: next };
}

export async function restoreAudit(db: D1Database, seq: number) {
  const original = await getSetting(db, `tamper_backup_${seq}`, "");
  if (!original) throw new Error("no tamper backup for this entry");
  await run(db, `UPDATE audit SET payload=? WHERE seq=?`, original, seq);
  await run(db, `DELETE FROM settings WHERE key=?`, `tamper_backup_${seq}`);
}

async function rememberKey(db: D1Database, pub: string, source: string) {
  const exists = await first<{ id: string }>(db, `SELECT id FROM signing_keys WHERE public_key=?`, pub);
  if (!exists) {
    await run(
      db,
      `INSERT INTO signing_keys(id,public_key,source,created_at,retired_at) VALUES(?,?,?,?,'')`,
      uid(), pub, source, now()
    );
  }
}

async function publicFromPrivate(privPkcs8: string): Promise<string | null> {
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      unb64(privPkcs8) as unknown as BufferSource,
      { name: "Ed25519" } as unknown as AlgorithmIdentifier,
      true,
      ["sign"]
    );
    const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
    if (!jwk.x) return null;
    const raw = jwk.x.replace(/-/g, "+").replace(/_/g, "/");
    return raw + "=".repeat((4 - (raw.length % 4)) % 4);
  } catch {
    return null;
  }
}

/**
 * The signing key is read from a Worker secret when provided, so it never lives
 * in the mutable incident database. The D1 fallback is for local demos only.
 */
export async function signingKeys(
  db: D1Database, envKey?: string, requireSecret = false
): Promise<{ priv: string; pub: string }> {
  if (envKey) {
    const pub = await publicFromPrivate(envKey);
    if (pub) {
      await rememberKey(db, pub, "env");
      return { priv: envKey, pub };
    }
  }
  if (requireSecret) {
    throw new Error("RANTAI_SIGNING_KEY is required in production; refusing to sign with a database key");
  }
  let priv = await getSetting(db, "signing_priv", "");
  let pub = await getSetting(db, "signing_pub", "");
  if (!priv || !pub) {
    const kp = await generateSigningKey();
    priv = kp.privateKey;
    pub = kp.publicKey;
    await setSetting(db, "signing_priv", priv);
    await setSetting(db, "signing_pub", pub);
  }
  await rememberKey(db, pub, envKey ? "database-fallback" : "database");
  return { priv, pub };
}

export async function rotateSigningKey(db: D1Database): Promise<{ priv: string; pub: string }> {
  const old = await signingKeys(db);
  const kp = await generateSigningKey();
  await setSetting(db, "signing_priv", kp.privateKey);
  await setSetting(db, "signing_pub", kp.publicKey);
  await rememberKey(db, kp.publicKey, "database");
  await run(db, `UPDATE signing_keys SET retired_at=? WHERE public_key=?`, now(), old.pub);
  return { priv: kp.privateKey, pub: kp.publicKey };
}

const checkpointMsg = (seq: number, hash: string) => `rantai-checkpoint:v1:${seq}:${hash}`;

export async function createCheckpoint(db: D1Database, envKey?: string, requireSecret = false): Promise<Checkpoint> {
  const { priv, pub } = await signingKeys(db, envKey, requireSecret);
  const head = await first<{ seq: number; hash: string }>(db, `SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1`);
  const seq = head?.seq ?? 0;
  const hash = head?.hash ?? GENESIS;
  const sig = await signB64(priv, checkpointMsg(seq, hash));
  const c: Checkpoint = { id: uid(), seq, head_hash: hash, signature: sig, public_key: pub, created_at: now() };
  await run(
    db,
    `INSERT INTO checkpoints(id,seq,head_hash,signature,public_key,created_at) VALUES(?,?,?,?,?,?)`,
    c.id, c.seq, c.head_hash, c.signature, c.public_key, c.created_at
  );
  return c;
}

export async function listCheckpoints(db: D1Database): Promise<Checkpoint[]> {
  return await all<Checkpoint>(db, `SELECT * FROM checkpoints ORDER BY seq DESC`);
}

export async function verifyCheckpoints(db: D1Database): Promise<{ ok: boolean; checked: number; issues: string[] }> {
  const rows = await listCheckpoints(db);
  const issues: string[] = [];
  for (const c of rows) {
    const ok = await verifyB64(c.public_key, checkpointMsg(c.seq, c.head_hash), c.signature);
    if (!ok) issues.push(`checkpoint for seq ${c.seq} failed signature verification`);
  }
  return { ok: issues.length === 0, checked: rows.length, issues };
}
