import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, type ApiError } from "../api";
import { EmptyState, ErrorState, Icon, LoadingBlock, useFocusTrap } from "../ui";
import type { Incident, Notify, PageProps, User } from "../types";

const sevTone: Record<string, string> = { critical: "red", high: "orange", medium: "gold", low: "blue" };
const statusTone: Record<string, string> = {
  open: "amber",
  investigating: "blue",
  contained: "green",
  closed: "neutral",
};
const statusLabel: Record<string, string> = {
  open: "Terbuka",
  investigating: "Investigasi",
  contained: "Terkendali",
  closed: "Ditutup",
};

function fmt(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreClass(n: number) {
  return n >= 70 ? "hot" : n >= 45 ? "warm" : "cool";
}

export default function Incidents({ user, goto, notify }: PageProps) {
  const [rows, setRows] = useState<Incident[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("");
  const [showNew, setShowNew] = useState(false);

  function load() {
    setRows(null);
    setError(null);
    api
      .get<{ incidents: Incident[] }>("/incidents")
      .then((d) => setRows(d.incidents))
      .catch((e: ApiError) => {
        setError(e);
        notify(errorMessage(e), "error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const hay = (r.code + " " + r.title + " " + r.unit + " " + r.category).toLowerCase();
      return (!q || hay.includes(q.toLowerCase())) && (!sev || r.severity.toLowerCase() === sev);
    });
  }, [rows, q, sev]);

  if (error) return <ErrorState status={error.status} message={error.message} onRetry={load} />;
  if (!rows) return <LoadingBlock label="Memuat daftar laporan" rows={8} />;

  const hasFilter = Boolean(q || sev);

  return (
    <div>
      <div className="page-bar">
        <div className="page-lede">
          {rows.length} laporan dari seluruh satuan. Setiap laporan membawa indikator dengan asal-usulnya
          dan terhubung ke rantai audit.
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={15} /> Laporan baru
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kode, judul, satuan, kategori"
              aria-label="Cari laporan"
            />
            {q && (
              <button
                className="btn ghost sm"
                style={{ padding: "2px 4px" }}
                onClick={() => setQ("")}
                aria-label="Hapus pencarian"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
          <select className="select" value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Filter severity">
            <option value="">Semua severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {hasFilter && (
            <button className="btn ghost sm" onClick={() => { setQ(""); setSev(""); }}>
              Reset
            </button>
          )}
          <span className="result-count">{filtered.length} tampil</span>
        </div>

        {rows.length === 0 ? (
          <div className="card-body">
            <EmptyState
              index="REGISTER KOSONG"
              title="Belum ada laporan insiden"
              action={
                <button className="btn primary" onClick={() => setShowNew(true)}>
                  <Icon name="plus" size={14} /> Buat laporan pertama
                </button>
              }
            >
              Laporan yang dibuat oleh satuan akan muncul di register ini dan langsung dibandingkan
              indikatornya dengan laporan lain.
            </EmptyState>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body">
            <EmptyState
              index="TIDAK ADA HASIL"
              title="Tidak ada laporan yang cocok"
              action={
                <button className="btn" onClick={() => { setQ(""); setSev(""); }}>
                  Hapus filter
                </button>
              }
            >
              Tidak ada kode, judul, satuan, atau kategori yang sesuai dengan pencarian dan filter severity saat ini.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="desk-only table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Judul</th>
                    <th>Satuan</th>
                    <th>Kategori</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Indikator</th>
                    <th style={{ textAlign: "right" }}>Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => goto("incident", r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goto("incident", r.id);
                        }
                      }}
                      aria-label={`Buka ${r.code}: ${r.title}`}
                    >
                      <td className="mono nowrap">{r.code}</td>
                      <td>
                        <div className="incident-title">{r.title}</div>
                        <div className="incident-summary truncate" title={r.summary}>{r.summary}</div>
                      </td>
                      <td className="muted nowrap">{r.unit}</td>
                      <td className="small muted">{r.category}</td>
                      <td><span className={"badge " + (sevTone[r.severity] ?? "neutral")}>{r.severity}</span></td>
                      <td><span className={"badge " + (statusTone[r.status] ?? "neutral")}>{statusLabel[r.status] ?? r.status}</span></td>
                      <td className="mono" style={{ textAlign: "right" }}>{r.indicator_count}</td>
                      <td style={{ textAlign: "right" }}>
                        {r.max_score > 0 ? (
                          <span className={"score-cell " + scoreClass(r.max_score)}>{Math.round(r.max_score)}</span>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="incident-cards">
              {filtered.map((r) => (
                <button key={r.id} className="incident-mobile" onClick={() => goto("incident", r.id)}>
                  <div className="im-head">
                    <span className="mono small">{r.code}</span>
                    <span className={"badge " + (sevTone[r.severity] ?? "neutral")}>{r.severity}</span>
                    <span className={"badge " + (statusTone[r.status] ?? "neutral")}>{statusLabel[r.status] ?? r.status}</span>
                    <span className="right mono faint small">
                      {r.max_score > 0 ? "skor " + Math.round(r.max_score) : "tanpa korelasi"}
                    </span>
                  </div>
                  <div className="im-title">{r.title}</div>
                  <div className="im-meta">
                    <span>{r.unit}</span>
                    <span>{r.category}</span>
                    <span>{fmt(r.occurred_at)}</span>
                    <span>{r.indicator_count} indikator</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {showNew && (
        <NewIncident
          user={user}
          onClose={() => setShowNew(false)}
          onSaved={(id: string) => {
            setShowNew(false);
            goto("incident", id);
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

type NewIncidentProps = {
  user: User;
  onClose: () => void;
  onSaved: (id: string) => void;
  notify: Notify;
};

function NewIncident({ user, onClose, onSaved, notify }: NewIncidentProps) {
  const [form, setForm] = useState({
    title: "",
    category: "Phishing",
    severity: "high",
    unit: user.unit,
    reporter: user.name,
    occurred_at: new Date().toISOString().slice(0, 16),
    summary: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [timeError, setTimeError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, () => { if (!busy) onClose(); }, "#inc-title");

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let invalid = false;
    if (!form.title.trim()) {
      setTitleError("Judul insiden wajib diisi.");
      invalid = true;
    } else {
      setTitleError("");
    }
    const when = new Date(form.occurred_at);
    if (!form.occurred_at || isNaN(when.getTime())) {
      setTimeError("Waktu kejadian tidak valid.");
      invalid = true;
    } else {
      setTimeError("");
    }
    if (invalid) return;

    setBusy(true);
    try {
      const d = await api.post<{ incident: Incident; leads: unknown[] }>("/incidents", {
        ...form,
        occurred_at: when.toISOString(),
      });
      notify(
        "Laporan dibuat. " + (d.leads?.length ? d.leads.length + " temuan korelasi langsung muncul." : "Belum ada korelasi."),
        "ok"
      );
      onSaved(d.incident.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-incident-title"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <div>
            <div className="card-title" id="new-incident-title">Laporan insiden baru</div>
            <div className="card-sub">
              Setelah disimpan, indikator langsung dibandingkan dengan laporan lain.
            </div>
          </div>
          <div className="card-actions">
            <button className="btn ghost sm" onClick={onClose} disabled={busy} aria-label="Tutup">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
        <form className="card-body" onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {error && (
            <div className="login-error" role="alert">
              <span className="mono-tag">SERVER</span>
              <span>{error}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="inc-title">Judul insiden</label>
            <input
              id="inc-title"
              className="input"
              value={form.title}
              onChange={(e) => { set("title")(e); if (titleError) setTitleError(""); }}
              placeholder="Contoh: Phishing faktur pengadaan"
              aria-invalid={Boolean(titleError)}
            />
            {titleError && <span className="login-error" style={{ padding: "4px 7px" }}>{titleError}</span>}
          </div>

          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="inc-category">Kategori</label>
              <select id="inc-category" className="select" value={form.category} onChange={set("category")}>
                {["Phishing", "Malware", "DDoS", "Account Compromise", "Data Breach", "Defacement"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inc-severity">Severity</label>
              <select id="inc-severity" className="select" value={form.severity} onChange={set("severity")}>
                {["critical", "high", "medium", "low"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inc-unit">Satuan</label>
              <input id="inc-unit" className="input" value={form.unit} onChange={set("unit")} />
            </div>
            <div className="field">
              <label htmlFor="inc-time">Waktu kejadian</label>
              <input
                id="inc-time"
                className="input"
                type="datetime-local"
                value={form.occurred_at}
                onChange={(e) => { set("occurred_at")(e); if (timeError) setTimeError(""); }}
                aria-invalid={Boolean(timeError)}
              />
              {timeError && <span className="login-error" style={{ padding: "4px 7px" }}>{timeError}</span>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="inc-reporter">Pelapor</label>
            <input id="inc-reporter" className="input" value={form.reporter} onChange={set("reporter")} />
          </div>
          <div className="field">
            <label htmlFor="inc-summary">Uraian</label>
            <textarea
              id="inc-summary"
              className="textarea"
              value={form.summary}
              onChange={set("summary")}
              placeholder="Ringkasan kejadian, layanan terdampak, temuan awal"
            />
            <span className="field-hint">{form.summary.length} karakter. Uraian panjang tetap tersimpan utuh.</span>
          </div>

          <div className="inline" style={{ justifyContent: "flex-end", marginTop: 2 }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Batal</button>
            <button className="btn primary" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="plus" size={14} />} Simpan laporan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
