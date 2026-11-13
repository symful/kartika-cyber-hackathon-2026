import { zipSync, strToU8 } from "fflate";
import cfg from "../config/seed.json";
import { SCHEMA } from "./schema";
import { all, first, run, uid, getSetting, setSetting, now } from "./db";
import type { AppEnv } from "./db";
import { pbkdf2Hex, b64 } from "./integrity";
import { appendAudit, createCheckpoint } from "./audit";
import { createIncident, createTask, createEvent } from "./queries";
import { ingestArtifact } from "./ingest";
import { recomputeAll, blindHash } from "./correlate";
import {
  addTechnique, createAsset, createPlaybook, linkAsset, setIncidentMeta,
} from "./extras";

let ready: Promise<void> | null = null;

export function ensureReady(env: AppEnv): Promise<void> {
  if (!ready) ready = init(env);
  return ready;
}

async function init(env: AppEnv) {
  await initSchema(env.DB);
  const salt = await ensureSalt(env);
  // Upgrade unversioned blind hashes, preserving the old value for comparisons.
  const legacy = await all<{ id: string; kind: string; norm_value: string; blind_hash: string }>(
    env.DB,
    `SELECT id,kind,norm_value,blind_hash FROM indicators WHERE blind_hash<>'' AND blind_hash NOT LIKE 'v%'`
  );
  for (const row of legacy) {
    const next = await blindHash(salt, row.kind, row.norm_value);
    await run(env.DB, `UPDATE indicators SET blind_hash=?, blind_hash_prev=? WHERE id=?`, next, row.blind_hash, row.id);
  }
  const userCount = (await first<{ n: number }>(env.DB, `SELECT COUNT(*) AS n FROM users`))?.n ?? 0;
  if (userCount === 0) {
    await seed(env, salt);
  }
}

async function initSchema(db: D1Database) {
  const stmts = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await run(db, s);
  // Forward migration for databases created before the rule engine existed.
  for (const alter of [
    "ALTER TABLE artifact_analysis ADD COLUMN rules TEXT",
    "ALTER TABLE artifact_analysis ADD COLUMN verdict TEXT",
    "ALTER TABLE artifact_analysis ADD COLUMN metadata TEXT",
    "ALTER TABLE artifact_analysis ADD COLUMN explanations TEXT",
    "ALTER TABLE sessions ADD COLUMN expires_at TEXT",
    "ALTER TABLE indicators ADD COLUMN blind_hash_prev TEXT",
  ]) {
    try { await run(db, alter); } catch { /* column already exists */ }
  }
}

export async function ensureSalt(env: AppEnv): Promise<string> {
  const version = await getSetting(env.DB, "blind_key_version", "1");
  let secret = env.RANTAI_BLIND_KEY || env.RANTAI_SALT || "";
  if (!secret) {
    secret = await getSetting(env.DB, "blind_secret", "") || await getSetting(env.DB, "blind_salt", "");
  }
  if (!secret) {
    if (env.RANTAI_ENV === "production") {
      throw new Error("RANTAI_BLIND_KEY is required in production for blinded matching");
    }
    secret = uid() + uid();
    await setSetting(env.DB, "blind_secret", secret);
  }
  return `v${version}:${secret}`;
}

function wrap76(s: string): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 76) out.push(s.slice(i, i + 76));
  return out.join("\n");
}

const utf8 = (s: string) => new TextEncoder().encode(s);

async function seed(env: AppEnv, salt: string) {
  const db = env.DB;
  const watermark = cfg.watermark;
  const password = cfg.password;

  const users = [
    { username: "alpha", name: "Letda A. Pratama", role: "analyst", unit: cfg.units.alpha },
    { username: "bravo", name: "Serma B. Nugraha", role: "analyst", unit: cfg.units.bravo },
    { username: "koordinator", name: "Kolonel K. Hartono", role: "coordinator", unit: cfg.units.center },
  ];
  for (const u of users) {
    const s = uid().slice(0, 16);
    const hash = await pbkdf2Hex(password, s);
    await run(
      db,
      `INSERT INTO users(id,username,name,role,unit,salt,hash) VALUES(?,?,?,?,?,?,?)`,
      uid(), u.username, u.name, u.role, u.unit, s, hash
    );
  }

  // Phase 1: create incidents so ids exist.
  const ids: Record<string, string> = {};
  for (const inc of cfg.incidents) {
    const id = await createIncident(db, { ...inc, created_by: "seed" });
    ids[inc.code] = id;
    await createEvent(db, {
      incident_id: id,
      ts: inc.occurred_at,
      source: "report",
      kind: "report",
      title: "Incident report filed: " + inc.code,
      detail: inc.summary,
    });
    await appendAudit(db, "seed", "incident.created", "incident", id, {
      incident_id: id, code: inc.code, unit: inc.unit, severity: inc.severity,
    });
  }

  // Phase 2: build the training artifacts. All content is synthetic; only the
  // indicator values are curated from public reporting when configured.
  const invoiceHTML = `<!doctype html><html><head><title>Faktur Pengadaan</title></head>
<body><p>${watermark}</p><h2>Faktur Pengadaan 2026</h2>
<p>Mohon verifikasi faktur melalui portal berikut:</p>
<p><a href="${cfg.phish_url}">${cfg.phish_url}</a></p>
<p>Masukkan kredensial dinas Anda untuk melihat rincian.</p></body></html>`;
  const zipBytes = zipSync({ "invoice.html": strToU8(invoiceHTML) });

  const eml =
`From: "Bagian Keuangan" <${cfg.sender}>
Reply-To: ${cfg.reply_to}
To: staf.keuangan@satuan.example
Subject: Faktur Pengadaan 2026 - verifikasi diperlukan
Date: Sun, 08 Nov 2026 09:14:00 +0700
Message-ID: <20261108091400.faktur@${cfg.domain}>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="----=_RANTAI_DEMO"

${watermark}

------=_RANTAI_DEMO
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

Yth. Bagian Keuangan,

Bersama email ini kami lampirkan faktur pengadaan untuk diverifikasi.
Silakan buka portal https://${cfg.domain}/login dan gunakan akun dinas.

------=_RANTAI_DEMO
Content-Type: application/zip; name="${cfg.attachment}"
Content-Disposition: attachment; filename="${cfg.attachment}"
Content-Transfer-Encoding: base64

${wrap76(b64(zipBytes))}
------=_RANTAI_DEMO--
`;

  const emlBytes = utf8(eml);

  // Ingest phase A first so we can reuse the actual attachment hash in phase B.
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-001"],
    filename: "laporan_phishing.eml",
    mime: "message/rfc822",
    data: emlBytes,
    actor: "alpha",
    actorUnit: cfg.units.alpha,
    shareScope: "indicators",
    note: "Email asli yang dilaporkan, tautan sudah dalam bentuk asli.",
    salt,
    store: env.STORE,
  });
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-001"],
    filename: cfg.attachment,
    mime: "application/zip",
    data: zipBytes,
    actor: "alpha",
    actorUnit: cfg.units.alpha,
    shareScope: "indicators",
    note: "Lampiran yang dikirim ke staf keuangan.",
    salt,
    store: env.STORE,
  });
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-001"],
    filename: "catatan_analis.txt",
    mime: "text/plain",
    data: utf8(`${watermark}\n
2026-11-08 09:20:00 Penerima melaporkan email mencurigakan ke posko siber satuan.
2026-11-08 09:22:00 Tautan ${cfg.phish_url} menampilkan halaman login tiruan.
2026-11-08 09:31:00 Lampiran ${cfg.attachment} diunduh dua kali oleh staf berbeda.
`),
    actor: "alpha",
    actorUnit: cfg.units.alpha,
    shareScope: "indicators",
    note: "Catatan awal analis.",
    salt,
    store: env.STORE,
  });

  const zipHash = (await first<{ sha256: string }>(
    db,
    `SELECT sha256 FROM artifacts WHERE incident_id=? AND filename=?`,
    ids["INC-2026-001"], cfg.attachment
  ))?.sha256 ?? "";

  const proxyCSV = `${watermark}
ts,src_ip,user,method,host,url,content_type,file_name,sha256,bytes,action
2026-11-08 13:38:12,10.12.4.51,staf.bravo,GET,${cfg.domain},https://${cfg.domain}/login,text/html,,,18211,allowed
2026-11-08 13:41:03,10.12.4.51,staf.bravo,GET,${cfg.domain},https://${cfg.domain}/${cfg.attachment},application/zip,${cfg.attachment},${zipHash},48213,allowed
2026-11-08 13:41:58,10.12.4.51,staf.bravo,CONNECT,${cfg.c2_ip}:443,,,,-,,-,allowed
2026-11-08 13:46:58,10.12.4.51,staf.bravo,CONNECT,${cfg.c2_ip}:443,,,,-,,-,allowed
2026-11-08 13:51:58,10.12.4.51,staf.bravo,CONNECT,${cfg.c2_ip}:443,,,,-,,-,allowed
`;
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-002"],
    filename: "proxy_dns_bravo.csv",
    mime: "text/csv",
    data: utf8(proxyCSV),
    actor: "bravo",
    actorUnit: cfg.units.bravo,
    shareScope: "indicators",
    note: "Potongan log proxy dan DNS dari satu host.",
    salt,
    store: env.STORE,
  });

  const authCSV = `${watermark}
ts,event,src_ip,user,result,detail
2026-11-09 08:02:11,auth_failure,${cfg.credential_ip},staf.keuangan,failed,invalid password
2026-11-09 08:04:52,auth_failure,${cfg.credential_ip},staf.keuangan,failed,invalid password
2026-11-09 08:09:37,auth_failure,${cfg.credential_ip},staf.arsip,failed,invalid password
2026-11-09 08:21:44,auth_failure,${cfg.credential_ip},staf.keuangan,failed,invalid password
2026-11-09 08:22:03,auth_success,${cfg.credential_ip},staf.keuangan,success,login from external address
2026-11-09 08:25:41,smtp_delivery,${cfg.credential_ip},gateway,success,from ${cfg.sender} subject Faktur Pengadaan 2026
`;
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-003"],
    filename: "auth_gateway_alpha.csv",
    mime: "text/csv",
    data: utf8(authCSV),
    actor: "alpha",
    actorUnit: cfg.units.alpha,
    shareScope: "indicators",
    note: "Log autentikasi gerbang surel.",
    salt,
    store: env.STORE,
  });

  const ddosCSV = `${watermark}
ts,event,src_ip,target,req_per_sec
2026-11-11 20:58:00,http_flood,${cfg.ddos_ip},${cfg.ddos_domain},3800
2026-11-11 21:04:00,http_flood,${cfg.ddos_ip},${cfg.ddos_domain},4200
2026-11-11 21:10:00,http_flood,${cfg.ddos_ip},${cfg.ddos_domain},5100
`;
  await ingestArtifact(db, {
    incidentId: ids["INC-2026-004"],
    filename: "edge_http_flood.csv",
    mime: "text/csv",
    data: utf8(ddosCSV),
    actor: "bravo",
    actorUnit: cfg.units.bravo,
    shareScope: "indicators",
    note: "Ringkasan lonjakan permintaan pada situs publik.",
    salt,
    store: env.STORE,
  });

  for (const t of cfg.tasks) {
    const id = await createTask(db, {
      incident_id: ids[t.incident_code],
      title: t.title,
      assignee: t.assignee,
      status: t.status,
      due_at: t.due_at,
    });
    await appendAudit(db, "seed", "task.created", "task", id, {
      incident_id: ids[t.incident_code], title: t.title,
    });
  }

  // Phase 3: TLP, ATT&CK mapping, assets, and a reusable response playbook.
  await setIncidentMeta(db, ids["INC-2026-001"], "amber", "high");
  await setIncidentMeta(db, ids["INC-2026-002"], "amber", "high");
  await setIncidentMeta(db, ids["INC-2026-003"], "amber", "high");
  await setIncidentMeta(db, ids["INC-2026-004"], "green", "normal");

  const artifactId = async (code: string, filename: string) =>
    (await first<{ id: string }>(
      db,
      `SELECT a.id FROM artifacts a JOIN incidents i ON i.id=a.incident_id WHERE i.code=? AND a.filename=? LIMIT 1`,
      code, filename
    ))?.id ?? "";

  const emlId = await artifactId("INC-2026-001", "laporan_phishing.eml");
  const zipArtifactId = await artifactId("INC-2026-001", cfg.attachment);
  const proxyId = await artifactId("INC-2026-002", "proxy_dns_bravo.csv");
  const authId = await artifactId("INC-2026-003", "auth_gateway_alpha.csv");
  const ddosId = await artifactId("INC-2026-004", "edge_http_flood.csv");

  const mapping = [
    { code: "INC-2026-001", t: "T1566.001", name: "Spearphishing Attachment", a: zipArtifactId, e: "Lampiran ZIP berisi halaman pengumpulan kredensial.", c: "high" },
    { code: "INC-2026-001", t: "T1566.002", name: "Spearphishing Link", a: emlId, e: "Badan email memuat tautan ke halaman login tiruan.", c: "high" },
    { code: "INC-2026-001", t: "T1583.001", name: "Acquire Infrastructure: Domains", a: emlId, e: "Domain pengirim bukan domain resmi satuan.", c: "medium" },
    { code: "INC-2026-002", t: "T1071.001", name: "Application Layer Protocol: Web", a: proxyId, e: "Koneksi TLS berkala ke alamat luar dari host yang sama.", c: "medium" },
    { code: "INC-2026-003", t: "T1078", name: "Valid Accounts", a: authId, e: "Login berhasil dari alamat luar setelah serangkaian kegagalan.", c: "high" },
    { code: "INC-2026-003", t: "T1114.002", name: "Remote Email Collection", a: authId, e: "Akses ke gerbang surel dari alamat yang tidak dikenal.", c: "medium" },
    { code: "INC-2026-004", t: "T1498", name: "Network Denial of Service", a: ddosId, e: "Lonjakan permintaan dari satu sumber ke situs publik.", c: "high" },
  ];
  for (const m of mapping) {
    await addTechnique(db, {
      incident_id: ids[m.code], technique_id: m.t, name: m.name, artifact_id: m.a,
      explanation: m.e, confidence: m.c, status: "candidate",
    });
  }

  const assets = [
    { name: "Workstation staf keuangan", hostname: "ws-alpha-04", unit: cfg.units.alpha, owner: "Letda A. Pratama", criticality: "high", status: "under investigation", notes: "Host penerima email phishing." },
    { name: "Gerbang surel satuan", hostname: "mail-alpha-01", unit: cfg.units.alpha, owner: "Serka C. Wibowo", criticality: "critical", status: "monitoring", notes: "Tujuan percobaan login." },
    { name: "Workstation operasi Bravo", hostname: "ws-bravo-11", unit: cfg.units.bravo, owner: "Serma B. Nugraha", criticality: "high", status: "isolated", notes: "Host yang menghubungi alamat luar." },
    { name: "Situs publik satuan", hostname: "web-public-01", unit: cfg.units.bravo, owner: "Serma B. Nugraha", criticality: "critical", status: "degraded", notes: "Target banjir lalu lintas." },
  ];
  const assetIds: string[] = [];
  for (const a of assets) assetIds.push(await createAsset(db, a));
  await linkAsset(db, ids["INC-2026-001"], assetIds[0]);
  await linkAsset(db, ids["INC-2026-001"], assetIds[1]);
  await linkAsset(db, ids["INC-2026-003"], assetIds[1]);
  await linkAsset(db, ids["INC-2026-002"], assetIds[2]);
  await linkAsset(db, ids["INC-2026-004"], assetIds[3]);

  await createPlaybook(db, {
    name: "Phishing response",
    incident_type: "Phishing",
    version: 1,
    steps: [
      { title: "Amankan email asli dan lampiran", role: "analyst", evidence_required: "Berkas .eml" },
      { title: "Ekstrak pengirim, domain, dan URL", role: "analyst", evidence_required: "Indikator" },
      { title: "Identifikasi pengguna terdampak", role: "analyst" },
      { title: "Periksa indikasi kompromi akun", role: "analyst", evidence_required: "Log autentikasi" },
      { title: "Rekomendasikan pencabutan kredensial", role: "coordinator" },
      { title: "Pantau aktivitas lanjutan 72 jam", role: "analyst" },
      { title: "Tutup investigasi setelah tinjauan", role: "coordinator" },
    ],
  });

  // One secondary indicator kind is withheld to demonstrate blinded matching:
  // other units still see the match, but never the raw value.
  await run(db, `UPDATE indicators SET shared=0 WHERE kind IN ('filename')`);

  await recomputeAll(db, salt);
  await appendAudit(db, "seed", "seed.completed", "system", "seed", { campaign: cfg.campaign });
  try {
    await createCheckpoint(db, env.RANTAI_SIGNING_KEY, env.RANTAI_ENV === "production");
  } catch {
    // Signing is unavailable (for example, a production worker without a secret).
    // The application still starts; explicit checkpoint requests will fail loudly.
  }
}
