import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import cfg from "../config/seed.json";
import { all, first, now, uid, getSetting, setSetting, run, createSession, deleteSession, deleteUserSessions, userBySession } from "./db";
import type { AppEnv } from "./db";
import { clientIP, csrfOk, ensureCsrfCookie, rateLimit, tlpAllowsRaw } from "./security";
import * as Q from "./queries";
import {
  appendAudit, listAudit, verifyAudit, tamperAudit, restoreAudit,
  createCheckpoint, listCheckpoints, verifyCheckpoints, signingKeys, rotateSigningKey,
} from "./audit";
import { ingestArtifact } from "./ingest";
import { recomputeFor, recomputeAll, buildGraph, blindHash } from "./correlate";
import { ensureReady, ensureSalt } from "./seed";
import { sha256Hex, pbkdf2Hex, canonical, signB64, verifyB64, merkleRoot, unb64 } from "./integrity";
import { analyzeBytes } from "./static";
import { runBenchmark, runAdversarial } from "./benchmark";
import { artifacts as listArtifacts, getArtifact, getIncident, listIncidents } from "./queries";
import { storageFor } from "./storage";
import type {
  Artifact, AuditEntry, BundlePayload, Correlation, DuplicateRef, EventRow, Incident, Indicator,
  PivotIncident, Task, UserRecord, VerifyResult,
} from "./types";
import {
  addTechnique, assetsForIncident, createAccessRequest, createAsset,
  decideAccessRequest, getAnalysis, getIncidentMeta, indicatorMetaForIncident, linkAsset,
  listAccessRequests, listAssets, listPlaybooks, playbookRunsForIncident, runPlaybook,
  techniquesForIncident, unlinkAsset, updateIndicatorMeta, setIncidentMeta,
} from "./extras";
import { appendCustody, approvedAccess, custodyFor, verifyCustody } from "./custody";

type Ctx = Context<{ Bindings: AppEnv }>;
type SeedCfg = typeof cfg;

export const api = new Hono<{ Bindings: AppEnv }>();

api.use("*", async (c, next) => {
  try {
    await ensureReady(c.env);
  } catch (e) {
    return c.json({ error: "init failed: " + String(e instanceof Error ? e.message : e) }, 500);
  }
  if (!csrfOk(c)) {
    return c.json({ error: "csrf token missing or invalid" }, 403);
  }
  ensureCsrfCookie(c, new URL(c.req.url).protocol === "https:");
  await next();
});

async function currentUser(c: Ctx): Promise<UserRecord | null> {
  const token = getCookie(c, "rantai_session");
  if (!token) return null;
  return (await userBySession(c.env.DB, token)) as UserRecord | null;
}

function canSeeRaw(user: UserRecord | null, incident: Incident) {
  if (!user) return false;
  return user.role === "coordinator" || user.unit === incident.unit;
}

async function canDownload(db: D1Database, user: UserRecord | null, incident: Incident, artifact: Artifact) {
  if (!user) return false;
  if (canSeeRaw(user, incident)) return true;
  const meta = await getIncidentMeta(db, incident.id);
  const approved = await approvedAccess(db, user.username, artifact.id);
  // Unit policy is a hard cap: wider TLP never relaxes `restricted`.
  if (artifact.share_scope === "restricted") return false;
  return tlpAllowsRaw(meta.tlp, false, approved);
}

async function requireUser(c: Ctx) {
  const u = await currentUser(c);
  if (!u) {
    c.status(401);
    return null;
  }
  return u;
}

// ---------------- auth ----------------

api.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const ip = clientIP(c);

  if (!rateLimit(`login:${ip}`, 20, 5 * 60_000) || !rateLimit(`login:${ip}:${username}`, 5, 5 * 60_000)) {
    await appendAudit(c.env.DB, username || "anonymous", "auth.rate_limited", "user", "", { ip });
    return c.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, 429);
  }

  const row = await first<UserRecord>(c.env.DB, `SELECT * FROM users WHERE username=?`, username);
  if (!row) return c.json({ error: "Username atau kata sandi salah." }, 401);
  const hash = await pbkdf2Hex(password, row.salt);
  if (hash !== row.hash) return c.json({ error: "Username atau kata sandi salah." }, 401);

  const session = await createSession(c.env.DB, row.id);
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, "rantai_session", session.token, {
    httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 8, secure,
  });
  ensureCsrfCookie(c, secure);
  await appendAudit(c.env.DB, row.username, "auth.login", "user", row.id, { username: row.username, ip });
  return c.json({ user: { id: row.id, username: row.username, name: row.name, role: row.role, unit: row.unit } });
});

api.post("/logout", async (c) => {
  const token = getCookie(c, "rantai_session");
  if (token) await deleteSession(c.env.DB, token);
  deleteCookie(c, "rantai_session", { path: "/" });
  return c.json({ ok: true });
});

api.post("/logout-all", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  await deleteUserSessions(c.env.DB, u.id);
  deleteCookie(c, "rantai_session", { path: "/" });
  await appendAudit(c.env.DB, u.username, "auth.sessions_revoked", "user", u.id, {});
  return c.json({ ok: true });
});

api.get("/me", async (c) => {
  const u = await currentUser(c);
  return c.json({ user: u });
});

api.get("/users", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json({ users: await Q.users(c.env.DB) });
});

// Local-only convenience for capturing submission screenshots. It refuses any
// request whose hostname is not localhost, so a deployed Worker rejects it.
api.get("/dev/login", async (c) => {
  const host = new URL(c.req.url).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    return c.json({ error: "dev autologin is only available on localhost" }, 403);
  }
  const username = c.req.query("user") ?? "alpha";
  const row = await first<UserRecord>(c.env.DB, `SELECT * FROM users WHERE username=?`, username);
  if (!row) return c.json({ error: "unknown demo user" }, 404);
  const token = uid() + uid();
  await c.env.DB.prepare(`INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)`).bind(token, row.id, now()).run();
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, "rantai_session", token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 86400, secure });
  ensureCsrfCookie(c, secure);
  const to = c.req.query("to") ?? "/";
  return c.redirect(to.startsWith("/") ? to : "/");
});

api.get("/health", async (c) => {
  const salt = await ensureSalt(c.env);
  return c.json({ ok: true, time: now(), salt_fingerprint: (await sha256Hex(salt)).slice(0, 12) });
});

// ---------------- dashboard / incidents ----------------

api.get("/dashboard", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const d = await Q.dashboard(c.env.DB);
  return c.json({ ...d, user: u });
});

api.get("/incidents", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json({ incidents: await listIncidents(c.env.DB) });
});

api.post("/incidents", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const count = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM incidents`))?.n ?? 0;
  const code = String(body.code ?? `INC-2026-${String(count + 1).padStart(3, "0")}`);
  const id = await Q.createIncident(c.env.DB, {
    code,
    title: String(body.title ?? "Untitled incident"),
    category: String(body.category ?? "Phishing"),
    severity: String(body.severity ?? "medium"),
    status: "open",
    unit: String(body.unit ?? u.unit),
    reporter: String(body.reporter ?? u.name),
    summary: String(body.summary ?? ""),
    occurred_at: String(body.occurred_at ?? now()),
    created_by: u.username,
  });
  await Q.createEvent(c.env.DB, {
    incident_id: id, ts: String(body.occurred_at ?? now()), source: "report", kind: "report",
    title: "Incident report filed: " + code, detail: String(body.summary ?? ""),
  });
  await appendAudit(c.env.DB, u.username, "incident.created", "incident", id, {
    incident_id: id, code, unit: body.unit ?? u.unit, severity: body.severity ?? "medium",
  });
  const leads = await recomputeFor(c.env.DB, id, await ensureSalt(c.env));
  return c.json({ incident: await getIncident(c.env.DB, id), leads });
});

api.patch("/incidents/:id/status", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc) return c.json({ error: "not found" }, 404);
  if (u.role !== "coordinator" && u.unit !== inc.unit) return c.json({ error: "forbidden for this unit" }, 403);
  await Q.updateIncidentStatus(c.env.DB, inc.id, String(body.status ?? "open"));
  await appendAudit(c.env.DB, u.username, "incident.status_changed", "incident", inc.id, {
    incident_id: inc.id, from: inc.status, to: body.status,
  });
  return c.json({ ok: true });
});

api.patch("/incidents/:id/tlp", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const body: { tlp?: string } = await c.req.json().catch(() => ({}));
  const allowed = ["clear", "green", "amber", "amber+strict", "red"];
  const tlp = String(body.tlp ?? "").toLowerCase();
  if (!allowed.includes(tlp)) return c.json({ error: "invalid TLP label" }, 400);
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc) return c.json({ error: "not found" }, 404);
  const meta = await getIncidentMeta(c.env.DB, inc.id);
  await setIncidentMeta(c.env.DB, inc.id, tlp, meta.priority);
  await appendAudit(c.env.DB, u.username, "incident.tlp_changed", "incident", inc.id, { from: meta.tlp, to: tlp });
  return c.json({ ok: true, tlp });
});

api.get("/incidents/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc) return c.json({ error: "not found" }, 404);
  const raw = canSeeRaw(u, inc);
  if (!raw && (await getIncidentMeta(c.env.DB, inc.id)).tlp === "red") {
    return c.json({ error: "incident is TLP:RED and not disclosed to this unit" }, 403);
  }

  const arts = await listArtifacts(c.env.DB, inc.id);
  const verifiedArtifacts = [];
  for (const a of arts) {
    const content = await storageFor(c.env).get(a.id);
    const ok = content ? (await sha256Hex(content)) === a.sha256 : false;
    const duplicates = await all<DuplicateRef>(
      c.env.DB,
      `SELECT i.id,i.code,i.title,i.unit FROM artifacts a JOIN incidents i ON i.id=a.incident_id
       WHERE a.sha256=? AND a.incident_id<>? ORDER BY i.occurred_at`,
      a.sha256, inc.id
    );
    verifiedArtifacts.push({
      ...a,
      verified: ok,
      restricted: !(await canDownload(c.env.DB, u, inc, a)),
      duplicates,
      storage_path: undefined,
    });
  }

  let inds = await Q.indicators(c.env.DB, inc.id);
  if (!raw) inds = inds.filter((i) => i.shared);

  const evs = await Q.events(c.env.DB, inc.id);
  const tsk = await Q.tasks(c.env.DB, inc.id);
  const leads = await Q.correlationsForIncident(c.env.DB, inc.id);
  for (const l of leads) {
    l.a = (await getIncident(c.env.DB, l.a_id)) ?? undefined;
    l.b = (await getIncident(c.env.DB, l.b_id)) ?? undefined;
  }
  const audit = await listAudit(c.env.DB, 80, inc.id);
  const meta = await getIncidentMeta(c.env.DB, inc.id);
  const techniques = await techniquesForIncident(c.env.DB, inc.id);
  const assets = await assetsForIncident(c.env.DB, inc.id);
  const accessRequests = await listAccessRequests(c.env.DB, { incidentId: inc.id });
  const indicatorMeta = await indicatorMetaForIncident(c.env.DB, inc.id);
  const playbookRuns = await playbookRunsForIncident(c.env.DB, inc.id);
  return c.json({
    incident: inc, artifacts: verifiedArtifacts, indicators: inds, events: evs,
    tasks: tsk, leads, audit, raw_access: raw,
    tlp: meta.tlp, priority: meta.priority, techniques, assets,
    access_requests: accessRequests, indicator_meta: indicatorMeta, playbook_runs: playbookRuns,
  });
});

api.post("/incidents/:id/artifacts", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc) return c.json({ error: "not found" }, 404);
  if (u.role !== "coordinator" && u.unit !== inc.unit) return c.json({ error: "forbidden for this unit" }, 403);
  const form = await c.req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return c.json({ error: "no files" }, 400);
  const scope = String(form.get("share_scope") ?? "full");
  const note = String(form.get("note") ?? "");
  const salt = await ensureSalt(c.env);
  const results = [];
  for (const f of files) {
    const limit = c.env.STORE ? 50_000_000 : 900_000;
    if (f.size > limit) {
      results.push({ filename: f.name, error: `File exceeds ${Math.round(limit / 1_000_000)} MB limit for this storage provider.` });
      continue;
    }
    const data = new Uint8Array(await f.arrayBuffer());
    const r = await ingestArtifact(c.env.DB, {
      incidentId: inc.id, filename: f.name, mime: f.type, data,
      actor: u.username, actorUnit: u.unit, shareScope: scope, note, salt,
      store: storageFor(c.env),
    });
    const duplicates = await all<DuplicateRef>(
      c.env.DB,
      `SELECT i.id,i.code,i.title,i.unit FROM artifacts a JOIN incidents i ON i.id=a.incident_id
       WHERE a.sha256=? AND a.incident_id<>?`,
      r.sha256, inc.id
    );
    results.push({ ...r, duplicates });
  }
  const leads = await recomputeFor(c.env.DB, inc.id, salt);
  return c.json({ results, leads });
});

api.get("/artifacts/:id/download", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const a = await getArtifact(c.env.DB, c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, a.incident_id);
  if (!inc || !(await canDownload(c.env.DB, u, inc, a))) {
    await appendAudit(c.env.DB, u.username, "artifact.download_denied", "artifact", a.id, { incident_id: a.incident_id });
    return c.json({ error: "raw evidence is restricted for this unit" }, 403);
  }
  const content = await storageFor(c.env).get(a.id);
  if (!content) return c.json({ error: "content unavailable" }, 404);
  await appendAudit(c.env.DB, u.username, "artifact.downloaded", "artifact", a.id, { incident_id: a.incident_id, sha256: a.sha256 });
  return new Response(content as unknown as BodyInit, {
    headers: {
      "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${a.filename}"`,
    },
  });
});

api.post("/artifacts/:id/share", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const scope = String(body.scope ?? "full");
  const a = await getArtifact(c.env.DB, c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, a.incident_id);
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) {
    return c.json({ error: "forbidden for this unit" }, 403);
  }
  await c.env.DB.prepare(`UPDATE artifacts SET share_scope=? WHERE id=?`).bind(scope, a.id).run();
  await appendAudit(c.env.DB, u.username, "artifact.share_scope_changed", "artifact", c.req.param("id"), { scope });
  return c.json({ ok: true });
});

api.get("/pivot", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const kind = c.req.query("kind") ?? "";
  const value = c.req.query("value") ?? "";
  if (!kind || !value) return c.json({ error: "kind and value are required" }, 400);
  const rows = await all<PivotIncident>(
    c.env.DB,
    `SELECT i.id,i.code,i.title,i.unit,i.severity,i.status,i.occurred_at,
      x.first_seen,x.source,COALESCE(x.artifact_id,'') AS artifact_id,x.shared
     FROM indicators x JOIN incidents i ON i.id=x.incident_id
     WHERE x.kind=? AND x.norm_value=? ORDER BY x.first_seen`,
    kind, value
  );
  const visible = rows.filter((r) => u.role === "coordinator" || r.unit === u.unit || r.shared);
  await appendAudit(c.env.DB, u.username, "indicator.pivoted", "indicator", kind + ":" + value, {
    kind, value, incidents: visible.length,
  });
  return c.json({ kind, value, incidents: visible, hidden: rows.length - visible.length });
});

api.post("/indicators/:id/share", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const ind = await first<{ incident_id: string }>(c.env.DB, `SELECT incident_id FROM indicators WHERE id=?`, c.req.param("id"));
  if (!ind) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, ind.incident_id);
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) {
    return c.json({ error: "forbidden for this unit" }, 403);
  }
  await Q.setIndicatorShared(c.env.DB, c.req.param("id"), !!body.shared);
  await appendAudit(c.env.DB, u.username, "indicator.sharing_changed", "indicator", c.req.param("id"), { shared: !!body.shared });
  return c.json({ ok: true });
});

// ---------------- custody, access, lifecycle, context ----------------

api.get("/artifacts/:id/passport", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const a = await getArtifact(c.env.DB, c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, a.incident_id);
  if (!inc) return c.json({ error: "not found" }, 404);
  if (!canSeeRaw(u, inc) && (await getIncidentMeta(c.env.DB, inc.id)).tlp === "red") {
    return c.json({ error: "incident is TLP:RED" }, 403);
  }

  const content = await storageFor(c.env).get(a.id);
  const verified = content ? (await sha256Hex(content)) === a.sha256 : false;
  const duplicates = await all<DuplicateRef>(
    c.env.DB,
    `SELECT i.id,i.code,i.title,i.unit FROM artifacts a JOIN incidents i ON i.id=a.incident_id
     WHERE a.sha256=? AND a.incident_id<>? ORDER BY i.occurred_at`,
    a.sha256, inc.id
  );
  const chain = await verifyCustody(c.env.DB, a.id);
  const meta = await getIncidentMeta(c.env.DB, inc.id);
  return c.json({
    artifact: { ...a, storage_path: undefined, verified, restricted: !(await canDownload(c.env.DB, u, inc, a)), duplicates },
    custody: await custodyFor(c.env.DB, a.id),
    chain_ok: chain.ok,
    chain_head: chain.head,
    broken_seq: chain.broken_seq,
    tlp: meta.tlp,
    analysis: await getAnalysis(c.env.DB, a.id),
    access: await listAccessRequests(c.env.DB, { artifactId: a.id }),
  });
});

api.post("/artifacts/:id/custody", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const a = await getArtifact(c.env.DB, c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, a.incident_id);
  if (!inc) return c.json({ error: "not found" }, 404);
  if (!canSeeRaw(u, inc)) return c.json({ error: "only the owning unit can record custody" }, 403);

  const body: { action?: string; note?: string; to_unit?: string; location?: string } =
    await c.req.json().catch(() => ({}));
  const allowed = ["transfer", "received", "verified", "note", "sealed"];
  const action = String(body.action ?? "note");
  if (!allowed.includes(action)) return c.json({ error: "unknown custody action" }, 400);
  if (action === "transfer" && !body.to_unit) return c.json({ error: "to_unit is required for a transfer" }, 400);

  const event = await appendCustody(c.env.DB, {
    artifactId: a.id,
    actor: u.username,
    action,
    fromUnit: action === "transfer" ? inc.unit : u.unit,
    toUnit: body.to_unit,
    location: body.location || "RANTAI",
    note: body.note || "",
    sha256: a.sha256,
  });
  await appendAudit(c.env.DB, u.username, "custody." + action, "artifact", a.id, {
    incident_id: inc.id, to_unit: body.to_unit ?? "", note: body.note ?? "",
  });
  return c.json({ event });
});

api.post("/artifacts/:id/accept", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const a = await getArtifact(c.env.DB, c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, a.incident_id);
  if (!inc) return c.json({ error: "not found" }, 404);
  const last = await first<{ action: string; to_unit: string }>(
    c.env.DB,
    `SELECT action,COALESCE(to_unit,'') AS to_unit FROM custody WHERE artifact_id=? ORDER BY rowid DESC LIMIT 1`,
    a.id
  );
  if (!last || last.action !== "transfer") return c.json({ error: "no pending transfer" }, 400);
  if (u.role !== "coordinator" && last.to_unit && last.to_unit !== u.unit) {
    return c.json({ error: "transfer addressed to another unit" }, 403);
  }
  const event = await appendCustody(c.env.DB, {
    artifactId: a.id, actor: u.username, action: "received",
    fromUnit: last.to_unit, toUnit: u.unit, location: "RANTAI",
    note: "Recipient accepted custody and re-verified the artefact", sha256: a.sha256,
  });
  await appendAudit(c.env.DB, u.username, "custody.received", "artifact", a.id, { incident_id: inc.id });
  return c.json({ event });
});

api.post("/access-requests", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { artifact_id?: string; scope?: string; reason?: string } =
    await c.req.json().catch(() => ({}));
  const a = await getArtifact(c.env.DB, String(body.artifact_id ?? ""));
  if (!a) return c.json({ error: "artifact not found" }, 404);
  const scope = String(body.scope ?? "raw");
  if (!["metadata", "indicators", "raw"].includes(scope)) return c.json({ error: "invalid scope" }, 400);
  const id = await createAccessRequest(c.env.DB, {
    artifact_id: a.id,
    incident_id: a.incident_id,
    requester: u.username,
    requester_unit: u.unit,
    scope,
    reason: String(body.reason ?? ""),
  });
  await appendAudit(c.env.DB, u.username, "access.requested", "artifact", a.id, {
    incident_id: a.incident_id, scope, reason: body.reason ?? "",
  });
  return c.json({ id });
});

api.get("/access-requests", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const incidentId = c.req.query("incident") ?? "";
  const filter = u.role === "coordinator" ? { incidentId } : { requester: u.username, incidentId };
  return c.json({ requests: await listAccessRequests(c.env.DB, filter) });
});

api.post("/access-requests/:id/decide", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const body: { status?: string; ttl_days?: number } = await c.req.json().catch(() => ({}));
  const status = body.status === "approved" ? "approved" : "rejected";
  const row = await decideAccessRequest(c.env.DB, c.req.param("id"), status, u.username, Number(body.ttl_days ?? 3));
  if (!row) return c.json({ error: "not found" }, 404);
  await appendCustody(c.env.DB, {
    artifactId: row.artifact_id,
    actor: u.username,
    action: status === "approved" ? "access_granted" : "access_denied",
    fromUnit: row.requester_unit,
    note: `${status} ${row.scope} access for ${row.requester}`,
  });
  await appendAudit(c.env.DB, u.username, "access." + status, "artifact", row.artifact_id, {
    incident_id: row.incident_id, requester: row.requester, scope: row.scope,
  });
  return c.json({ request: row });
});

api.patch("/indicators/:id/lifecycle", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const row = await first<{ id: string; incident_id: string }>(
    c.env.DB, `SELECT id,incident_id FROM indicators WHERE id=?`, c.req.param("id")
  );
  if (!row) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, row.incident_id);
  if (!inc) return c.json({ error: "not found" }, 404);
  if (!canSeeRaw(u, inc)) return c.json({ error: "only the owning unit can change indicator lifecycle" }, 403);

  const body: { status?: string; confidence?: string } = await c.req.json().catch(() => ({}));
  const statuses = ["suspicious", "confirmed", "false_positive", "benign", "expired", "investigating"];
  if (body.status && !statuses.includes(body.status)) return c.json({ error: "invalid status" }, 400);
  await updateIndicatorMeta(c.env.DB, row.id, { status: body.status, confidence: body.confidence });
  await appendAudit(c.env.DB, u.username, "indicator.lifecycle_changed", "indicator", row.id, {
    incident_id: inc.id, status: body.status ?? "", confidence: body.confidence ?? "",
  });

  const salt = await ensureSalt(c.env);
  const leads = await recomputeFor(c.env.DB, inc.id, salt);
  await run(
    c.env.DB,
    `DELETE FROM correlations WHERE (a_id=? OR b_id=?) AND score<25`,
    inc.id, inc.id
  );
  return c.json({ ok: true, leads: leads.length });
});

api.get("/assets", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json({ assets: await listAssets(c.env.DB) });
});

api.post("/assets", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { name?: string; hostname?: string; unit?: string; owner?: string; criticality?: string; status?: string; notes?: string } =
    await c.req.json().catch(() => ({}));
  const id = await createAsset(c.env.DB, {
    name: String(body.name ?? ""), hostname: String(body.hostname ?? ""), unit: String(body.unit ?? u.unit),
    owner: String(body.owner ?? ""), criticality: String(body.criticality ?? "medium"),
    status: String(body.status ?? "active"), notes: String(body.notes ?? ""),
  });
  await appendAudit(c.env.DB, u.username, "asset.created", "asset", id, { name: body.name });
  return c.json({ id });
});

api.post("/incidents/:id/assets", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { asset_id?: string } = await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  await linkAsset(c.env.DB, inc.id, String(body.asset_id ?? ""));
  await appendAudit(c.env.DB, u.username, "asset.linked", "incident", c.req.param("id"), { asset_id: body.asset_id });
  return c.json({ ok: true });
});

api.post("/incidents/:id/assets/remove", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { asset_id?: string } = await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  await unlinkAsset(c.env.DB, inc.id, String(body.asset_id ?? ""));
  return c.json({ ok: true });
});

api.get("/playbooks", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json({ playbooks: await listPlaybooks(c.env.DB) });
});

api.post("/incidents/:id/playbook", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { playbook_id?: string } = await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  const result = await runPlaybook(c.env.DB, String(body.playbook_id ?? ""), inc.id, u.name);
  if (!result) return c.json({ error: "playbook not found" }, 404);
  await appendAudit(c.env.DB, u.username, "playbook.started", "incident", c.req.param("id"), {
    playbook_id: body.playbook_id, tasks: result.tasks,
  });
  return c.json(result);
});

api.post("/incidents/:id/techniques", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body: { technique_id?: string; name?: string; artifact_id?: string; explanation?: string; confidence?: string } =
    await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  const id = await addTechnique(c.env.DB, {
    incident_id: inc.id,
    technique_id: String(body.technique_id ?? ""),
    name: String(body.name ?? ""),
    artifact_id: String(body.artifact_id ?? ""),
    explanation: String(body.explanation ?? ""),
    confidence: String(body.confidence ?? "medium"),
  });
  await appendAudit(c.env.DB, u.username, "technique.mapped", "incident", inc.id, {
    technique_id: body.technique_id,
  });
  return c.json({ id });
});

// ---------------- correlations / graph ----------------

api.get("/correlations", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const cors = await Q.listCorrelations(c.env.DB);
  for (const l of cors) {
    l.a = (await getIncident(c.env.DB, l.a_id)) ?? undefined;
    l.b = (await getIncident(c.env.DB, l.b_id)) ?? undefined;
  }
  return c.json({ correlations: cors });
});

api.post("/correlations/:id/decide", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const status = body.status === "confirmed" ? "confirmed" : "dismissed";
  const cor = await Q.getCorrelation(c.env.DB, c.req.param("id"));
  if (!cor) return c.json({ error: "not found" }, 404);
  const incA = await getIncident(c.env.DB, cor.a_id);
  const incB = await getIncident(c.env.DB, cor.b_id);
  const allowed = [incA?.unit, incB?.unit].some((unit) => unit && (u.role === "coordinator" || u.unit === unit));
  if (!allowed) return c.json({ error: "forbidden for this unit" }, 403);
  await Q.decideCorrelation(c.env.DB, cor.id, status, u.username);
  await appendAudit(c.env.DB, u.username, "correlation." + status, "correlation", cor.id, {
    incident_id: cor.a_id, other_incident_id: cor.b_id, score: cor.score,
  });
  if (status === "confirmed") {
    await Q.createTask(c.env.DB, {
      incident_id: cor.a_id,
      title: "Tindak lanjuti korelasi dengan " + (cor.b_id === cor.a_id ? "kasus terkait" : "kasus terkait"),
      assignee: u.name, status: "open", due_at: "",
    });
  }
  return c.json({ ok: true, status });
});

api.get("/graph", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json(await buildGraph(c.env.DB));
});

api.get("/timeline", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  return c.json({ events: await Q.allEvents(c.env.DB) });
});

// ---------------- tasks ----------------

api.post("/tasks", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json().catch(() => ({}));
  const inc = await getIncident(c.env.DB, String(b.incident_id ?? ""));
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  const id = await Q.createTask(c.env.DB, {
    incident_id: inc.id, title: b.title, assignee: b.assignee ?? u.name,
    status: "open", due_at: b.due_at ?? "",
  });
  await appendAudit(c.env.DB, u.username, "task.created", "task", id, { incident_id: b.incident_id, title: b.title });
  return c.json({ id });
});

api.patch("/tasks/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json().catch(() => ({}));
  const task = await first<{ incident_id: string }>(c.env.DB, `SELECT incident_id FROM tasks WHERE id=?`, c.req.param("id"));
  if (!task) return c.json({ error: "not found" }, 404);
  const inc = await getIncident(c.env.DB, task.incident_id);
  if (!inc || (u.role !== "coordinator" && u.unit !== inc.unit)) return c.json({ error: "forbidden for this unit" }, 403);
  await Q.updateTaskStatus(c.env.DB, c.req.param("id"), String(b.status ?? "open"));
  await appendAudit(c.env.DB, u.username, "task.status_changed", "task", c.req.param("id"), { status: b.status });
  return c.json({ ok: true });
});

// ---------------- audit / integrity ----------------

api.get("/audit", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const limit = Number(c.req.query("limit") ?? 200);
  const incident = c.req.query("incident") ?? "";
  return c.json({ entries: await listAudit(c.env.DB, limit, incident) });
});

api.get("/audit/verify", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const chain = await verifyAudit(c.env.DB);
  const checkpoints = await verifyCheckpoints(c.env.DB);

  // Truncation and rewrite detection against the latest signed checkpoint.
  const cps = await listCheckpoints(c.env.DB);
  const latest = cps[0];
  if (latest) {
    const head = await first<{ seq: number; hash: string }>(
      c.env.DB, `SELECT seq,hash FROM audit ORDER BY seq DESC LIMIT 1`
    );
    const at = await first<{ hash: string }>(c.env.DB, `SELECT hash FROM audit WHERE seq=?`, latest.seq);
    if (!head || head.seq < latest.seq) {
      checkpoints.ok = false;
      checkpoints.issues.push(`truncation: audit head seq ${head?.seq ?? 0} is behind signed checkpoint ${latest.seq}`);
    } else if (!at || at.hash !== latest.head_hash) {
      checkpoints.ok = false;
      checkpoints.issues.push(`rewrite: audit entry ${latest.seq} no longer matches the signed checkpoint`);
    }
  }
  return c.json({ chain, checkpoints });
});

api.post("/dev/tamper", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const b = await c.req.json().catch(() => ({}));
  const seq = Number(b.seq ?? 0);
  const r = await tamperAudit(c.env.DB, seq);
  return c.json({ ok: true, seq, ...r });
});

api.post("/dev/restore", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const b = await c.req.json().catch(() => ({}));
  await restoreAudit(c.env.DB, Number(b.seq ?? 0));
  return c.json({ ok: true });
});

api.get("/checkpoints", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const list = await listCheckpoints(c.env.DB);
  const verify = await verifyCheckpoints(c.env.DB);
  return c.json({ checkpoints: list, verification: verify });
});

api.get("/checkpoints/export", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const checkpoints = await listCheckpoints(c.env.DB);
  const chain = await verifyAudit(c.env.DB);
  const keys = await all<{ id: string; public_key: string; source: string; created_at: string; retired_at: string }>(
    c.env.DB,
    `SELECT id,public_key,COALESCE(source,'') AS source,created_at,COALESCE(retired_at,'') AS retired_at
     FROM signing_keys ORDER BY created_at`
  );
  await appendAudit(c.env.DB, u.username, "checkpoint.exported", "system", "checkpoints", {
    checkpoints: checkpoints.length, head: chain.head,
  });
  return c.json({ generated_at: now(), chain, checkpoints, keys });
});

api.post("/checkpoints", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const cp = await createCheckpoint(c.env.DB, c.env.RANTAI_SIGNING_KEY, c.env.RANTAI_ENV === "production");
  await appendAudit(c.env.DB, u.username, "checkpoint.created", "checkpoint", cp.id, { seq: cp.seq, head_hash: cp.head_hash });
  return c.json({ checkpoint: cp });
});

api.post("/checkpoints/rotate", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  if (!rateLimit(`rotate:${u.username}`, 3, 60 * 60_000)) {
    return c.json({ error: "rotation rate limit exceeded" }, 429);
  }
  const body: { confirm?: string } = await c.req.json().catch(() => ({}));
  if (body.confirm !== "ROTATE") {
    return c.json({ error: "explicit confirmation required: send {\"confirm\":\"ROTATE\"}" }, 400);
  }
  const kp = await rotateSigningKey(c.env.DB);
  await appendAudit(c.env.DB, u.username, "checkpoint.key_rotated", "system", "signing_keys", {
    public_key: kp.pub.slice(0, 16),
  });
  c.header("Cache-Control", "no-store");
  return c.json({
    public_key: kp.pub,
    secret_once: kp.priv,
    note: "Simpan secret_once sebagai secret RANTAI_SIGNING_KEY. Nilai ini tidak disimpan pada respons berikutnya.",
  });
});

function devAllowed(c: Ctx): boolean {
  const host = new URL(c.req.url).hostname;
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
}

api.post("/dev/tamper-checkpoint", async (c) => {
  if (!devAllowed(c)) return c.json({ error: "dev endpoint" }, 403);
  const u = await requireUser(c);
  if (!u || u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const body: { id?: string; restore?: boolean } = await c.req.json().catch(() => ({}));
  const cp = await first<{ id: string; signature: string }>(c.env.DB, `SELECT id,signature FROM checkpoints WHERE id=?`, String(body.id ?? ""));
  if (!cp) return c.json({ error: "checkpoint not found" }, 404);
  if (body.restore) {
    const original = await getSetting(c.env.DB, `cp_backup_${cp.id}`, "");
    if (!original) return c.json({ error: "no backup" }, 400);
    await run(c.env.DB, `UPDATE checkpoints SET signature=? WHERE id=?`, original, cp.id);
    return c.json({ ok: true, restored: true });
  }
  await setSetting(c.env.DB, `cp_backup_${cp.id}`, cp.signature);
  const tampered = cp.signature.slice(0, -4) + "0000";
  await run(c.env.DB, `UPDATE checkpoints SET signature=? WHERE id=?`, tampered, cp.id);
  return c.json({ ok: true, tampered: true });
});

api.post("/dev/benchmark", async (c) => {
  if (!devAllowed(c)) return c.json({ error: "dev endpoint" }, 403);
  const u = await requireUser(c);
  if (!u || u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  if (!rateLimit(`benchmark:${u.username}`, 5, 60_000)) {
    return c.json({ error: "benchmark rate limit exceeded" }, 429);
  }
  const salt = await ensureSalt(c.env);
  const metrics = await runBenchmark(c.env.DB, salt);
  const heldOut = await runBenchmark(c.env.DB, salt, {
    clusters: 30, perCluster: 6, noise: 20, negativesPerStratum: 100, seed: 4242,
  });
  const adversarial = await runAdversarial(c.env.DB, salt);
  return c.json({ ...metrics, held_out: heldOut, adversarial });
});

api.post("/dev/analyze", async (c) => {
  if (!devAllowed(c)) return c.json({ error: "dev endpoint" }, 403);
  const u = await requireUser(c);
  if (!u || u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const body: { filename?: string; base64?: string } = await c.req.json().catch(() => ({}));
  try {
    const data = unb64(String(body.base64 ?? ""));
    const analysis = analyzeBytes(data, String(body.filename ?? "sample.bin"));
    return c.json({ size: data.length, analysis });
  } catch {
    return c.json({ error: "invalid base64" }, 400);
  }
});

api.post("/dev/tamper-artifact", async (c) => {
  if (!devAllowed(c)) return c.json({ error: "dev endpoint" }, 403);
  const u = await requireUser(c);
  if (!u || u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  const body: { artifact_id?: string; restore?: boolean } = await c.req.json().catch(() => ({}));
  const content = await storageFor(c.env).get(String(body.artifact_id ?? ""));
  if (!content || content.length === 0) return c.json({ error: "artifact not found" }, 404);
  const next = new Uint8Array(content);
  next[0] = next[0] ^ 0xff;
  await run(c.env.DB, `UPDATE artifacts SET content=? WHERE id=?`, next, String(body.artifact_id));
  return c.json({ ok: true, restored: Boolean(body.restore) });
});

api.post("/blind/rotate", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  if (u.role !== "coordinator") return c.json({ error: "coordinator only" }, 403);
  if (!rateLimit(`blind-rotate:${u.username}`, 3, 60 * 60_000)) {
    return c.json({ error: "rotation rate limit exceeded" }, 429);
  }
  const body: { confirm?: string } = await c.req.json().catch(() => ({}));
  if (body.confirm !== "ROTATE") {
    return c.json({ error: "explicit confirmation required: send {\"confirm\":\"ROTATE\"}" }, 400);
  }
  const version = Number(await getSetting(c.env.DB, "blind_key_version", "1")) + 1;
  const secret = uid() + uid();
  const salt = `v${version}:${secret}`;
  const rows = await all<{ id: string; kind: string; norm_value: string; blind_hash: string }>(
    c.env.DB,
    `SELECT id,kind,norm_value,COALESCE(blind_hash,'') AS blind_hash FROM indicators`
  );
  for (const r of rows) {
    const next = await blindHash(salt, r.kind, r.norm_value);
    await run(c.env.DB, `UPDATE indicators SET blind_hash=?, blind_hash_prev=? WHERE id=?`, next, r.blind_hash, r.id);
  }
  await setSetting(c.env.DB, "blind_key_version", String(version));
  await setSetting(c.env.DB, "blind_secret", secret);
  await appendAudit(c.env.DB, u.username, "blind.key_rotated", "system", "blind_keys", {
    version, indicators: rows.length,
  });
  c.header("Cache-Control", "no-store");
  return c.json({
    version,
    salt_once: salt,
    indicators_rehashed: rows.length,
    note: "Distribusikan salt_once ke satuan lain dengan aman. Hash generasi sebelumnya tetap tersimpan untuk pencocokan.",
  });
});

api.get("/pubkey", async (c) => {
  const { pub } = await signingKeys(c.env.DB, c.env.RANTAI_SIGNING_KEY, c.env.RANTAI_ENV === "production");
  return c.json({ algorithm: "Ed25519", public_key: pub, fingerprint: (await sha256Hex(pub)).slice(0, 16) });
});

// ---------------- export / import ----------------

api.get("/export/stix", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const bundle = await buildSTIX(c.env.DB);
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: { "Content-Type": "application/stix+json", "Content-Disposition": `attachment; filename="rantai-stix.json"` },
  });
});

async function buildSTIX(db: D1Database) {
  const incidents = await listIncidents(db);
  const identity = {
    type: "identity", spec_version: "2.1", id: `identity--${crypto.randomUUID()}`,
    created: now(), modified: now(), name: "RANTAI", identity_class: "system",
    description: "Incident evidence and coordination platform. Export contains shared indicators only.",
  };
  const objects: Record<string, unknown>[] = [identity];
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const inc of incidents) {
    for (const i of await Q.indicators(db, inc.id)) {
      if (!i.shared) continue;
      const pattern = stixPattern(i.kind, i.raw_value);
      if (!pattern) continue;
      const key = i.kind + "|" + i.norm_value;
      if (seen.has(key)) continue;
      seen.add(key);
      const oid = `indicator--${crypto.randomUUID()}`;
      objects.push({
        type: "indicator", spec_version: "2.1", id: oid, created: i.first_seen || now(), modified: now(),
        name: `${i.kind}: ${i.raw_value}`, pattern, pattern_type: "stix", valid_from: i.first_seen || now(),
        created_by_ref: identity.id, confidence: 60,
        external_references: [{ source_name: "RANTAI", description: `Observed in ${inc.code}` }],
      });
      refs.push(oid);
    }
  }
  const cors = await Q.listCorrelations(db);
  const report = {
    type: "report", spec_version: "2.1", id: `report--${crypto.randomUUID()}`, created: now(), modified: now(),
    name: "RANTAI shared indicator export", published: now(), created_by_ref: identity.id,
    object_refs: refs,
    description: `Shared indicators from ${incidents.length} incident reports. Correlated pairs: ${cors.length}.`,
  };
  objects.push(report);
  for (const c of cors) {
    objects.push({
      type: "x-rantai-correlation", spec_version: "2.1", id: `x-rantai-correlation--${crypto.randomUUID()}`,
      created: c.created_at, modified: now(), score: c.score, band: c.band, status: c.status,
      incident_a: c.a_id, incident_b: c.b_id, reasons: c.reasons,
    });
  }
  return { type: "bundle", id: `bundle--${crypto.randomUUID()}`, objects };
}

function stixPattern(kind: string, value: string): string | null {
  const safe = value.replace(/'/g, "\\'");
  switch (kind) {
    case "domain": return `[domain-name:value = '${safe}']`;
    case "ip": return `[ipv4-addr:value = '${safe}']`;
    case "url": return `[url:value = '${safe}']`;
    case "email": return `[email-addr:value = '${safe}']`;
    case "sha256": return `[file:hashes.'SHA-256' = '${safe}']`;
    case "md5": return `[file:hashes.MD5 = '${safe}']`;
    case "filename": return `[file:name = '${safe}']`;
    default: return null;
  }
}

api.post("/export/bundle", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const payload: BundlePayload = {
    version: 1, exported_at: now(), unit: u.unit, campaign: cfg.campaign, indicators: [],
  };
  const seen = new Set<string>();
  for (const inc of await listIncidents(c.env.DB)) {
    for (const i of await Q.indicators(c.env.DB, inc.id)) {
      if (!i.shared) continue;
      const k = i.kind + "|" + i.norm_value;
      if (seen.has(k)) continue;
      seen.add(k);
      payload.indicators.push({
        kind: i.kind, value: i.raw_value, norm: i.norm_value, first_seen: i.first_seen,
        source_incident: inc.code, unit: inc.unit,
      });
    }
  }
  const { priv, pub } = await signingKeys(c.env.DB);
  const signature = await signB64(priv, canonical(payload));
  await appendAudit(c.env.DB, u.username, "bundle.exported", "system", "bundle", {
    indicators: payload.indicators.length, unit: u.unit,
  });
  return c.json({ bundle: payload, signature, public_key: pub });
});

api.post("/import/bundle", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const bundle = body.bundle;
  if (!bundle?.indicators) return c.json({ error: "invalid bundle" }, 400);
  const ok = await verifyB64(String(body.public_key ?? ""), canonical(bundle), String(body.signature ?? ""));
  if (!ok) return c.json({ error: "bundle signature invalid" }, 400);
  const count = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM incidents`))?.n ?? 0;
  const code = `IMP-2026-${String(count + 1).padStart(3, "0")}`;
  const id = await Q.createIncident(c.env.DB, {
    code, title: `Imported bundle from ${bundle.unit ?? "unknown unit"}`, category: "Imported",
    severity: "low", status: "open", unit: String(bundle.unit ?? u.unit),
    reporter: "bundle import", summary: `Offline bundle signed by ${String(body.public_key ?? "").slice(0, 16)}...`,
    occurred_at: bundle.exported_at ?? now(), created_by: u.username,
  });
  const salt = await ensureSalt(c.env);
  const { blindHash } = await import("./correlate");
  for (const i of bundle.indicators) {
    await Q.addIndicator(c.env.DB, {
      incident_id: id, kind: i.kind, raw_value: i.value, norm_value: i.norm,
      first_seen: i.first_seen, source: "bundle:" + (i.source_incident ?? "?"), shared: true,
      blind_hash: await blindHash(salt, i.kind, i.norm),
    });
  }
  await appendAudit(c.env.DB, u.username, "bundle.imported", "incident", id, {
    incident_id: id, code, source_unit: bundle.unit, indicators: bundle.indicators.length,
  });
  const leads = await recomputeFor(c.env.DB, id, salt);
  return c.json({ incident_id: id, code, imported: bundle.indicators.length, leads: leads.length });
});

// ---------------- reports ----------------

api.get("/report/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  const inc = await getIncident(c.env.DB, c.req.param("id"));
  if (!inc) return c.json({ error: "not found" }, 404);
  const raw = canSeeRaw(u, inc);
  if (!raw && (await getIncidentMeta(c.env.DB, inc.id)).tlp === "red") {
    return c.json({ error: "incident is TLP:RED" }, 403);
  }
  let arts = await listArtifacts(c.env.DB, inc.id);
  let inds = await Q.indicators(c.env.DB, inc.id);
  if (!raw) {
    arts = arts.filter((a) => a.share_scope !== "restricted");
    inds = inds.filter((i) => i.shared);
  }
  const evs = await Q.events(c.env.DB, inc.id);
  const tsk = await Q.tasks(c.env.DB, inc.id);
  const leads = await Q.correlationsForIncident(c.env.DB, inc.id);
  const audit = await listAudit(c.env.DB, 500, inc.id);
  const chain = await verifyAudit(c.env.DB);
  const root = await merkleRoot(arts.map((a) => a.sha256));
  const format = c.req.query("format") ?? "html";

  if (format === "json") {
    return c.json({ incident: inc, artifacts: arts, indicators: inds, events: evs, tasks: tsk, leads, audit, chain, merkle_root: root });
  }
  if (format === "md") {
    const md = renderMarkdown(inc, arts, inds, evs, tsk, leads, audit, chain, root);
    return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }
  const html = renderReportHTML(inc, arts, inds, evs, tsk, leads, audit, chain, root, cfg);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

function esc(s: unknown) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdown(
  inc: Incident, arts: Artifact[], inds: Indicator[], evs: EventRow[], tsk: Task[],
  leads: Correlation[], audit: AuditEntry[], chain: VerifyResult, root: string
) {
  const L: string[] = [];
  L.push(`# Laporan Forensik ${inc.code}`);
  L.push("");
  L.push(`**Judul:** ${inc.title}`);
  L.push(`**Satuan:** ${inc.unit}`);
  L.push(`**Kategori:** ${inc.category}  `);
  L.push(`**Severity:** ${inc.severity}  `);
  L.push(`**Status:** ${inc.status}`);
  L.push("");
  L.push("## Ringkasan");
  L.push(inc.summary || "-");
  L.push("");
  L.push("## Manifest bukti");
  L.push("| Berkas | Ukuran | SHA-256 |");
  L.push("|---|---|---|");
  for (const a of arts) L.push(`| ${a.filename} | ${a.size} B | ${a.sha256} |`);
  L.push("");
  L.push(`Merkle root manifest: \`${root || "-"}\``);
  L.push("");
  L.push("## Indikator");
  L.push("| Jenis | Nilai | Sumber |");
  L.push("|---|---|---|");
  for (const i of inds) L.push(`| ${i.kind} | ${i.raw_value} | ${i.source} |`);
  L.push("");
  L.push("## Kronologi");
  for (const e of evs) L.push(`- ${e.ts} · [${e.kind}] ${e.title} — ${e.detail}`);
  L.push("");
  L.push("## Temuan korelasi");
  for (const l of leads) {
    L.push(`### Skor ${l.score} (${l.band})`);
    for (const r of l.reasons) L.push(`- ${r.detail} (bobot ${r.weight})`);
  }
  L.push("");
  L.push("## Tugas respons");
  for (const t of tsk) L.push(`- [${t.status}] ${t.title} — ${t.assignee}`);
  L.push("");
  L.push("## Integritas rantai audit");
  L.push(`Status: **${chain.ok ? "TERVERIFIKASI" : "RUSAK"}**, ${chain.checked} entri, head \`${chain.head}\`.`);
  for (const issue of chain.issues) L.push(`- ${issue}`);
  L.push("");
  L.push("## Riwayat audit");
  for (const a of audit) L.push(`- #${a.seq} ${a.ts} ${a.actor} ${a.action} ${a.object_type}/${a.object_id}`);
  L.push("");
  L.push("_Dokumen ini dihasilkan oleh RANTAI. Korelasi adalah petunjuk penyelidikan, bukan bukti atribusi._");
  return L.join("\n");
}

function renderReportHTML(
  inc: Incident, arts: Artifact[], inds: Indicator[], evs: EventRow[], tsk: Task[],
  leads: Correlation[], audit: AuditEntry[], chain: VerifyResult, root: string, cfg: SeedCfg
) {
  const rows = <T>(arr: T[], fn: (x: T) => string) => arr.map(fn).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(inc.code)} · RANTAI</title>
<style>
@page{size:A4;margin:18mm}
body{font-family:Inter,Arial,sans-serif;color:#111;margin:0;font-size:12px;line-height:1.5}
h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 24px;margin:12px 0}
.muted{color:#666}.wm{font-size:10px;color:#a00;letter-spacing:.08em;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #eee;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#f6f6f6;font-weight:600}
code,.mono{font-family:"JetBrains Mono",Consolas,monospace;font-size:10px;word-break:break-all}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eee;font-size:10px}
.ok{color:#0a7a3d;font-weight:600}.bad{color:#b00020;font-weight:600}
footer{margin-top:32px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#666}
</style></head><body>
<div class="wm">${esc(cfg.watermark)}</div>
<h1>Laporan Forensik Insiden</h1>
<div class="muted mono">${esc(inc.code)} · dibuat ${esc(now())}</div>
<div class="meta">
<div><b>Judul</b><br>${esc(inc.title)}</div>
<div><b>Satuan</b><br>${esc(inc.unit)}</div>
<div><b>Kategori</b><br>${esc(inc.category)}</div>
<div><b>Severity</b><br>${esc(inc.severity)}</div>
<div><b>Status</b><br>${esc(inc.status)}</div>
<div><b>Waktu kejadian</b><br>${esc(inc.occurred_at)}</div>
</div>
<h2>Ringkasan</h2><p>${esc(inc.summary)}</p>
<h2>Manifest bukti</h2>
<table><tr><th>Berkas</th><th>Ukuran</th><th>SHA-256</th></tr>${rows(arts, (a) => `<tr><td>${esc(a.filename)}</td><td>${a.size} B</td><td class="mono">${esc(a.sha256)}</td></tr>`)}</table>
<p class="muted">Merkle root manifest: <span class="mono">${esc(root || "-")}</span></p>
<h2>Indikator</h2>
<table><tr><th>Jenis</th><th>Nilai</th><th>Sumber</th></tr>${rows(inds, (i) => `<tr><td>${esc(i.kind)}</td><td class="mono">${esc(i.raw_value)}</td><td>${esc(i.source)}</td></tr>`)}</table>
<h2>Kronologi</h2>
<table><tr><th>Waktu</th><th>Peristiwa</th><th>Detail</th></tr>${rows(evs, (e) => `<tr><td class="mono">${esc(e.ts)}</td><td>${esc(e.title)}</td><td>${esc(e.detail)}</td></tr>`)}</table>
<h2>Temuan korelasi</h2>
${rows(leads, (l) => `<p><span class="badge">skor ${l.score} · ${esc(l.band)}</span><br>${rows(l.reasons, (r) => `• ${esc(r.detail)} (bobot ${r.weight})<br>`)}</p>`) || "<p class=muted>Tidak ada temuan.</p>"}
<h2>Tugas respons</h2>
<table><tr><th>Status</th><th>Tugas</th><th>PIC</th></tr>${rows(tsk, (t) => `<tr><td>${esc(t.status)}</td><td>${esc(t.title)}</td><td>${esc(t.assignee)}</td></tr>`)}</table>
<h2>Integritas rantai audit</h2>
<p class="${chain.ok ? "ok" : "bad"}">${chain.ok ? "TERVERIFIKASI" : "RUSAK"} · ${chain.checked} entri · head <span class="mono">${esc(chain.head)}</span></p>
${rows(chain.issues, (i) => `<p class="bad">${esc(i)}</p>`)}
<h2>Riwayat audit</h2>
<table><tr><th>Seq</th><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Objek</th></tr>${rows(audit, (a) => `<tr><td>${a.seq}</td><td class="mono">${esc(a.ts)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td class="mono">${esc(a.object_type)}/${esc(a.object_id)}</td></tr>`)}</table>
${cfg.case ? `<h2>Sumber data</h2><p>${esc(cfg.case.description)}<br><span class="mono">${esc(cfg.case.source_url)}</span><br>Lisensi: ${esc(cfg.case.license)}</p>` : ""}
<footer>RANTAI · Incident Evidence & Coordination Platform. Korelasi adalah petunjuk penyelidikan, bukan bukti atribusi. Dokumen ini memuat data sintetis untuk pelatihan.</footer>
</body></html>`;
}
