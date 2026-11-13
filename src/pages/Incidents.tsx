import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../api";
import { Icon } from "../ui";
import type { Incident, Notify, PageProps, User } from "../types";

const sevTone: Record<string, string> = { critical: "red", high: "amber", medium: "blue", low: "neutral" };
const statusTone: Record<string, string> = {
  open: "amber", investigating: "blue", contained: "green", closed: "neutral",
};

export default function Incidents({ user, goto, notify }: PageProps) {
  const [rows, setRows] = useState<Incident[] | null>(null);
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = () =>
    api.get<{ incidents: Incident[] }>("/incidents")
      .then((d) => setRows(d.incidents))
      .catch((e) => notify(errorMessage(e), "error"));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const hay = (r.code + " " + r.title + " " + r.unit + " " + r.category).toLowerCase();
      return (!q || hay.includes(q.toLowerCase())) && (!sev || r.severity === sev);
    });
  }, [rows, q, sev]);

  return (
    <div className="fade-up">
      <div className="inline" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Laporan insiden</div>
          <div className="muted small">{rows?.length ?? 0} laporan dari seluruh satuan</div>
        </div>
        <button className="btn primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={16} /> Laporan baru
        </button>
      </div>

      <div className="card">
        <div className="card-head" style={{ gap: 10 }}>
          <div className="input" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 340, padding: "7px 11px" }}>
            <Icon name="search" size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kode, judul, satuan…"
              style={{ background: "none", border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
            />
          </div>
          <select className="select" style={{ width: 150 }} value={sev} onChange={(e) => setSev(e.target.value)}>
            <option value="">Semua severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="card-actions">
            <span className="badge neutral">{filtered.length} tampil</span>
          </div>
        </div>

        {!rows ? (
          <div className="empty"><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty">Tidak ada laporan yang cocok.</div>
        ) : (
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
                <tr key={r.id} className="clickable" onClick={() => goto("incident", r.id)}>
                  <td className="mono nowrap">{r.code}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="faint small truncate" style={{ maxWidth: 380 }}>{r.summary}</div>
                  </td>
                  <td className="muted nowrap">{r.unit}</td>
                  <td className="small muted">{r.category}</td>
                  <td><span className={"badge " + (sevTone[r.severity] ?? "neutral")}>{r.severity}</span></td>
                  <td><span className={"badge " + (statusTone[r.status] ?? "neutral")}>{r.status}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.indicator_count}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.max_score > 0 ? (
                      <span className={"badge " + (r.max_score >= 70 ? "red" : r.max_score >= 45 ? "amber" : "blue")}>
                        {Math.round(r.max_score)}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewIncident user={user} onClose={() => setShowNew(false)} onSaved={(id: string) => { setShowNew(false); goto("incident", id); }} notify={notify} />}
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

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return notify("Judul wajib diisi.", "error");
    setBusy(true);
    try {
      const d = await api.post<{ incident: Incident; leads: unknown[] }>("/incidents", {
        ...form,
        occurred_at: new Date(form.occurred_at).toISOString(),
      });
      notify("Laporan dibuat. " + (d.leads?.length ? d.leads.length + " temuan korelasi langsung muncul." : "Belum ada korelasi."), "ok");
      onSaved(d.incident.id);
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <div className="card-title">Laporan insiden baru</div>
            <div className="card-sub">Setelah disimpan, sistem langsung membandingkan indikator dengan laporan lain.</div>
          </div>
          <div className="card-actions">
            <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>
        </div>
        <form className="card-body" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Judul insiden</label>
            <input className="input" value={form.title} onChange={set("title")} placeholder="Contoh: Phishing faktur pengadaan" />
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Kategori</label>
              <select className="select" value={form.category} onChange={set("category")}>
                {["Phishing", "Malware", "DDoS", "Account Compromise", "Data Breach", "Defacement"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Severity</label>
              <select className="select" value={form.severity} onChange={set("severity")}>
                {["critical", "high", "medium", "low"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Satuan</label>
              <input className="input" value={form.unit} onChange={set("unit")} />
            </div>
            <div className="field">
              <label>Waktu kejadian</label>
              <input className="input" type="datetime-local" value={form.occurred_at} onChange={set("occurred_at")} />
            </div>
          </div>
          <div className="field">
            <label>Pelapor</label>
            <input className="input" value={form.reporter} onChange={set("reporter")} />
          </div>
          <div className="field">
            <label>Uraian</label>
            <textarea className="textarea" value={form.summary} onChange={set("summary")} placeholder="Ringkasan kejadian, layanan terdampak, temuan awal…" />
          </div>
          <div className="inline" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
            <button className="btn primary" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="plus" size={15} />} Simpan laporan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
