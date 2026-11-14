import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, type ApiError } from "../api";
import { Donut } from "../charts";
import { EmptyState, ErrorState, Icon, LoadingBlock, Stamp, useFocusTrap } from "../ui";
import { reasonDetail } from "../labels";
import type {
  AccessRequest,
  ArtifactDetail,
  Asset,
  AuditEntry,
  Correlation,
  EventRow,
  Goto,
  Incident,
  IncidentDetail as IncidentDetailData,
  Indicator,
  IndicatorMeta,
  IngestResult,
  Notify,
  PageProps,
  Passport,
  PivotResult,
  Playbook,
  Reason,
  Task,
  Technique,
} from "../types";

const sevTone: Record<string, string> = { critical: "red", high: "orange", medium: "gold", low: "blue" };
const sevStamp: Record<string, "signal" | "orange" | "ink"> = { critical: "signal", high: "orange", medium: "ink", low: "ink" };
const statusTone: Record<string, string> = { open: "amber", investigating: "blue", contained: "green", closed: "neutral" };
const statusLabel: Record<string, string> = {
  open: "Terbuka",
  investigating: "Investigasi",
  contained: "Terkendali",
  closed: "Ditutup",
};
const kindTone: Record<string, string> = {
  sha256: "violet",
  md5: "violet",
  domain: "amber",
  ip: "blue",
  url: "amber",
  email: "green",
  filename: "neutral",
  lookalike: "red",
};
const kindBadge: Record<string, string> = {
  sha256: "SHA-256",
  md5: "MD5",
  domain: "Domain",
  ip: "IP",
  url: "URL",
  email: "Email",
  filename: "Nama berkas",
  lookalike: "Mirip",
};
const kindChartColor: Record<string, string> = {
  sha256: "#155ebd",
  md5: "#4c9ae6",
  domain: "#e08a4a",
  ip: "#e3b23c",
  url: "#a9541f",
  email: "#2c6f52",
  filename: "#637286",
  lookalike: "#e05a55",
};
const confidenceTone: Record<string, string> = { high: "green", medium: "amber", low: "neutral" };
const accessTone: Record<string, string> = { approved: "green", pending: "amber", rejected: "red", expired: "red" };
const accessStatusLabel: Record<string, string> = {
  approved: "Disetujui",
  pending: "Menunggu",
  rejected: "Ditolak",
  expired: "Kedaluwarsa",
};
const correlationStatusLabel: Record<string, string> = {
  confirmed: "Terkonfirmasi",
  dismissed: "Ditolak",
};
const bandLabel: Record<string, string> = { strong: "kuat", moderate: "sedang", weak: "lemah", none: "tidak ada" };
const kindLabel: Record<string, string> = {
  sha256: "hash SHA-256",
  md5: "hash MD5",
  domain: "domain",
  ip: "alamat IP",
  url: "URL",
  email: "alamat email",
  filename: "nama berkas",
  lookalike: "domain mirip",
  temporal: "waktu",
};
const taskStatus: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  done: "Selesai",
  blocked: "Terhalang",
};

function scoreColor(n: number) {
  return n >= 70 ? "var(--signal)" : n >= 45 ? "var(--orange)" : "var(--info)";
}
function scoreTone(n: number) {
  return n >= 70 ? "strong" : n >= 45 ? "moderate" : "weak";
}
function fmt(ts: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentDetail({
  id,
  sub,
  extra,
  user,
  goto,
  notify,
}: PageProps & { id: string; sub?: string; extra?: string }) {
  const [data, setData] = useState<IncidentDetailData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState(sub === "passport" ? "evidence" : sub || "overview");
  const [pivot, setPivot] = useState<{ kind: string; value: string } | null>(null);
  const [passport, setPassport] = useState<string | null>(sub === "passport" ? extra ?? null : null);
  const [changing, setChanging] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  function load() {
    setError(null);
    api
      .get<IncidentDetailData>("/incidents/" + id)
      .then(setData)
      .catch((e: ApiError) => {
        setError(e);
        notify(errorMessage(e), "error");
      });
  }

  useEffect(() => {
    setData(null);
    setError(null);
    setTab(sub === "passport" ? "evidence" : sub || "overview");
    setPassport(sub === "passport" ? extra ?? null : null);
    load();
  }, [id]);

  useEffect(() => {
    if (sub) setTab(sub === "passport" ? "evidence" : sub);
  }, [sub]);

  async function decide(leadId: string, status: string) {
    setDeciding(leadId);
    try {
      await api.post(`/correlations/${leadId}/decide`, { status });
      notify(status === "confirmed" ? "Korelasi dikonfirmasi dan dicatat." : "Korelasi ditolak.", "ok");
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setDeciding(null);
    }
  }

  async function changeStatus(status: string) {
    setChanging(true);
    try {
      await api.patch(`/incidents/${id}/status`, { status });
      notify("Status diperbarui dan dicatat pada rantai audit.", "ok");
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setChanging(false);
    }
  }

  function openPassport(artifactId: string) {
    setPassport(artifactId);
    window.history.replaceState(null, "", `#/incident/${id}/passport/${artifactId}`);
  }

  function closePassport() {
    setPassport(null);
    window.history.replaceState(null, "", `#/incident/${id}/${tab}`);
  }

  if (error) {
    return (
      <ErrorState status={error.status} message={error.message} onRetry={load}>
        <button className="btn" onClick={() => goto("incidents")}>
          <Icon name="arrow" size={14} style={{ transform: "rotate(180deg)" }} /> Kembali ke daftar
        </button>
      </ErrorState>
    );
  }
  if (!data) return <LoadingBlock label="Memuat berkas kasus" rows={8} />;

  const { incident: inc, artifacts, indicators, events, tasks, leads, audit, raw_access, tlp, techniques, assets, access_requests, indicator_meta } = data;

  const tabs = [
    { k: "overview", label: "Ringkasan" },
    { k: "evidence", label: "Bukti", n: artifacts.length },
    { k: "indicators", label: "Indikator", n: indicators.length },
    { k: "timeline", label: "Kronologi", n: events.length },
    { k: "leads", label: "Korelasi", n: leads.length },
    { k: "context", label: "Konteks", n: techniques.length + assets.length },
    { k: "tasks", label: "Respons", n: tasks.length },
    { k: "access", label: "Akses", n: access_requests.length },
    { k: "audit", label: "Audit", n: audit.length },
  ];

  return (
    <div>
      <div className="case-head">
        <div className="case-head-main">
          <div className="case-code-line">
            <button className="btn ghost sm" onClick={() => goto("incidents")}>
              <Icon name="arrow" size={13} style={{ transform: "rotate(180deg)" }} /> Daftar
            </button>
            <span className="case-code">{inc.code}</span>
            <Stamp tone={sevStamp[inc.severity] ?? "ink"}>{inc.severity}</Stamp>
            <Stamp tone={inc.status === "contained" ? "green" : inc.status === "open" ? "amber" : "ink"}>
              {statusLabel[inc.status] ?? inc.status}
            </Stamp>
            <Stamp tone={tlp === "red" ? "signal" : tlp === "green" || tlp === "clear" ? "green" : "amber"} rotate={1}>
              TLP:{String(tlp).toUpperCase()}
            </Stamp>
          </div>
          <h1>{inc.title}</h1>
          <div className="case-meta">
            <span>{inc.unit}</span>
            <span>{inc.category}</span>
            <span>{fmt(inc.occurred_at)}</span>
            <span>{artifacts.length} berkas</span>
            <span>{indicators.length} indikator</span>
          </div>
        </div>
        <div className="case-actions">
          <label className="sr-only" htmlFor="incident-status">Status penanganan</label>
          <select
            id="incident-status"
            className="select"
            style={{ width: 150 }}
            value={inc.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={!raw_access || changing}
            title={!raw_access ? "Hanya satuan pemilik atau koordinator yang dapat mengubah status" : "Ubah status penanganan"}
          >
            {["open", "investigating", "contained", "closed"].map((s) => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
          <button className="btn" onClick={() => window.open(`/api/report/${inc.id}?format=html`, "_blank")}>
            <Icon name="file" size={14} /> Laporan
          </button>
        </div>
      </div>

      {!raw_access && (
        <div className="disclaimer lock" style={{ marginBottom: 14 }}>
          <Icon name="lock" size={15} />
          <span>
            Berkas ini milik <b>{inc.unit}</b>. Anda dapat membaca indikator yang dibagikan dan
            mengajukan akses, tetapi tidak dapat mengunggah bukti, mengubah status, atau mencatat custody
            lintas satuan. Larangan ini ditegakkan oleh server.
          </span>
        </div>
      )}

      <div className="detail-body">
        <div className="tabs" role="tablist" aria-label="Bagian berkas kasus">
          {tabs.map((t) => (
            <button
              key={t.k}
              role="tab"
              id={"tab-" + t.k}
              aria-controls={"panel-" + t.k}
              aria-selected={tab === t.k}
              className={"tab" + (tab === t.k ? " active" : "")}
              onClick={() => {
                setTab(t.k);
                window.history.replaceState(null, "", `#/incident/${id}/${t.k}`);
              }}
            >
              {t.label}
              {t.n !== undefined && <span className="count">{t.n}</span>}
            </button>
          ))}
        </div>

        <div className="detail-content" role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}>
          {tab === "overview" && <Overview inc={inc} artifacts={artifacts} indicators={indicators} leads={leads} rawAccess={raw_access} goto={goto} />}
          {tab === "evidence" && (
            <Evidence inc={inc} artifacts={artifacts} rawAccess={raw_access} notify={notify} reload={load} onPassport={openPassport} />
          )}
          {tab === "indicators" && (
            <Indicators
              indicators={indicators}
              meta={indicator_meta}
              rawAccess={raw_access}
              notify={notify}
              reload={load}
              onPivot={(kind: string, value: string) => setPivot({ kind, value })}
            />
          )}
          {tab === "timeline" && <Timeline events={events} />}
          {tab === "leads" && <Leads leads={leads} decide={decide} deciding={deciding} goto={goto} />}
          {tab === "context" && (
            <ContextPanel inc={inc} techniques={techniques} assets={assets} artifacts={artifacts} rawAccess={raw_access} notify={notify} reload={load} />
          )}
          {tab === "tasks" && <Tasks inc={inc} tasks={tasks} rawAccess={raw_access} notify={notify} reload={load} />}
          {tab === "access" && <AccessPanel requests={access_requests} user={user} notify={notify} reload={load} />}
          {tab === "audit" && <Audit audit={audit} />}
        </div>
      </div>

      {pivot && <PivotModal kind={pivot.kind} value={pivot.value} onClose={() => setPivot(null)} goto={goto} notify={notify} />}

      {passport && (
        <PassportPanel
          artifactId={passport}
          user={user}
          incidentUnit={inc.unit}
          onClose={closePassport}
          notify={notify}
          reload={load}
        />
      )}
    </div>
  );
}

function Overview({
  inc,
  artifacts,
  indicators,
  leads,
  rawAccess,
  goto,
}: {
  inc: Incident;
  artifacts: ArtifactDetail[];
  indicators: Indicator[];
  leads: Correlation[];
  rawAccess: boolean;
  goto: Goto;
}) {
  const verified = artifacts.filter((a) => a.verified).length;
  const kindCounts = new Map<string, number>();
  for (const indicator of indicators) {
    kindCounts.set(indicator.kind, (kindCounts.get(indicator.kind) ?? 0) + 1);
  }
  const kindData = Array.from(kindCounts.entries())
    .map(([kind, value]) => ({
      label: kindBadge[kind] ?? kind,
      value,
      color: kindChartColor[kind] ?? "#cfd6df",
    }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="grid overview-grid">
      <div style={{ minWidth: 0 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Uraian</h2>
          <span className="hint">{inc.code}</span>
        </div>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.7, maxWidth: "74ch" }}>
          {inc.summary || "Belum ada uraian pada laporan ini."}
        </p>

        <div className="section-title">
          <h2>Profil kampanye</h2>
          <span className="hint">CISA AA23-341A</span>
        </div>
        <div style={{ border: "1px solid var(--rule)", background: "var(--paper-3)", padding: 14 }}>
          <div style={{ fontWeight: 650 }}>SINYAL-01 / rekonstruksi Star Blizzard</div>
          <div className="faint small" style={{ marginTop: 4, maxWidth: "68ch" }}>
            Profil dan teknik merujuk pada advisory publik CISA AA23-341A. Indikator pada dataset ini
            sintetis dan tidak menunjukkan insiden nyata.
          </div>
          <div className="chip-row" style={{ marginTop: 10 }}>
            {["T1566.002", "T1566.001", "T1583.001", "T1539", "T1550.004", "T1078", "T1114.002", "T1114.003"].map((t) => (
              <span className="chip" key={t}><span className="k">ATT&CK</span> {t}</span>
            ))}
          </div>
        </div>

        <div className="section-title">
          <h2>Metadata laporan</h2>
        </div>
        <dl className="kv">
          <dt>Kode</dt><dd className="mono">{inc.code}</dd>
          <dt>Satuan</dt><dd>{inc.unit}</dd>
          <dt>Pelapor</dt><dd>{inc.reporter}</dd>
          <dt>Kategori</dt><dd>{inc.category}</dd>
          <dt>Terjadi</dt><dd>{fmt(inc.occurred_at)}</dd>
          <dt>Berkas</dt><dd>{artifacts.length} artefak / {verified} terverifikasi</dd>
          <dt>Indikator</dt><dd>{inc.indicator_count} terekstrak</dd>
          <dt>Akses bukti</dt><dd>{rawAccess ? "penuh" : "indikator saja"}</dd>
        </dl>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Akses bukti</h2>
        </div>
        <div className={"disclaimer " + (rawAccess ? "lock" : "")}>
          <Icon name={rawAccess ? "eye" : "lock"} size={15} />
          <span>
            {rawAccess
              ? "Anda memiliki akses ke berkas mentah satuan ini. Setiap unduhan tercatat di audit."
              : "Berkas mentah milik satuan lain dibatasi. Anda hanya melihat indikator yang dibagikan; unduhan memerlukan persetujuan koordinator."}
          </span>
        </div>

        {leads.length > 0 && (
          <>
            <div className="section-title">
              <h2>Temuan terkuat</h2>
            </div>
            <div className="card" style={{ padding: 14, boxShadow: "none" }}>
              <div className="inline" style={{ alignItems: "flex-end", gap: 10 }}>
                <span className="lead-score" style={{ color: scoreColor(leads[0].score) }}>
                  {Math.round(leads[0].score)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{bandLabel[leads[0].band] ?? leads[0].band}</div>
                  <div className="faint small">{leads[0].reasons?.length ?? 0} alasan tercatat</div>
                </div>
                <span className="badge neutral right">{statusLabel[leads[0].status] ?? leads[0].status}</span>
              </div>
              <div className="progress" style={{ marginTop: 10 }}>
                <span style={{ width: Math.min(100, Math.max(2, leads[0].score)) + "%" }} />
              </div>
              <div className="faint small" style={{ marginTop: 8 }}>
                {leads[0].a?.code} ↔ {leads[0].b?.code}
              </div>
              <button className="btn sm block" style={{ marginTop: 10 }} onClick={() => goto("graph")}>
                Lihat graf korelasi <Icon name="arrow" size={12} />
              </button>
            </div>
          </>
        )}

        <div className="section-title">
          <h2>Komposisi indikator</h2>
          <span className="hint">{indicators.length} indikator</span>
        </div>
        <div className="card" style={{ padding: 14, boxShadow: "none" }}>
          {indicators.length === 0 ? (
            <div className="faint small">Belum ada indikator pada berkas ini.</div>
          ) : (
            <Donut
              data={kindData}
              centerValue={indicators.length}
              centerLabel="indikator"
              ariaLabel={`Komposisi ${indicators.length} indikator menurut jenis`}
            />
          )}
        </div>

        <div className="section-title">
          <h2>Ringkasan akses</h2>
        </div>
        <div className="stack">
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <span className="small muted">Status audit</span>
            <span className="mono small">{statusLabel[inc.status] ?? inc.status}</span>
          </div>
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <span className="small muted">Korelasi</span>
            <span className="mono small">{leads.length} temuan</span>
          </div>
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <span className="small muted">Berkas terverifikasi</span>
            <span className="mono small">{verified} / {artifacts.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Evidence({
  inc,
  artifacts,
  rawAccess,
  notify,
  reload,
  onPassport,
}: {
  inc: Incident;
  artifacts: ArtifactDetail[];
  rawAccess: boolean;
  notify: Notify;
  reload: () => void;
  onPassport: (id: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [scope, setScope] = useState("indicators");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [drag, setDrag] = useState(false);

  function addFiles(list: File[]) {
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...list.filter((f) => !names.has(f.name + f.size))];
    });
  }

  async function upload() {
    if (!files.length) return notify("Pilih berkas terlebih dahulu.", "error");
    setBusy(true);
    try {
      const d = await api.upload<{ results: IngestResult[]; leads: Correlation[] }>(inc.id, files, scope, note);
      setResults(d.results);
      const bad = d.results.filter((r) => r.error);
      notify(
        bad.length
          ? `${bad.length} berkas gagal, ${d.results.length - bad.length} berhasil.`
          : `${files.length} berkas dicatat. ${d.leads?.length ?? 0} temuan korelasi diperbarui.`,
        bad.length ? "error" : "ok"
      );
      setFiles([]);
      setNote("");
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!rawAccess && (
        <div className="disclaimer lock" style={{ marginBottom: 14 }}>
          <Icon name="lock" size={15} />
          <span>
            Unggah bukti hanya tersedia bagi satuan pemilik insiden atau koordinator. Anda tetap dapat
            membuka passport untuk membaca manifest, hasil analisis statis, dan chain of custody.
          </span>
        </div>
      )}

      {rawAccess && (
        <>
          <div
            className={"dropzone" + (drag ? " drag" : "")}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => document.getElementById("evidence-files")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("evidence-files")?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Pilih berkas bukti untuk diunggah"
          >
            <Icon name="upload" size={22} />
            <div className="drop-title">{files.length ? `${files.length} berkas siap dicatat` : "Jatuhkan berkas bukti di sini"}</div>
            <div className="drop-hint">
              .eml / .csv / .log / .txt / .zip / gambar — maksimum 900 KB per berkas pada mode D1
            </div>
            {files.length > 0 && (
              <div className="chip-row" style={{ justifyContent: "center", marginTop: 10 }}>
                {files.map((f) => (
                  <span
                    className="chip"
                    key={f.name + f.size}
                    title={f.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {f.name}
                    <button
                      className="btn ghost sm"
                      style={{ padding: 0, marginLeft: 2 }}
                      aria-label={`Hapus ${f.name}`}
                      onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((x) => x !== f)); }}
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              id="evidence-files"
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
          </div>

          <div className="grid evidence-meta" style={{ marginTop: 12, gap: 10 }}>
            <div className="field">
              <label htmlFor="share-scope">Izin berbagi</label>
              <select id="share-scope" className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="full">Penuh</option>
                <option value="indicators">Indikator saja</option>
                <option value="restricted">Terbatas</option>
              </select>
              <span className="field-hint">Indikator saja: berkas mentah tidak ikut dibagikan.</span>
            </div>
            <div className="field">
              <label htmlFor="evidence-note">Catatan analis</label>
              <input
                id="evidence-note"
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Konteks singkat berkas ini"
              />
            </div>
          </div>
          <div className="inline" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={upload} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="upload" size={14} />} Unggah &amp; hitung SHA-256
            </button>
            <span className="faint small">Indikator diparse otomatis dan disimpan bersama asal-usulnya.</span>
          </div>

          {results.length > 0 && (
            <div className="card" style={{ marginTop: 14, boxShadow: "none" }}>
              <div className="card-head">
                <div className="card-title">Hasil ingest</div>
                <div className="card-actions"><span className="badge neutral">{results.length} berkas</span></div>
              </div>
              <div style={{ padding: "4px 14px" }}>
                {results.map((r, i) => (
                  <div key={i} className="reason">
                    <span className="mono" style={{ minWidth: 140, wordBreak: "break-all" }}>{r.filename ?? "berkas"}</span>
                    <span className={r.error ? "faint small" : "small"} style={{ flex: 1 }}>
                      {r.error ?? r.summary}
                      {r.duplicates && r.duplicates.length > 0 && (
                        <span className="dupe" style={{ display: "flex" }}>
                          <Icon name="layers" size={10} /> hash sama dengan {r.duplicates.map((d) => d.code).join(", ")}
                        </span>
                      )}
                    </span>
                    {r.sha256 && <span className="hash" style={{ marginLeft: "auto" }}>{r.sha256.slice(0, 18)}…</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="section-title">
        <h2>Manifest bukti</h2>
        <span className="hint">{artifacts.length} artefak</span>
      </div>
      {artifacts.length === 0 ? (
        <EmptyState index="MANIFEST KOSONG" title="Belum ada berkas bukti">
          Berkas yang diunggah akan muncul di sini dengan SHA-256, status integritas, dan izin berbagi.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Berkas / SHA-256</th>
                <th>Ukuran</th>
                <th>Integritas</th>
                <th>Izin</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((a) => (
                <tr key={a.id}>
                  <td style={{ minWidth: 210 }}>
                    <div style={{ fontWeight: 600, wordBreak: "break-word" }}>{a.filename}</div>
                    <div className="faint small">{a.note || "tanpa catatan"} / {fmt(a.uploaded_at)}</div>
                    <div className="hash" style={{ marginTop: 3 }} title={a.sha256}>{a.sha256}</div>
                    {a.duplicates && a.duplicates.length > 0 && (
                      <div className="dupe">
                        <Icon name="layers" size={10} /> hash sama dengan {a.duplicates.map((d) => d.code).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="mono small nowrap">{a.size.toLocaleString("id-ID")} B</td>
                  <td>
                    {a.verified ? (
                      <span className="badge green"><Icon name="check" size={10} /> cocok</span>
                    ) : (
                      <span className="badge red"><Icon name="x" size={10} /> berubah</span>
                    )}
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ width: 104, padding: "3px 22px 3px 6px", fontSize: 10 }}
                      value={a.share_scope}
                      disabled={a.restricted || !rawAccess}
                      aria-label={`Izin berbagi ${a.filename}`}
                      onChange={async (e) => {
                        try {
                          await api.post(`/artifacts/${a.id}/share`, { scope: e.target.value });
                          notify("Izin berbagi diperbarui.", "ok");
                          reload();
                        } catch (err) {
                          notify(errorMessage(err), "error");
                        }
                      }}
                    >
                      <option value="full">penuh</option>
                      <option value="indicators">indikator</option>
                      <option value="restricted">terbatas</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => onPassport(a.id)}>
                      <Icon name="fingerprint" size={12} /> Passport
                    </button>{" "}
                    {a.restricted ? (
                      <span className="badge neutral"><Icon name="lock" size={10} /> terbatas</span>
                    ) : (
                      <a className="btn sm" href={`/api/artifacts/${a.id}/download`} aria-label={`Unduh ${a.filename}`} title="Unduh berkas">
                        <Icon name="download" size={12} /><span className="hide-md"> Unduh</span>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Indicators({
  indicators,
  meta,
  rawAccess,
  notify,
  reload,
  onPivot,
}: {
  indicators: Indicator[];
  meta: IndicatorMeta[];
  rawAccess: boolean;
  notify: Notify;
  reload: () => void;
  onPivot: (kind: string, value: string) => void;
}) {
  const [kind, setKind] = useState("");
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of indicators) map.set(i.kind, (map.get(i.kind) ?? 0) + 1);
    return map;
  }, [indicators]);
  const kinds = useMemo(() => Array.from(counts.keys()).sort(), [counts]);
  const rows = indicators.filter((i) => !kind || i.kind === kind);
  const metaById = useMemo(() => new Map(meta.map((m) => [m.indicator_id, m])), [meta]);

  return (
    <div>
      <div className="inline" style={{ justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div className="inline" style={{ gap: 5 }}>
          <button className={"btn sm" + (!kind ? " primary" : "")} onClick={() => setKind("")}>
            Semua <span className="mono" style={{ opacity: 0.65 }}>{indicators.length}</span>
          </button>
          {kinds.map((k) => (
            <button key={k} className={"btn sm" + (kind === k ? " primary" : "")} onClick={() => setKind(k)}>
              {k} <span className="mono" style={{ opacity: 0.65 }}>{counts.get(k)}</span>
            </button>
          ))}
        </div>
        <span className="faint small">{rows.length} tampil</span>
      </div>

      {!rawAccess && (
        <div className="disclaimer lock" style={{ marginBottom: 12 }}>
          <Icon name="lock" size={15} />
          <span>
            Indikator yang tidak dibagikan oleh satuan pemilik tidak ditampilkan. Pencocokan lintas
            satuan tetap berjalan lewat blinded matching, dan lifecycle hanya dapat diubah oleh satuan pemilik.
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState index="TANPA INDIKATOR" title={indicators.length === 0 ? "Belum ada indikator" : "Tidak ada indikator pada jenis ini"}>
          {indicators.length === 0
            ? "Indikator akan muncul setelah berkas bukti diunggah dan diparse."
            : "Pilih jenis indikator lain atau tampilkan semua."}
        </EmptyState>
      ) : (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nilai</th>
                <th>Asal</th>
                <th>Pertama terlihat</th>
                <th>Lifecycle</th>
                <th>Confidence</th>
                <th style={{ textAlign: "right" }}>Dibagikan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const m = metaById.get(i.id);
                return (
                  <tr key={i.id}>
                    <td><span className={"badge " + (kindTone[i.kind] ?? "neutral")}>{kindBadge[i.kind] ?? i.kind}</span></td>
                    <td style={{ minWidth: 220, maxWidth: 340 }}>
                      <button
                        className="iconbtn"
                        title="Lihat insiden lain dengan indikator ini"
                        onClick={() => onPivot(i.kind, i.norm_value)}
                      >
                        <span className="mono-val">{i.raw_value}</span>
                      </button>
                    </td>
                    <td className="faint small">{i.source}</td>
                    <td className="mono small nowrap">{fmt(i.first_seen)}</td>
                    <td>
                      <select
                        className="select"
                        style={{ width: 124, padding: "3px 20px 3px 6px", fontSize: 10 }}
                        value={m?.status ?? "suspicious"}
                        disabled={!rawAccess}
                        aria-label={`Lifecycle ${i.raw_value}`}
                        onChange={async (e) => {
                          try {
                            await api.patch(`/indicators/${i.id}/lifecycle`, { status: e.target.value });
                            notify("Status indikator diperbarui. Korelasi dihitung ulang.", "ok");
                            reload();
                          } catch (err) {
                            notify(errorMessage(err), "error");
                          }
                        }}
                      >
                        {["suspicious", "investigating", "confirmed", "false_positive", "benign", "expired"].map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {m ? (
                        <span className={"badge " + (confidenceTone[m.confidence] ?? "neutral")}>
                          {m.confidence}
                        </span>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        type="checkbox"
                        checked={i.shared}
                        disabled={!rawAccess}
                        aria-label={`Bagikan ${i.raw_value}`}
                        onChange={async (e) => {
                          const shared = e.target.checked;
                          try {
                            await api.post(`/indicators/${i.id}/share`, { shared });
                            notify(shared ? "Indikator dibagikan." : "Berbagi indikator dicabut.", "ok");
                            reload();
                          } catch (err) {
                            notify(errorMessage(err), "error");
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="faint small" style={{ marginTop: 10 }}>
        Klik nilai indikator untuk melihat insiden lain yang memuatnya. Setiap pivot dicatat pada rantai audit.
      </div>
    </div>
  );
}

function Timeline({ events }: { events: EventRow[] }) {
  const [shown, setShown] = useState(events.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(900);

  useEffect(() => {
    setShown(events.length);
    setPlaying(false);
  }, [events]);

  useEffect(() => {
    if (!playing) return;
    if (shown >= events.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => Math.min(n + 1, events.length)), speed);
    return () => clearTimeout(t);
  }, [playing, shown, events.length, speed]);

  if (events.length === 0) {
    return (
      <EmptyState index="KRONOLOGI KOSONG" title="Belum ada peristiwa">
        Peristiwa dari berkas bukti dan laporan akan digabungkan di sini menurut waktu kejadian.
      </EmptyState>
    );
  }

  const start = () => {
    setShown(1);
    setPlaying(true);
  };

  return (
    <div>
      <div className="playbar">
        <button
          className="btn sm"
          onClick={() => (playing ? setPlaying(false) : shown >= events.length ? start() : setPlaying(true))}
        >
          <Icon name={playing ? "pause" : "play"} size={12} />
          {playing ? "Jeda" : shown >= events.length ? "Putar ulang" : "Lanjutkan"}
        </button>
        <button className="btn sm" onClick={() => { setPlaying(false); setShown(events.length); }}>
          Tampilkan semua
        </button>
        <label className="sr-only" htmlFor="timeline-speed">Kecepatan pemutaran</label>
        <select
          id="timeline-speed"
          className="select"
          style={{ width: 100, padding: "4px 20px 4px 7px", fontSize: 10 }}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={1400}>Lambat</option>
          <option value={900}>Normal</option>
          <option value={450}>Cepat</option>
        </select>
        <div className="progress"><span style={{ width: Math.round((shown / events.length) * 100) + "%" }} /></div>
        <span className="count">{shown}/{events.length}</span>
      </div>
      <div className="timeline">
        {events.slice(0, shown).map((e, i) => (
          <div key={e.id} className={"tl-item kind-" + e.kind + (i === shown - 1 ? " current enter" : "")}>
            <div className="tl-time">{fmt(e.ts)}{e.unit ? ` / ${e.unit}` : ""}</div>
            <div className="tl-title">{e.title}</div>
            <div className="tl-detail">{e.detail}</div>
            <div className="faint small mono" style={{ marginTop: 2 }}>{e.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PivotModal({ kind, value, onClose, goto, notify }: {
  kind: string;
  value: string;
  onClose: () => void;
  goto: Goto;
  notify: Notify;
}) {
  const [data, setData] = useState<PivotResult | null>(null);
  const [error, setError] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose, "button");

  useEffect(() => {
    api.get<PivotResult>(`/pivot?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value)}`)
      .then(setData)
      .catch((e) => { setError(errorMessage(e)); notify(errorMessage(e), "error"); });
  }, [kind, value]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pivot-title" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <div className="card-title" id="pivot-title">Pivot indikator</div>
            <div className="card-sub mono" style={{ wordBreak: "break-all" }}>{kind} / {value}</div>
          </div>
          <div className="card-actions">
            <button className="btn ghost sm" onClick={onClose} aria-label="Tutup"><Icon name="x" size={14} /></button>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="login-error" role="alert"><span className="mono-tag">GAGAL</span><span>{error}</span></div>
          ) : !data ? (
            <div className="empty"><span className="spinner" /></div>
          ) : data.incidents.length === 0 ? (
            <EmptyState index="TANPA KEMUNCULAN" title="Tidak ada insiden lain">
              Indikator ini hanya muncul pada berkas kasus yang sedang dibuka.
            </EmptyState>
          ) : (
            data.incidents.map((r) => (
              <div className="pivot-row" key={r.id + r.first_seen}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="code">{r.code}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</div>
                  <div className="src">{r.unit} / {r.source}</div>
                </div>
                <span className={"badge " + (r.severity === "critical" ? "red" : r.severity === "high" ? "orange" : "blue")}>
                  {r.severity}
                </span>
                <button className="btn sm" onClick={() => { onClose(); goto("incident", r.id); }}>
                  Buka <Icon name="arrow" size={11} />
                </button>
              </div>
            ))
          )}
          {data && data.hidden > 0 && (
            <div className="disclaimer" style={{ marginTop: 12 }}>
              <Icon name="lock" size={14} />
              <span>{data.hidden} kemunculan berada di satuan lain dan tidak dibagikan.</span>
            </div>
          )}
          <div className="faint small" style={{ marginTop: 12 }}>Setiap pivot dicatat pada rantai audit.</div>
        </div>
      </div>
    </div>
  );
}

function Leads({
  leads,
  decide,
  deciding,
  goto,
}: {
  leads: Correlation[];
  decide: (id: string, status: string) => void;
  deciding: string | null;
  goto: Goto;
}) {
  if (leads.length === 0) {
    return (
      <EmptyState index="TANPA KORELASI" title="Belum ada korelasi untuk insiden ini">
        Sistem membandingkan indikator secara otomatis. Pasangan dengan skor di bawah ambang lemah tidak
        ditampilkan sebagai temuan.
      </EmptyState>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {leads.map((l) => {
        const tone = scoreTone(l.score);
        return (
          <div className={"lead-card tone-" + tone} key={l.id}>
            <div className="lead-head">
              <div className="lead-score" style={{ color: scoreColor(l.score) }}>{Math.round(l.score)}</div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 600 }}>
                  {l.a?.code} <span className="faint">↔</span>{" "}
                  <button className="btn ghost sm" style={{ padding: 0, color: "var(--accent)" }} onClick={() => goto("incident", l.b_id)}>
                    {l.b?.code}
                  </button>
                </div>
                <div className="faint small">{l.b?.title} / {l.b?.unit}</div>
              </div>
              <span className={"badge " + (l.band === "strong" ? "red" : l.band === "moderate" ? "orange" : "blue")}>{bandLabel[l.band] ?? l.band}</span>
              {l.status !== "open" && <span className="badge neutral">{correlationStatusLabel[l.status] ?? l.status}</span>}
            </div>

            <div style={{ marginTop: 8 }}>
              {l.reasons.map((r: Reason, i: number) => (
                <div className="reason" key={i}>
                  <span className="reason-weight">+{r.weight}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>{kindLabel[r.kind] ?? r.kind}</span>
                    {r.blinded ? <span className="blinded">{r.value}</span> : <span className="mono small" style={{ wordBreak: "break-all" }}>{r.value}</span>}
                    <div className="faint small" style={{ marginTop: 2 }}>{reasonDetail(r.detail)}</div>
                    {(r.provenance_a || r.provenance_b) && (
                      <div className="faint small mono" style={{ marginTop: 2 }}>{r.provenance_a} / {r.provenance_b}</div>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {l.status === "open" && (
              <div className="inline" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                <button className="btn sm" onClick={() => decide(l.id, "dismissed")} disabled={deciding === l.id}>
                  <Icon name="x" size={12} /> Tidak terkait
                </button>
                <button className="btn sm primary" onClick={() => decide(l.id, "confirmed")} disabled={deciding === l.id}>
                  {deciding === l.id ? <span className="spinner" /> : <Icon name="check" size={12} />} Konfirmasi korelasi
                </button>
              </div>
            )}

            <div className="disclaimer" style={{ marginTop: 10 }}>
              <Icon name="alert" size={13} />
              <span>Korelasi adalah petunjuk penyelidikan, bukan bukti bahwa pelakunya sama. Keputusan analis tercatat di rantai audit.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tasks({ inc, tasks, rawAccess, notify, reload }: {
  inc: Incident;
  tasks: Task[];
  rawAccess: boolean;
  notify: Notify;
  reload: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(inc.reporter);
  const [due, setDue] = useState("");
  const [books, setBooks] = useState<Playbook[]>([]);
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ playbooks: Playbook[] }>("/playbooks")
      .then((d) => {
        setBooks(d.playbooks);
        if (d.playbooks[0]) setBookId(d.playbooks[0].id);
      })
      .catch((e) => notify(errorMessage(e), "error"));
  }, []);

  async function runBook() {
    if (!bookId) return;
    setBusy(true);
    try {
      const d = await api.post<{ tasks: number }>(`/incidents/${inc.id}/playbook`, { playbook_id: bookId });
      notify(`${d.tasks} langkah playbook dibuat sebagai tugas.`, "ok");
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return notify("Judul tugas wajib diisi.", "error");
    setBusy(true);
    try {
      await api.post("/tasks", {
        incident_id: inc.id,
        title,
        assignee,
        due_at: due ? new Date(due).toISOString() : "",
      });
      setTitle("");
      notify("Tugas ditambahkan.", "ok");
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!rawAccess && (
        <div className="disclaimer lock" style={{ marginBottom: 12 }}>
          <Icon name="lock" size={15} />
          <span>Hanya satuan pemilik atau koordinator yang dapat menjalankan playbook dan menambah tugas.</span>
        </div>
      )}

      {rawAccess && (
        <>
          <div className="inline" style={{ marginBottom: 10 }}>
            <select className="select" style={{ maxWidth: 300 }} value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Pilih playbook">
              {books.map((b) => <option key={b.id} value={b.id}>{b.name} / v{b.version}</option>)}
            </select>
            <button className="btn" onClick={runBook} disabled={!bookId || busy}>
              {busy ? <span className="spinner" /> : <Icon name="play" size={12} />} Jalankan playbook
            </button>
            <span className="faint small">Langkah playbook dibuat sebagai tugas dengan PIC.</span>
          </div>
          <form className="card" style={{ padding: 12, marginBottom: 14, boxShadow: "none" }} onSubmit={add}>
            <div className="grid task-form-grid" style={{ gap: 8, alignItems: "end" }}>
              <div className="field">
                <label htmlFor="task-title">Tugas respons</label>
                <input id="task-title" className="input" placeholder="Tindakan yang harus dilakukan" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="task-pic">PIC</label>
                <input id="task-pic" className="input" placeholder="PIC" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="task-due">Tenggat</label>
                <input id="task-due" className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
              <button className="btn primary" disabled={busy}>
                <Icon name="plus" size={13} /> Tambah
              </button>
            </div>
          </form>
        </>
      )}

      {tasks.length === 0 ? (
        <EmptyState index="TANPA TUGAS" title="Belum ada tugas respons">
          Jalankan playbook untuk membuat rangkaian tugas dengan PIC, atau tambahkan tugas satu per satu.
        </EmptyState>
      ) : (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr><th>Tugas</th><th>PIC</th><th>Tenggat</th><th>Status</th></tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td className="muted">{t.assignee}</td>
                  <td className="mono small">{t.due_at ? fmt(t.due_at) : "—"}</td>
                  <td>
                    <select
                      className="select"
                      style={{ width: 132, padding: "3px 20px 3px 6px", fontSize: 10 }}
                      value={t.status}
                      disabled={!rawAccess}
                      aria-label={`Status tugas ${t.title}`}
                      onChange={async (e) => {
                        try {
                          await api.patch(`/tasks/${t.id}`, { status: e.target.value });
                          notify("Status tugas diperbarui.", "ok");
                          reload();
                        } catch (err) {
                          notify(errorMessage(err), "error");
                        }
                      }}
                    >
                      {["open", "in_progress", "done", "blocked"].map((s) => <option key={s} value={s}>{taskStatus[s] ?? s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Audit({ audit }: { audit: AuditEntry[] }) {
  if (audit.length === 0) {
    return <EmptyState index="AUDIT KOSONG" title="Belum ada catatan audit untuk insiden ini">Setiap mutasi akan tercatat pada rantai hash-linked.</EmptyState>;
  }
  return (
    <div className="table-wrap wide">
      <table>
        <thead><tr><th>Seq</th><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Objek</th><th>Hash</th></tr></thead>
        <tbody>
          {audit.map((a) => (
            <tr key={a.seq} className="audit-row">
              <td className="mono">#{a.seq}</td>
              <td className="mono small nowrap">{fmt(a.ts)}</td>
              <td>{a.actor}</td>
              <td className="mono small">{a.action}</td>
              <td className="mono small">{a.object_type}/{a.object_id.slice(0, 10)}…</td>
              <td className="hash" style={{ maxWidth: 160 }} title={a.hash}>{a.hash.slice(0, 18)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContextPanel({ inc, techniques, assets, artifacts, rawAccess, notify, reload }: {
  inc: Incident;
  techniques: Technique[];
  assets: Asset[];
  artifacts: ArtifactDetail[];
  rawAccess: boolean;
  notify: Notify;
  reload: () => void;
}) {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ technique_id: "", name: "", artifact_id: "", explanation: "", confidence: "medium" });

  useEffect(() => {
    api.get<{ assets: Asset[] }>("/assets")
      .then((d) => {
        setAllAssets(d.assets);
        if (d.assets[0]) setAssetId(d.assets[0].id);
      })
      .catch((e) => notify(errorMessage(e), "error"));
  }, []);

  const artifactName = (artifactId: string) => artifacts.find((a) => a.id === artifactId)?.filename ?? "tanpa artefak";

  async function addTechnique(e: React.FormEvent) {
    e.preventDefault();
    if (!form.technique_id.trim()) return notify("Technique ID wajib diisi.", "error");
    setBusy(true);
    try {
      await api.post(`/incidents/${inc.id}/techniques`, form);
      notify("Pemetaan ATT&CK ditambahkan.", "ok");
      setForm({ technique_id: "", name: "", artifact_id: "", explanation: "", confidence: "medium" });
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    if (!assetId) return;
    setBusy(true);
    try {
      await api.post(`/incidents/${inc.id}/assets`, { asset_id: assetId });
      notify("Aset ditautkan.", "ok");
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid context-grid" style={{ gap: 20 }}>
      <div style={{ minWidth: 0 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Pemetaan ATT&amp;CK</h2>
          <span className="hint">{techniques.length} teknik</span>
        </div>
        {techniques.length === 0 ? (
          <EmptyState index="TANPA PEMETAAN" title="Belum ada teknik dipetakan">
            Tambahkan teknik beserta artefak pendukung agar klaim dapat ditelusuri.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Teknik</th><th>Bukti</th><th>Confidence</th></tr></thead>
              <tbody>
                {techniques.map((t) => (
                  <tr key={t.id}>
                    <td style={{ minWidth: 180 }}>
                      <div className="mono" style={{ color: "var(--accent)" }}>{t.technique_id}</div>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="faint small">{t.explanation}</div>
                    </td>
                    <td className="faint small">{artifactName(t.artifact_id)}</td>
                    <td><span className={"badge " + (t.confidence === "high" ? "green" : t.confidence === "low" ? "neutral" : "amber")}>{t.confidence}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rawAccess ? (
          <form className="card" style={{ padding: 12, marginTop: 12, boxShadow: "none" }} onSubmit={addTechnique}>
            <div className="grid grid-2" style={{ gap: 8 }}>
              <div className="field">
                <label htmlFor="technique-id">Technique ID</label>
                <input id="technique-id" className="input" placeholder="T1566.002" value={form.technique_id} onChange={(e) => setForm({ ...form, technique_id: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="technique-name">Nama teknik</label>
                <input id="technique-name" className="input" placeholder="Spearphishing link" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="technique-artifact">Artefak pendukung</label>
              <select id="technique-artifact" className="select" value={form.artifact_id} onChange={(e) => setForm({ ...form, artifact_id: e.target.value })}>
                <option value="">Pilih artefak pendukung</option>
                {artifacts.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="technique-explanation">Penjelasan analis</label>
              <input id="technique-explanation" className="input" placeholder="Mengapa teknik ini relevan" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <div className="field" style={{ width: 130 }}>
                <label htmlFor="technique-confidence">Confidence</label>
                <select id="technique-confidence" className="select" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
                  {["low", "medium", "high"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn primary" disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="plus" size={13} />} Tambah pemetaan
              </button>
            </div>
          </form>
        ) : (
          <div className="disclaimer lock" style={{ marginTop: 12 }}>
            <Icon name="lock" size={15} />
            <span>Hanya satuan pemilik atau koordinator yang dapat menambah pemetaan ATT&amp;CK.</span>
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          <h2>Aset terdampak</h2>
          <span className="hint">{assets.length} aset</span>
        </div>
        {assets.length === 0 ? (
          <EmptyState index="TANPA ASET" title="Belum ada aset tertaut">
            Tautkan aset dari inventaris satuan agar dampak insiden dapat dilihat.
          </EmptyState>
        ) : (
          <div className="stack">
            {assets.map((a) => (
              <div className="lead-card" key={a.id}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650 }}>{a.name}</div>
                    <div className="faint small mono" style={{ wordBreak: "break-all" }}>{a.hostname} / {a.unit}</div>
                  </div>
                  <span className={"badge " + (a.criticality === "critical" ? "red" : a.criticality === "high" ? "orange" : "blue")}>
                    {a.criticality}
                  </span>
                </div>
                <div className="faint small" style={{ marginTop: 6 }}>{a.notes} / status {a.status}</div>
              </div>
            ))}
          </div>
        )}

        {rawAccess && (
          <div className="inline" style={{ marginTop: 10 }}>
            <select className="select" style={{ maxWidth: 280 }} value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="Pilih aset">
              {allAssets.map((a) => <option key={a.id} value={a.id}>{a.name} / {a.hostname}</option>)}
            </select>
            <button className="btn" onClick={link} disabled={!assetId || busy}>Tautkan aset</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AccessPanel({ requests, user, notify, reload }: {
  requests: AccessRequest[];
  user: { role: string };
  notify: Notify;
  reload: () => void;
}) {
  const [deciding, setDeciding] = useState<string | null>(null);

  async function decide(id: string, status: string) {
    setDeciding(id);
    try {
      await api.post(`/access-requests/${id}/decide`, { status });
      notify(status === "approved" ? "Akses disetujui dan dicatat." : "Permintaan ditolak.", "ok");
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div>
      <div className="disclaimer" style={{ marginBottom: 12 }}>
        <Icon name="lock" size={15} />
        <span>
          Berkas mentah lintas satuan memerlukan persetujuan koordinator. Persetujuan kedaluwarsa
          otomatis dalam 3 hari dan tercatat pada chain of custody.
        </span>
      </div>
      {requests.length === 0 ? (
        <EmptyState index="TANPA PERMINTAAN" title="Belum ada permintaan akses">
          Permintaan akses dibuat dari halaman passport artefak. Koordinator akan melihatnya di sini.
        </EmptyState>
      ) : (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr><th>Pemohon</th><th>Izin</th><th>Alasan</th><th>Status</th><th>Kedaluwarsa</th><th style={{ textAlign: "right" }}>Aksi</th></tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const expired = r.status === "approved" && Boolean(r.expires_at) && new Date(r.expires_at).getTime() <= Date.now();
                const effectiveStatus = expired ? "expired" : r.status;
                return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.requester}</div>
                    <div className="faint small">{r.requester_unit}</div>
                  </td>
                  <td className="mono small">{r.scope}</td>
                  <td className="faint small" style={{ maxWidth: 240 }}>{r.reason || "tanpa alasan"}</td>
                  <td><span className={"badge " + (accessTone[effectiveStatus] ?? "neutral")}>{accessStatusLabel[effectiveStatus] ?? effectiveStatus}</span></td>
                  <td className="mono small">{r.expires_at ? fmt(r.expires_at) : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {user.role === "coordinator" && r.status === "pending" ? (
                      <>
                        <button className="btn sm" onClick={() => decide(r.id, "rejected")} disabled={deciding === r.id}>Tolak</button>{" "}
                        <button className="btn sm primary" onClick={() => decide(r.id, "approved")} disabled={deciding === r.id}>
                          {deciding === r.id ? <span className="spinner" /> : "Setujui"}
                        </button>
                      </>
                    ) : r.status === "pending" ? (
                      <span className="faint small">Menunggu koordinator</span>
                    ) : (
                      <span className="faint small">{r.decided_by ?? "—"}</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PassportPanel({
  artifactId,
  user,
  incidentUnit,
  onClose,
  notify,
  reload,
}: {
  artifactId: string;
  user: { role: string; unit: string; username?: string };
  incidentUnit: string;
  onClose: () => void;
  notify: Notify;
  reload: () => void;
}) {
  const [p, setP] = useState<Passport | null>(null);
  const [error, setError] = useState<string>("");
  const [note, setNote] = useState("");
  const [toUnit, setToUnit] = useState("Satuan Bravo");
  const [transferNote, setTransferNote] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("raw");
  const [busy, setBusy] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function load() {
    setError("");
    api.get<Passport>(`/artifacts/${artifactId}/passport`)
      .then(setP)
      .catch((e) => { setError(errorMessage(e)); notify(errorMessage(e), "error"); });
  }

  useEffect(() => {
    load();
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const nodes = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(nodes).filter((el) => el.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      previous?.focus?.();
    };
  }, [artifactId]);

  const isOwner = user.role === "coordinator" || user.unit === incidentUnit;
  const lastCustody = p?.custody[p.custody.length - 1];
  const pendingTransfer = lastCustody?.action === "transfer" ? lastCustody : null;
  const canAccept = Boolean(
    pendingTransfer && (user.role === "coordinator" || !pendingTransfer.to_unit || pendingTransfer.to_unit === user.unit)
  );

  async function addNote() {
    if (!note.trim()) return notify("Catatan tidak boleh kosong.", "error");
    setBusy(true);
    try {
      await api.post(`/artifacts/${artifactId}/custody`, { action: "note", note });
      setNote("");
      notify("Catatan custody ditambahkan.", "ok");
      load();
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function transfer() {
    if (!toUnit.trim()) return notify("Satuan penerima wajib diisi.", "error");
    setBusy(true);
    try {
      await api.post(`/artifacts/${artifactId}/custody`, { action: "transfer", to_unit: toUnit, note: transferNote });
      setTransferNote("");
      notify(`Transfer ke ${toUnit} dicatat.`, "ok");
      load();
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    try {
      await api.post(`/artifacts/${artifactId}/accept`);
      notify("Penerimaan custody dicatat.", "ok");
      load();
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    if (!reason.trim()) return notify("Alasan permintaan wajib diisi.", "error");
    setBusy(true);
    try {
      await api.post("/access-requests", { artifact_id: artifactId, scope, reason });
      notify("Permintaan akses dikirim ke koordinator.", "ok");
      setReason("");
      load();
      reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const verdictTone = p?.analysis?.verdict === "malicious"
    ? "signal"
    : p?.analysis?.verdict === "suspicious"
      ? "amber"
      : "green";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-title"
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <div className="card-title" id="passport-title">Evidence passport</div>
            <div className="card-sub mono" style={{ wordBreak: "break-all" }}>{p?.artifact.filename ?? "memuat berkas"}</div>
          </div>
          <div className="card-actions">
            {p && (
              <span className={"badge " + (p.chain_ok ? "green" : "red")}>
                <Icon name={p.chain_ok ? "check" : "x"} size={10} /> custody {p.chain_ok ? "utuh" : "rusak"}
              </span>
            )}
            <button className="btn ghost sm" ref={closeRef} onClick={onClose} aria-label="Tutup passport">
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ padding: 16 }}>
            <ErrorState title="Passport tidak dapat dibuka" message={error} onRetry={load} />
          </div>
        ) : !p ? (
          <div className="empty"><span className="spinner" /></div>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {p.artifact.restricted && (
              <div className="disclaimer lock">
                <Icon name="lock" size={15} />
                <span>
                  Artefak ditandai <b>terbatas</b> untuk satuan Anda. Metadata dan custody terlihat;
                  unduhan memerlukan persetujuan koordinator.
                </span>
              </div>
            )}

            <div className="grid grid-2" style={{ gap: 16 }}>
              <div>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Identitas artefak</h2></div>
                <dl className="kv">
                  <dt>SHA-256</dt><dd className="hash">{p.artifact.sha256}</dd>
                  <dt>Ukuran</dt><dd className="mono">{p.artifact.size.toLocaleString("id-ID")} B</dd>
                  <dt>TLP</dt><dd><Stamp tone={p.tlp === "red" ? "signal" : p.tlp === "green" || p.tlp === "clear" ? "green" : "amber"}>{p.tlp.toUpperCase()}</Stamp></dd>
                  <dt>Integritas</dt>
                  <dd>{p.artifact.verified ? <span className="badge green">cocok</span> : <span className="badge red">berubah</span>}</dd>
                  <dt>Pemegang</dt>
                  <dd>{p.custody.filter((c) => c.to_unit).slice(-1)[0]?.to_unit ?? p.artifact.uploaded_by}</dd>
                  <dt>Izin berbagi</dt><dd className="mono">{p.artifact.share_scope}</dd>
                  <dt>Duplikat</dt>
                  <dd>{p.artifact.duplicates.length === 0 ? "tidak ada" : p.artifact.duplicates.map((d) => d.code).join(", ")}</dd>
                </dl>
              </div>
              <div>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Analisis statis</h2></div>
                {p.analysis ? (
                  <>
                    <div className="inline" style={{ marginBottom: 8 }}>
                      <Stamp tone={verdictTone}>{p.analysis.verdict}</Stamp>
                      {p.analysis.mismatch && <span className="badge red">ekstensi tidak cocok</span>}
                      {p.analysis.macro && <span className="badge red">makro</span>}
                    </div>
                    <dl className="kv">
                      <dt>Tipe</dt><dd>{p.analysis.file_type}</dd>
                      <dt>Ekstensi</dt><dd className="mono">.{p.analysis.extension}</dd>
                      <dt>Entropi</dt><dd className="mono">{p.analysis.entropy}</dd>
                      <dt>Nested</dt><dd>{p.analysis.nested ? "ya" : "tidak"}</dd>
                    </dl>
                    {p.analysis.rules.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div className="small faint" style={{ marginBottom: 4 }}>Aturan cocok</div>
                        <div className="chip-row">
                          {p.analysis.rules.map((r) => (
                            <span className="chip" key={r.rule} title={r.description}>
                              {r.rule} / {r.severity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {p.analysis.explanations.length > 0 && (
                      <ul className="small muted" style={{ margin: "8px 0 0 16px", padding: 0 }}>
                        {p.analysis.explanations.map((x) => (
                          <li key={x} style={{ marginBottom: 3 }}>{x}</li>
                        ))}
                      </ul>
                    )}
                    {(p.analysis.embedded_urls.length > 0 || p.analysis.suspicious_strings.length > 0) && (
                      <div className="chip-row" style={{ marginTop: 8 }}>
                        {p.analysis.embedded_urls.slice(0, 3).map((u) => <span className="chip" key={u} title={u}>{u}</span>)}
                        {p.analysis.suspicious_strings.slice(0, 4).map((s) => <span className="chip" key={s}>{s}</span>)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="faint small">Belum ada hasil analisis untuk artefak ini.</div>
                )}
              </div>
            </div>

            <div>
              <div className="section-title" style={{ marginTop: 0 }}>
                <h2>Chain of custody</h2>
                <span className="hint">{p.custody.length} entri</span>
              </div>
              {p.custody.length === 0 ? (
                <div className="empty">Belum ada catatan custody.</div>
              ) : (
                <div className="timeline">
                  {p.custody.map((c) => (
                    <div key={c.id} className={"tl-item kind-" + (c.action === "transfer" ? "attachment" : "report")}>
                      <div className="tl-time">{fmt(c.ts)} / {c.actor}</div>
                      <div className="tl-title">{c.action.replace(/_/g, " ")}{c.to_unit ? ` → ${c.to_unit}` : ""}</div>
                      <div className="tl-detail">{c.note || "tanpa catatan"}</div>
                      <div className="faint small mono">{c.hash.slice(0, 28)}…</div>
                    </div>
                  ))}
                </div>
              )}
              {p.broken_seq && <div className="badge red">Rantai custody rusak pada {p.broken_seq}</div>}
              {pendingTransfer && (
                <div className="inline" style={{ marginTop: 8, justifyContent: "space-between" }}>
                  <span className="small muted">
                    Transfer menunggu penerimaan {pendingTransfer.to_unit || "penerima"}.
                  </span>
                  {canAccept && (
                    <button className="btn" onClick={accept} disabled={busy}>
                      {busy ? <span className="spinner" /> : <Icon name="check" size={13} />} Terima transfer
                    </button>
                  )}
                </div>
              )}
            </div>

            {p.access.length > 0 && (
              <div>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Permintaan akses</h2></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Pemohon</th><th>Izin</th><th>Status</th><th>Kedaluwarsa</th></tr></thead>
                    <tbody>
                      {p.access.map((a) => {
                        const expired = a.status === "approved" && Boolean(a.expires_at) && new Date(a.expires_at).getTime() <= Date.now();
                        const effectiveStatus = expired ? "expired" : a.status;
                        return (
                        <tr key={a.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{a.requester}</div>
                            <div className="faint small">{a.requester_unit}</div>
                          </td>
                          <td className="mono small">{a.scope}</td>
                          <td><span className={"badge " + (accessTone[effectiveStatus] ?? "neutral")}>{accessStatusLabel[effectiveStatus] ?? effectiveStatus}</span></td>
                          <td className="mono small">{a.expires_at ? fmt(a.expires_at) : "—"}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {p.artifact.restricted && (
              <div>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Minta akses</h2></div>
                <div className="grid passport-form" style={{ gap: 8, alignItems: "end" }}>
                  <div className="field">
                    <label htmlFor="access-scope">Izin</label>
                    <select id="access-scope" className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
                      {["metadata", "indicators", "raw"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="access-reason">Alasan permintaan</label>
                    <input id="access-reason" className="input" placeholder="Keperluan investigasi" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <button className="btn primary" onClick={request} disabled={busy}>Kirim permintaan</button>
                </div>
              </div>
            )}

            {isOwner ? (
              <>
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}><h2>Catat penanganan</h2></div>
                  <div className="inline">
                    <input
                      className="input"
                      style={{ flex: 2, minWidth: 220 }}
                      placeholder="Catatan custody, mis. hash diverifikasi ulang"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <button className="btn" onClick={addNote} disabled={!note.trim() || busy}>Tambah catatan</button>
                  </div>
                </div>

                <div>
                  <div className="section-title" style={{ marginTop: 0 }}><h2>Transfer custody</h2></div>
                  <div className="grid transfer-form" style={{ gap: 8, alignItems: "end" }}>
                    <div className="field">
                      <label htmlFor="transfer-unit">Satuan penerima</label>
                      <input id="transfer-unit" className="input" value={toUnit} onChange={(e) => setToUnit(e.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor="transfer-note">Catatan transfer</label>
                      <input id="transfer-note" className="input" placeholder="Konteks serah terima" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
                    </div>
                    <button className="btn" onClick={transfer} disabled={busy}>Transfer</button>
                  </div>
                  <div className="faint small" style={{ marginTop: 6 }}>
                    Penerima menandatangani penerimaan dari halaman passport ini.
                  </div>
                </div>
              </>
            ) : (
              <div className="disclaimer lock">
                <Icon name="lock" size={15} />
                <span>Hanya satuan pemilik atau koordinator yang dapat mencatat custody dan transfer artefak ini.</span>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
