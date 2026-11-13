import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../api";
import { Icon } from "../ui";
import type {
  AccessRequest, ArtifactDetail, Asset, AuditEntry, Correlation, EventRow, Goto, Incident,
  IncidentDetail as IncidentDetailData, Indicator, IndicatorMeta, IngestResult, Notify, PageProps,
  Passport, PivotResult, Playbook, Reason, Task, Technique,
} from "../types";

const sevTone: Record<string, string> = { critical: "red", high: "amber", medium: "blue", low: "neutral" };
const statusTone: Record<string, string> = { open: "amber", investigating: "blue", contained: "green", closed: "neutral" };
const kindTone: Record<string, string> = {
  sha256: "violet", md5: "violet", domain: "amber", ip: "blue", url: "amber",
  email: "teal", filename: "neutral", lookalike: "red",
};

function scoreColor(n: number) {
  return n >= 70 ? "var(--red)" : n >= 45 ? "var(--accent)" : "var(--blue)";
}

function fmt(ts: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function IncidentDetail({ id, sub, extra, user, goto, notify }: PageProps & { id: string; sub?: string; extra?: string }) {
  const [data, setData] = useState<IncidentDetailData | null>(null);
  const [tab, setTab] = useState(sub || "overview");
  const [busy, setBusy] = useState(false);
  const [pivot, setPivot] = useState<{ kind: string; value: string } | null>(null);
  const [passport, setPassport] = useState<string | null>(sub === "passport" ? extra ?? null : null);

  const load = () =>
    api.get<IncidentDetailData>("/incidents/" + id)
      .then(setData)
      .catch((e) => notify(errorMessage(e), "error"));
  useEffect(() => {
    setData(null);
    setTab(sub || "overview");
    load();
  }, [id]);

  async function decide(leadId: string, status: string) {
    try {
      await api.post(`/correlations/${leadId}/decide`, { status });
      notify(status === "confirmed" ? "Korelasi dikonfirmasi dan dicatat." : "Korelasi ditolak.", "ok");
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }

  async function changeStatus(status: string) {
    try {
      await api.patch(`/incidents/${id}/status`, { status });
      notify("Status diperbarui.", "ok");
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }

  if (!data) {
    return <div className="loading-screen"><span className="spinner" /><div className="small">Memuat berkas kasus…</div></div>;
  }

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
    <div className="fade-up">
      <div className="inline" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div className="inline" style={{ gap: 10 }}>
            <button className="btn ghost sm" onClick={() => goto("incidents")}>
              <Icon name="arrow" size={14} style={{ transform: "rotate(180deg)" }} /> Kembali
            </button>
            <span className="mono muted small">{inc.code}</span>
            <span className={"badge " + (sevTone[inc.severity] ?? "neutral")}>{inc.severity}</span>
            <span className={"badge " + (statusTone[inc.status] ?? "neutral")}>{inc.status}</span>
            <span className={"badge " + (tlp === "green" || tlp === "clear" ? "green" : "amber")}>TLP:{String(tlp).toUpperCase()}</span>
          </div>
          <h1 style={{ fontSize: 24, margin: "10px 0 2px", letterSpacing: "-0.03em" }}>{inc.title}</h1>
          <div className="muted small">{inc.unit} · {inc.category} · dilaporkan {fmt(inc.occurred_at)}</div>
        </div>
        <div className="inline">
          <select className="select" style={{ width: 160 }} value={inc.status} onChange={(e) => changeStatus(e.target.value)}>
            {["open", "investigating", "contained", "closed"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={() => window.open(`/api/report/${inc.id}?format=html`, "_blank")}>
            <Icon name="file" size={15} /> Laporan
          </button>
        </div>
      </div>

      {passport ? (
        <PassportPanel
          artifactId={passport}
          user={user}
          onClose={() => { setPassport(null); window.history.replaceState(null, "", `#/incident/${id}/${tab}`); }}
          notify={notify}
          reload={load}
        />
      ) : (
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tabs">
          {tabs.map((t) => (
            <button key={t.k} className={"tab" + (tab === t.k ? " active" : "")} onClick={() => {
              setTab(t.k);
              window.history.replaceState(null, "", `#/incident/${id}/${t.k}`);
            }}>
              {t.label}
              {t.n !== undefined && <span className="count">{t.n}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: 18 }}>
          {tab === "overview" && <Overview inc={inc} artifacts={artifacts} leads={leads} rawAccess={raw_access} goto={goto} />}
          {tab === "evidence" && <Evidence inc={inc} artifacts={artifacts} notify={notify} reload={load} onPassport={setPassport} />}
          {tab === "indicators" && <Indicators indicators={indicators} meta={indicator_meta} rawAccess={raw_access} notify={notify} reload={load} onPivot={(kind: string, value: string) => setPivot({ kind, value })} />}
          {tab === "timeline" && <Timeline events={events} />}
          {tab === "leads" && <Leads leads={leads} decide={decide} goto={goto} />}
          {tab === "context" && <ContextPanel inc={inc} techniques={techniques} assets={assets} artifacts={artifacts} notify={notify} reload={load} />}
          {tab === "tasks" && <Tasks inc={inc} tasks={tasks} notify={notify} reload={load} />}
          {tab === "access" && <AccessPanel requests={access_requests} user={user} notify={notify} reload={load} />}
          {tab === "audit" && <Audit audit={audit} />}
        </div>
      </div>
      )}

      {pivot && (
        <PivotModal kind={pivot.kind} value={pivot.value} onClose={() => setPivot(null)} goto={goto} notify={notify} />
      )}
    </div>
  );
}

function Overview({ inc, artifacts, leads, rawAccess, goto }: {
  inc: Incident; artifacts: ArtifactDetail[]; leads: Correlation[]; rawAccess: boolean; goto: Goto;
}) {
  const verified = artifacts.filter((a) => a.verified).length;
  return (
    <div className="grid grid-3" style={{ gap: 18 }}>
      <div style={{ gridColumn: "span 2" }}>
        <div className="section-title" style={{ marginTop: 0 }}><h2>Uraian</h2><div className="line" /></div>
        <p className="muted" style={{ marginTop: 0 }}>{inc.summary || "Belum ada uraian."}</p>

        <div className="section-title"><h2>Profil kampanye</h2><div className="line" /></div>
        <div className="card" style={{ padding: 14, background: "rgba(10,18,32,.5)" }}>
          <div style={{ fontWeight: 600 }}>SINYAL-01 · rekonstruksi Star Blizzard</div>
          <div className="faint small" style={{ marginTop: 4 }}>
            Profil dan teknik merujuk pada CISA AA23-341A. Indikator pada dataset ini sintetis.
          </div>
          <div className="chip-row" style={{ marginTop: 10 }}>
            {["T1566.002", "T1566.001", "T1583.001", "T1539", "T1550.004", "T1078", "T1114.002", "T1114.003"].map((t) => (
              <span className="chip" key={t}><span className="k">ATT&CK</span> {t}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 0 }}><h2>Ringkasan</h2><div className="line" /></div>
        <dl className="kv">
          <dt>Kode</dt><dd className="mono">{inc.code}</dd>
          <dt>Satuan</dt><dd>{inc.unit}</dd>
          <dt>Pelapor</dt><dd>{inc.reporter}</dd>
          <dt>Terjadi</dt><dd>{fmt(inc.occurred_at)}</dd>
          <dt>Berkas</dt><dd>{artifacts.length} ({verified} terverifikasi)</dd>
          <dt>Indikator</dt><dd>{inc.indicator_count}</dd>
          <dt>Korelasi</dt><dd>{leads.length} temuan</dd>
          <dt>Akses bukti</dt><dd>{rawAccess ? "penuh" : "indikator saja"}</dd>
        </dl>
        <div className="disclaimer" style={{ marginTop: 14 }}>
          <Icon name={rawAccess ? "eye" : "lock"} size={15} />
          <span>
            {rawAccess
              ? "Anda memiliki akses ke berkas mentah satuan ini. Unduhan tercatat di audit."
              : "Berkas mentah milik satuan lain dibatasi. Anda hanya melihat indikator yang dibagikan."}
          </span>
        </div>
        {leads.length > 0 && (
          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <div className="small faint">Temuan terkuat</div>
            <div className="inline" style={{ marginTop: 6, gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 750, color: scoreColor(leads[0].score) }}>{Math.round(leads[0].score)}</span>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{leads[0].band}</div>
                <div className="faint small">{leads[0].reasons?.length ?? 0} alasan tercatat</div>
              </div>
            </div>
            <button className="btn sm" style={{ marginTop: 10, width: "100%" }} onClick={() => goto("graph")}>
              Lihat graf <Icon name="arrow" size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Evidence({ inc, artifacts, notify, reload, onPassport }: {
  inc: Incident; artifacts: ArtifactDetail[]; notify: Notify; reload: () => void;
  onPassport: (id: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [scope, setScope] = useState("indicators");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);
  const [drag, setDrag] = useState(false);

  async function upload() {
    if (!files.length) return notify("Pilih berkas terlebih dahulu.", "error");
    setBusy(true);
    try {
      const d = await api.upload<{ results: IngestResult[]; leads: Correlation[] }>(inc.id, files, scope, note);
      setResults(d.results);
      const bad = d.results.filter((r) => r.error);
      notify(
        bad.length ? `${bad.length} berkas gagal, ${d.results.length - bad.length} berhasil.` : `${files.length} berkas dicatat. ${d.leads?.length ?? 0} temuan korelasi diperbarui.`,
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
      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Icon name="upload" size={26} />
        <div style={{ fontWeight: 600, marginTop: 6 }}>{files.length ? `${files.length} berkas dipilih` : "Jatuhkan berkas bukti di sini"}</div>
        <div className="faint small" style={{ marginTop: 2 }}>Email .eml, log .csv/.txt, arsip .zip, tangkapan layar. Maksimum 900 KB per berkas pada demo D1.</div>
        {files.length > 0 && (
          <div className="chip-row" style={{ justifyContent: "center", marginTop: 10 }}>
            {files.map((f) => <span className="chip" key={f.name}>{f.name}</span>)}
          </div>
        )}
        <input
          id="file-input"
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <div className="grid grid-3" style={{ marginTop: 12, gap: 12 }}>
        <div className="field">
          <label>Izin berbagi</label>
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="full">Penuh (boleh diunduh lintas satuan)</option>
            <option value="indicators">Indikator saja (rekomendasi)</option>
            <option value="restricted">Hanya satuan sendiri</option>
          </select>
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label>Catatan analis</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Konteks singkat berkas ini…" />
        </div>
      </div>
      <div className="inline" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={upload} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="upload" size={15} />} Unggah & hitung SHA-256
        </button>
        <span className="faint small">Setiap berkas diparse otomatis; indikator disimpan dengan asal-usulnya.</span>
      </div>

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: 12 }}>
          <div className="small faint" style={{ marginBottom: 6 }}>Hasil ingest</div>
          {results.map((r, i) => (
            <div key={i} className="reason">
              <span className="mono" style={{ minWidth: 160 }}>{r.filename ?? "berkas"}</span>
              <span className="faint small">
                {r.error ?? r.summary}
                {r.duplicates && r.duplicates.length > 0 && (
                  <span className="dupe" style={{ display: "flex" }}>
                    <Icon name="layers" size={11} /> hash sama dengan {r.duplicates.map((d) => d.code).join(", ")}
                  </span>
                )}
              </span>
              {r.sha256 && <span className="hash" style={{ marginLeft: "auto" }}>{r.sha256.slice(0, 20)}…</span>}
            </div>
          ))}
        </div>
      )}

      <div className="section-title"><h2>Manifest bukti</h2><div className="line" /></div>
      <table>
        <thead>
          <tr><th>Berkas</th><th>Ukuran</th><th>SHA-256</th><th>Integritas</th><th>Izin</th><th style={{ textAlign: "right" }}>Aksi</th></tr>
        </thead>
        <tbody>
          {artifacts.length === 0 && <tr><td colSpan={6} className="empty">Belum ada berkas.</td></tr>}
          {artifacts.map((a) => (
            <tr key={a.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{a.filename}</div>
                <div className="faint small">{a.note || "tanpa catatan"} · {fmt(a.uploaded_at)}</div>
                {a.duplicates && a.duplicates.length > 0 && (
                  <div className="dupe"><Icon name="layers" size={11} /> hash sama dengan {a.duplicates.map((d) => d.code).join(", ")}</div>
                )}
              </td>
              <td className="mono small nowrap">{a.size.toLocaleString("id-ID")} B</td>
              <td className="hash" style={{ maxWidth: 230 }}>{a.sha256}</td>
              <td>
                {a.verified ? <span className="badge green"><Icon name="check" size={12} /> cocok</span> : <span className="badge red"><Icon name="x" size={12} /> berubah</span>}
              </td>
              <td>
                <select className="select" style={{ width: 130, padding: "4px 8px", fontSize: 11 }}
                  value={a.share_scope} disabled={a.restricted}
                  onChange={async (e) => { await api.post(`/artifacts/${a.id}/share`, { scope: e.target.value }); reload(); }}>
                  <option value="full">penuh</option>
                  <option value="indicators">indikator</option>
                  <option value="restricted">terbatas</option>
                </select>
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn sm" onClick={() => onPassport(a.id)}>
                  <Icon name="fingerprint" size={13} /> Passport
                </button>{" "}
                {a.restricted ? (
                  <span className="badge neutral"><Icon name="lock" size={11} /> terbatas</span>
                ) : (
                  <a className="btn sm" href={`/api/artifacts/${a.id}/download`}>Unduh <Icon name="download" size={13} /></a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Indicators({ indicators, meta, rawAccess, notify, reload, onPivot }: {
  indicators: Indicator[]; meta: IndicatorMeta[]; rawAccess: boolean; notify: Notify; reload: () => void;
  onPivot: (kind: string, value: string) => void;
}) {
  const [kind, setKind] = useState("");
  const kinds = useMemo(() => Array.from(new Set(indicators.map((i) => i.kind))).sort(), [indicators]);
  const rows = indicators.filter((i) => !kind || i.kind === kind);
  const metaById = useMemo(() => new Map(meta.map((m) => [m.indicator_id, m])), [meta]);

  return (
    <div>
      <div className="inline" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="inline" style={{ gap: 6 }}>
          <button className={"btn sm" + (!kind ? " primary" : "")} onClick={() => setKind("")}>Semua</button>
          {kinds.map((k) => (
            <button key={k} className={"btn sm" + (kind === k ? " primary" : "")} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
        <span className="faint small">{rows.length} indikator</span>
      </div>
      {!rawAccess && (
        <div className="disclaimer" style={{ marginBottom: 10 }}>
          <Icon name="lock" size={15} />
          <span>Indikator tidak dibagikan oleh satuan pemilik tidak ditampilkan. Pencocokan tetap berjalan lewat blinded matching.</span>
        </div>
      )}
      <table>
        <thead>
          <tr><th>Jenis</th><th>Nilai</th><th>Asal</th><th>Pertama terlihat</th><th>Lifecycle</th><th style={{ textAlign: "right" }}>Dibagikan</th></tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td><span className={"badge " + (kindTone[i.kind] ?? "neutral")}>{i.kind}</span></td>
              <td>
                <button className="iconbtn" title="Lihat insiden lain dengan indikator ini" onClick={() => onPivot(i.kind, i.norm_value)}>
                  <span className="mono-val">{i.raw_value}</span>
                </button>
              </td>
              <td className="faint small">{i.source}</td>
              <td className="mono small nowrap">{fmt(i.first_seen)}</td>
              <td>
                <select
                  className="select"
                  style={{ width: 132, padding: "3px 7px", fontSize: 10.5 }}
                  value={metaById.get(i.id)?.status ?? "suspicious"}
                  disabled={!rawAccess}
                  onChange={async (e) => {
                    await api.patch(`/indicators/${i.id}/lifecycle`, { status: e.target.value });
                    notify("Status indikator diperbarui. Korelasi dihitung ulang.", "ok");
                    reload();
                  }}
                >
                  {["suspicious", "investigating", "confirmed", "false_positive", "benign", "expired"].map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </td>
              <td style={{ textAlign: "right" }}>
                <input
                  type="checkbox" checked={i.shared} disabled={!rawAccess}
                  onChange={async (e) => { await api.post(`/indicators/${i.id}/share`, { shared: e.target.checked }); reload(); }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

  const start = () => {
    setShown(1);
    setPlaying(true);
  };

  if (events.length === 0) return <div className="empty">Belum ada peristiwa.</div>;

  return (
    <div>
      <div className="playbar">
        <button
          className="btn sm"
          onClick={() => (playing ? setPlaying(false) : shown >= events.length ? start() : setPlaying(true))}
        >
          <Icon name={playing ? "pause" : "play"} size={13} />
          {playing ? "Jeda" : shown >= events.length ? "Putar ulang" : "Lanjutkan"}
        </button>
        <button className="btn sm" onClick={() => { setPlaying(false); setShown(events.length); }}>
          Tampilkan semua
        </button>
        <select
          className="select"
          style={{ width: 108, padding: "4px 8px", fontSize: 11 }}
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
        {events.slice(0, shown).map((e, i: number) => (
          <div key={e.id} className={"tl-item kind-" + e.kind + (i === shown - 1 ? " current enter" : "")}>
            <div className="tl-time">{fmt(e.ts)} · {e.unit ?? ""}</div>
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
  kind: string; value: string; onClose: () => void; goto: Goto; notify: Notify;
}) {
  const [data, setData] = useState<PivotResult | null>(null);

  useEffect(() => {
    api.get<PivotResult>(`/pivot?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value)}`)
      .then(setData)
      .catch((e) => notify(errorMessage(e), "error"));
  }, [kind, value]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <div className="card-title">Pivot indikator</div>
            <div className="card-sub mono" style={{ wordBreak: "break-all" }}>{kind} · {value}</div>
          </div>
          <div className="card-actions">
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>
        </div>
        <div className="card-body">
          {!data ? (
            <div className="empty"><span className="spinner" /></div>
          ) : data.incidents.length === 0 ? (
            <div className="empty">Tidak ada insiden lain yang memuat indikator ini.</div>
          ) : (
            data.incidents.map((r) => (
              <div className="pivot-row" key={r.id + r.first_seen}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="code">{r.code}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</div>
                  <div className="src">{r.unit} · {r.source}</div>
                </div>
                <span className={"badge " + (r.severity === "critical" ? "red" : r.severity === "high" ? "amber" : "blue")}>
                  {r.severity}
                </span>
                <button className="btn sm" onClick={() => { onClose(); goto("incident", r.id); }}>
                  Buka <Icon name="arrow" size={12} />
                </button>
              </div>
            ))
          )}
          {data?.hidden > 0 && (
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

function Leads({ leads, decide, goto }: {
  leads: Correlation[]; decide: (id: string, status: string) => void; goto: Goto;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {leads.length === 0 && <div className="empty">Belum ada korelasi untuk insiden ini.</div>}
      {leads.map((l) => (
        <div className="lead-card" key={l.id}>
          <div className="lead-head">
            <div className="lead-score" style={{ color: scoreColor(l.score) }}>{Math.round(l.score)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {l.a?.code} <span className="faint">↔</span>{" "}
                <button className="btn ghost sm" style={{ padding: 0, color: "var(--accent)" }} onClick={() => goto("incident", l.b_id)}>
                  {l.b?.code}
                </button>
              </div>
              <div className="faint small">{l.b?.title} · {l.b?.unit}</div>
            </div>
            <span className={"badge " + (l.band === "strong" ? "red" : l.band === "moderate" ? "amber" : "blue")}>{l.band}</span>
            {l.status !== "open" && <span className="badge neutral">{l.status}</span>}
          </div>

          <div style={{ marginTop: 10 }}>
            {l.reasons.map((r: Reason, i: number) => (
              <div className="reason" key={i}>
                <span className="reason-weight">+{r.weight}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, marginRight: 6 }}>{r.kind === "temporal" ? "waktu" : r.kind}</span>
                  {r.blinded ? <span className="blinded">{r.value}</span> : <span className="mono small">{r.value}</span>}
                  <div className="faint small" style={{ marginTop: 2 }}>{r.detail}</div>
                  {(r.provenance_a || r.provenance_b) && (
                    <div className="faint small mono" style={{ marginTop: 2 }}>{r.provenance_a} · {r.provenance_b}</div>
                  )}
                </span>
              </div>
            ))}
          </div>

          {l.status === "open" && (
            <div className="inline" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn sm" onClick={() => decide(l.id, "dismissed")}>
                <Icon name="x" size={13} /> Tidak terkait
              </button>
              <button className="btn sm primary" onClick={() => decide(l.id, "confirmed")}>
                <Icon name="check" size={13} /> Konfirmasi korelasi
              </button>
            </div>
          )}

          <div className="disclaimer" style={{ marginTop: 10 }}>
            <Icon name="alert" size={14} />
            <span>Korelasi adalah petunjuk penyelidikan, bukan bukti bahwa pelakunya sama. Keputusan analis tercatat di rantai audit.</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Tasks({ inc, tasks, notify, reload }: {
  inc: Incident; tasks: Task[]; notify: Notify; reload: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(inc.reporter);
  const [due, setDue] = useState("");
  const [books, setBooks] = useState<Playbook[]>([]);
  const [bookId, setBookId] = useState("");

  useEffect(() => {
    api.get<{ playbooks: Playbook[] }>("/playbooks")
      .then((d) => { setBooks(d.playbooks); if (d.playbooks[0]) setBookId(d.playbooks[0].id); })
      .catch(() => {});
  }, []);

  async function runBook() {
    if (!bookId) return;
    const d = await api.post<{ tasks: number }>(`/incidents/${inc.id}/playbook`, { playbook_id: bookId });
    notify(`${d.tasks} langkah playbook dibuat sebagai tugas.`, "ok");
    reload();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/tasks", { incident_id: inc.id, title, assignee, due_at: due ? new Date(due).toISOString() : "" });
    setTitle("");
    notify("Tugas ditambahkan.", "ok");
    reload();
  }

  return (
    <div>
      <div className="inline" style={{ marginBottom: 10 }}>
        <select className="select" style={{ maxWidth: 260 }} value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {books.map((b) => <option key={b.id} value={b.id}>{b.name} · v{b.version}</option>)}
        </select>
        <button className="btn" onClick={runBook} disabled={!bookId}>
          <Icon name="play" size={13} /> Jalankan playbook
        </button>
        <span className="faint small">Langkah playbook dibuat sebagai tugas dengan PIC.</span>
      </div>
      <form className="inline" onSubmit={add} style={{ marginBottom: 14 }}>
        <input className="input" style={{ flex: 2 }} placeholder="Tugas respons baru…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" style={{ flex: 1 }} placeholder="PIC" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <input className="input" style={{ width: 170 }} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn primary"><Icon name="plus" size={14} /> Tambah</button>
      </form>
      <table>
        <thead><tr><th>Tugas</th><th>PIC</th><th>Tenggat</th><th>Status</th></tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.title}</td>
              <td className="muted">{t.assignee}</td>
              <td className="mono small">{t.due_at ? fmt(t.due_at) : "—"}</td>
              <td>
                <select
                  className="select" style={{ width: 140, padding: "4px 8px", fontSize: 11 }} value={t.status}
                  onChange={async (e) => { await api.patch(`/tasks/${t.id}`, { status: e.target.value }); reload(); }}
                >
                  {["open", "in_progress", "done", "blocked"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <div className="empty">Belum ada tugas.</div>}
    </div>
  );
}

function Audit({ audit }: { audit: AuditEntry[] }) {
  return (
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
            <td className="hash" style={{ maxWidth: 160 }}>{a.hash.slice(0, 18)}…</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContextPanel({ inc, techniques, assets, artifacts, notify, reload }: {
  inc: Incident; techniques: Technique[]; assets: Asset[]; artifacts: ArtifactDetail[];
  notify: Notify; reload: () => void;
}) {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [form, setForm] = useState({ technique_id: "", name: "", artifact_id: "", explanation: "", confidence: "medium" });

  useEffect(() => {
    api.get<{ assets: Asset[] }>("/assets")
      .then((d) => { setAllAssets(d.assets); if (d.assets[0]) setAssetId(d.assets[0].id); })
      .catch(() => {});
  }, []);

  const artifactName = (id: string) => artifacts.find((a) => a.id === id)?.filename ?? "tanpa artefak";

  async function addTechnique(e: React.FormEvent) {
    e.preventDefault();
    if (!form.technique_id.trim()) return notify("Technique ID wajib diisi.", "error");
    await api.post(`/incidents/${inc.id}/techniques`, form);
    notify("Pemetaan ATT&CK ditambahkan.", "ok");
    setForm({ technique_id: "", name: "", artifact_id: "", explanation: "", confidence: "medium" });
    reload();
  }

  async function link() {
    if (!assetId) return;
    await api.post(`/incidents/${inc.id}/assets`, { asset_id: assetId });
    notify("Aset ditautkan.", "ok");
    reload();
  }

  return (
    <div className="grid grid-2" style={{ gap: 18 }}>
      <div>
        <div className="section-title" style={{ marginTop: 0 }}><h2>ATT&CK evidence mapping</h2><div className="line" /></div>
        <table>
          <thead><tr><th>Teknik</th><th>Bukti</th><th>Confidence</th></tr></thead>
          <tbody>
            {techniques.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="mono" style={{ color: "var(--accent)" }}>{t.technique_id}</div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="faint small">{t.explanation}</div>
                </td>
                <td className="faint small">{artifactName(t.artifact_id)}</td>
                <td><span className={"badge " + (t.confidence === "high" ? "red" : "blue")}>{t.confidence}</span></td>
              </tr>
            ))}
            {techniques.length === 0 && <tr><td colSpan={3} className="empty">Belum ada pemetaan.</td></tr>}
          </tbody>
        </table>

        <form className="card" style={{ padding: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }} onSubmit={addTechnique}>
          <div className="grid grid-2" style={{ gap: 8 }}>
            <input className="input" placeholder="T1566.002" value={form.technique_id} onChange={(e) => setForm({ ...form, technique_id: e.target.value })} />
            <input className="input" placeholder="Nama teknik" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <select className="select" value={form.artifact_id} onChange={(e) => setForm({ ...form, artifact_id: e.target.value })}>
            <option value="">Pilih artefak pendukung</option>
            {artifacts.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}
          </select>
          <input className="input" placeholder="Penjelasan analis" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          <div className="inline">
            <select className="select" style={{ width: 140 }} value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
              {["low", "medium", "high"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn primary">Tambah pemetaan</button>
          </div>
        </form>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 0 }}><h2>Aset terdampak</h2><div className="line" /></div>
        {assets.map((a) => (
          <div className="lead-card" key={a.id} style={{ marginBottom: 8 }}>
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 650 }}>{a.name}</div>
                <div className="faint small mono">{a.hostname} · {a.unit}</div>
              </div>
              <span className={"badge " + (a.criticality === "critical" ? "red" : a.criticality === "high" ? "amber" : "blue")}>
                {a.criticality}
              </span>
            </div>
            <div className="faint small" style={{ marginTop: 6 }}>{a.notes} · status {a.status}</div>
          </div>
        ))}
        {assets.length === 0 && <div className="empty">Belum ada aset tertaut.</div>}

        <div className="inline" style={{ marginTop: 10 }}>
          <select className="select" style={{ maxWidth: 260 }} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {allAssets.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.hostname}</option>)}
          </select>
          <button className="btn" onClick={link} disabled={!assetId}>Tautkan aset</button>
        </div>
      </div>
    </div>
  );
}

function AccessPanel({ requests, user, notify, reload }: {
  requests: AccessRequest[]; user: { role: string }; notify: Notify; reload: () => void;
}) {
  async function decide(id: string, status: string) {
    await api.post(`/access-requests/${id}/decide`, { status });
    notify(status === "approved" ? "Akses disetujui dan dicatat." : "Permintaan ditolak.", "ok");
    reload();
  }

  return (
    <div>
      <div className="disclaimer" style={{ marginBottom: 12 }}>
        <Icon name="lock" size={15} />
        <span>Berkas mentah lintas satuan memerlukan persetujuan koordinator. Persetujuan kedaluwarsa otomatis dalam 3 hari dan tercatat pada chain of custody.</span>
      </div>
      <table>
        <thead><tr><th>Pemohon</th><th>Izin</th><th>Alasan</th><th>Status</th><th>Kedaluwarsa</th><th style={{ textAlign: "right" }}>Aksi</th></tr></thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{r.requester}</div>
                <div className="faint small">{r.requester_unit}</div>
              </td>
              <td className="mono small">{r.scope}</td>
              <td className="faint small" style={{ maxWidth: 260 }}>{r.reason}</td>
              <td><span className={"badge " + (r.status === "approved" ? "green" : r.status === "pending" ? "amber" : "red")}>{r.status}</span></td>
              <td className="mono small">{r.expires_at ? fmt(r.expires_at) : "—"}</td>
              <td style={{ textAlign: "right" }}>
                {user.role === "coordinator" && r.status === "pending" ? (
                  <>
                    <button className="btn sm" onClick={() => decide(r.id, "rejected")}>Tolak</button>{" "}
                    <button className="btn sm primary" onClick={() => decide(r.id, "approved")}>Setujui</button>
                  </>
                ) : <span className="faint small">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {requests.length === 0 && <div className="empty">Belum ada permintaan akses.</div>}
    </div>
  );
}

function PassportPanel({ artifactId, user, onClose, notify, reload }: {
  artifactId: string; user: { role: string; unit: string }; onClose: () => void; notify: Notify; reload: () => void;
}) {
  const [p, setP] = useState<Passport | null>(null);
  const [note, setNote] = useState("");
  const [toUnit, setToUnit] = useState("Satuan Bravo");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("raw");

  const load = () =>
    api.get<Passport>(`/artifacts/${artifactId}/passport`)
      .then(setP)
      .catch((e) => notify(errorMessage(e), "error"));

  useEffect(() => { load(); }, [artifactId]);

  async function addNote() {
    if (!note.trim()) return;
    await api.post(`/artifacts/${artifactId}/custody`, { action: "note", note });
    setNote("");
    notify("Catatan custody ditambahkan.", "ok");
    load();
  }

  async function transfer() {
    await api.post(`/artifacts/${artifactId}/custody`, { action: "transfer", to_unit: toUnit, note });
    notify(`Transfer ke ${toUnit} dicatat.`, "ok");
    load();
    reload();
  }

  async function request() {
    await api.post("/access-requests", { artifact_id: artifactId, scope, reason });
    notify("Permintaan akses dikirim ke koordinator.", "ok");
    setReason("");
    load();
  }

  return (
    <div className="card fade-up">
      <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <div className="card-title">Evidence passport</div>
            <div className="card-sub mono">{p?.artifact.filename ?? "memuat…"}</div>
          </div>
          <div className="card-actions">
            <span className={"badge " + (p?.chain_ok ? "green" : "red")}>
              <Icon name={p?.chain_ok ? "check" : "x"} size={12} /> custody {p?.chain_ok ? "utuh" : "rusak"}
            </span>
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>
        </div>

        {!p ? (
          <div className="empty"><span className="spinner" /></div>
        ) : (
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <dl className="kv">
                <dt>SHA-256</dt><dd className="hash">{p.artifact.sha256}</dd>
                <dt>Ukuran</dt><dd className="mono">{p.artifact.size.toLocaleString("id-ID")} B</dd>
                <dt>TLP</dt><dd><span className="badge amber">{p.tlp.toUpperCase()}</span></dd>
                <dt>Integritas</dt>
                <dd>{p.artifact.verified ? <span className="badge green">cocok</span> : <span className="badge red">berubah</span>}</dd>
                <dt>Pemegang</dt>
                <dd>{p.custody.filter((c) => c.to_unit).slice(-1)[0]?.to_unit ?? p.artifact.uploaded_by}</dd>
              </dl>
              <div>
                <div className="small faint" style={{ marginBottom: 6 }}>Static analysis</div>
                {p.analysis ? (
                  <dl className="kv">
                    <dt>Tipe</dt><dd>{p.analysis.file_type}</dd>
                    <dt>Ekstensi</dt><dd className="mono">.{p.analysis.extension}</dd>
                    <dt>Verdict</dt>
                    <dd>
                      <span className={"badge " + (p.analysis.verdict === "malicious" ? "red" : p.analysis.verdict === "suspicious" ? "amber" : p.analysis.verdict === "low-risk" ? "blue" : "green")}>
                        {p.analysis.verdict}
                      </span>
                    </dd>
                    <dt>Mismatch</dt><dd>{p.analysis.mismatch ? <span className="badge red">ya</span> : <span className="badge green">tidak</span>}</dd>
                    <dt>Entropi</dt><dd className="mono">{p.analysis.entropy}</dd>
                    <dt>Makro</dt><dd>{p.analysis.macro ? <span className="badge red">terdeteksi</span> : "tidak"}</dd>
                  </dl>
                ) : <div className="faint small">Belum dianalisis.</div>}
                {p.analysis && p.analysis.rules.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="small faint" style={{ marginBottom: 4 }}>Aturan cocok</div>
                    <div className="chip-row">
                      {p.analysis.rules.map((r) => (
                        <span className="chip" key={r.rule} title={r.description}>
                          {r.rule} · {r.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.analysis && p.analysis.explanations.length > 0 && (
                  <ul className="small muted" style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    {p.analysis.explanations.map((x) => (
                      <li key={x} style={{ marginBottom: 2 }}>{x}</li>
                    ))}
                  </ul>
                )}
                {p.analysis && (p.analysis.embedded_urls.length > 0 || p.analysis.suspicious_strings.length > 0) && (
                  <div className="chip-row" style={{ marginTop: 8 }}>
                    {p.analysis.embedded_urls.slice(0, 3).map((u) => <span className="chip" key={u}>{u}</span>)}
                    {p.analysis.suspicious_strings.slice(0, 4).map((s) => <span className="chip" key={s}>{s}</span>)}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="section-title" style={{ marginTop: 0 }}><h2>Chain of custody</h2><div className="line" /></div>
              <div className="timeline">
                {p.custody.map((c) => (
                  <div key={c.id} className="tl-item kind-report">
                    <div className="tl-time">{fmt(c.ts)} · {c.actor}</div>
                    <div className="tl-title">{c.action.replace(/_/g, " ")}{c.to_unit ? ` → ${c.to_unit}` : ""}</div>
                    <div className="tl-detail">{c.note}</div>
                    <div className="faint small mono">{c.hash.slice(0, 24)}…</div>
                  </div>
                ))}
              </div>
              {p.broken_seq && <div className="badge red">Rantai custody rusak pada {p.broken_seq}</div>}
            </div>

            {p.artifact.restricted && (
              <div>
                <div className="section-title" style={{ marginTop: 0 }}><h2>Minta akses</h2><div className="line" /></div>
                <div className="inline">
                  <select className="select" style={{ width: 150 }} value={scope} onChange={(e) => setScope(e.target.value)}>
                    {["metadata", "indicators", "raw"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input className="input" style={{ flex: 1 }} placeholder="Alasan permintaan" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="btn primary" onClick={request}>Kirim permintaan</button>
                </div>
              </div>
            )}

            <div>
              <div className="section-title" style={{ marginTop: 0 }}><h2>Catat penanganan</h2><div className="line" /></div>
              <div className="inline">
                <input className="input" style={{ flex: 2 }} placeholder="Catatan custody (mis. diverifikasi ulang)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn" onClick={addNote} disabled={!note.trim()}>Tambah catatan</button>
                <input className="input" style={{ width: 150 }} value={toUnit} onChange={(e) => setToUnit(e.target.value)} />
                <button className="btn" onClick={transfer}>Transfer</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
