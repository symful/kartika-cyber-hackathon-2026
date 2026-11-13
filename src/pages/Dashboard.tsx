import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";
import type { DashboardData, PageProps } from "../types";

const sevTone: Record<string, string> = {
  critical: "red", high: "amber", medium: "blue", low: "neutral",
};
const bandTone: Record<string, string> = { strong: "red", moderate: "amber", weak: "blue", none: "neutral" };

export default function Dashboard({ user, goto, notify }: PageProps) {
  const [d, setD] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setD).catch((e: Error) => notify(e.message, "error"));
  }, []);

  if (!d) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <div className="small">Menyusun ringkasan…</div>
      </div>
    );
  }

  const sev = d.by_severity;
  const totalSev = Object.values(sev).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="fade-up">
      <div className="disclaimer" style={{ marginBottom: 18 }}>
        <Icon name="alert" size={16} />
        <span>
          <b>Kampanye latihan SINYAL-01.</b> Profil dan taktik merujuk pada advisory publik CISA AA23-341A
          (Star Blizzard). Seluruh berkas dan indikator pada lingkungan ini adalah data sintetis.
        </span>
      </div>

      <div className="grid grid-4">
        {[
          { label: "Laporan insiden", value: d.incidents, hint: `${d.units.length} satuan terlibat`, icon: "file" },
          { label: "Indikator terekstrak", value: d.indicators, hint: `${d.artifacts} berkas bukti`, icon: "layers" },
          { label: "Temuan terbuka", value: d.open_leads, hint: "skor ≥ 45, belum diputuskan", icon: "link" },
          { label: "Prioritas kritis", value: d.critical, hint: "perlu eskalasi", icon: "alert" },
        ].map((s) => (
          <div className="card stat" key={s.label}>
            <div className="stat-icon">
              <Icon name={s.icon} size={20} />
            </div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-head">
            <div>
              <div className="card-title">Laporan terbaru</div>
              <div className="card-sub">Diurutkan menurut waktu kejadian</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={() => goto("incidents")}>
                Semua laporan <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Judul</th>
                <th>Satuan</th>
                <th>Severity</th>
                <th style={{ textAlign: "right" }}>Indikator</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => goto("incident", i.id)}>
                  <td className="mono nowrap">{i.code}</td>
                  <td>{i.title}</td>
                  <td className="muted nowrap">{i.unit}</td>
                  <td>
                    <span className={"badge " + (sevTone[i.severity] ?? "neutral")}>{i.severity}</span>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{i.indicator_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Distribusi severity</div>
              <div className="card-sub">{d.incidents} laporan</div>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {["critical", "high", "medium", "low"].map((k) => {
              const n = Number(sev[k] ?? 0);
              const pct = Math.round((n / totalSev) * 100);
              return (
                <div key={k}>
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="small" style={{ textTransform: "capitalize" }}>{k}</span>
                    <span className="mono muted small">{n} · {pct}%</span>
                  </div>
                  <div className={"progress " + (k === "critical" || k === "high" ? "red" : k === "medium" ? "" : "teal")} style={{ marginTop: 6 }}>
                    <span style={{ width: Math.max(pct, 2) + "%" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 4 }}>
              <div className="small faint">Status penanganan</div>
              <div className="chip-row" style={{ marginTop: 8 }}>
                {Object.entries(d.by_status).map(([k, v]) => (
                  <span className="chip" key={k}>
                    <span className="k">{k}</span> {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Temuan korelasi teratas</div>
              <div className="card-sub">Kesamaan indikator antar laporan</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={() => goto("graph")}>
                Graf <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.top_leads.length === 0 && <div className="empty">Belum ada temuan.</div>}
            {d.top_leads.map((l) => (
              <div
                key={l.id}
                className="lead-card clickable"
                onClick={() => goto("incident", l.a_id)}
              >
                <div className="lead-head">
                  <div className="lead-score" style={{ color: l.score >= 70 ? "var(--red)" : l.score >= 45 ? "var(--accent)" : "var(--blue)" }}>
                    {Math.round(l.score)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>
                      {l.a?.code ?? l.a_id} ↔ {l.b?.code ?? l.b_id}
                    </div>
                    <div className="faint small truncate">
                      {l.reasons?.[0]?.detail ?? "Indikator bersama"}
                    </div>
                  </div>
                  <span className={"badge " + (bandTone[l.band] ?? "neutral")}>{l.band}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Integritas sistem</div>
              <div className="card-sub">Rantai audit hash-linked</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={() => goto("audit")}>
                Periksa <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Panjang rantai</dt>
              <dd className="mono">{d.chain_length} entri</dd>
              <dt>Kepala rantai</dt>
              <dd className="hash">{d.chain_head || "—"}</dd>
              <dt>Checkpoint</dt>
              <dd>Ed25519, ditandatangani per perangkat</dd>
              <dt>Mode data</dt>
              <dd>Lokal · D1 · tanpa koneksi keluar</dd>
            </dl>
            <div className="disclaimer" style={{ marginTop: 14 }}>
              <Icon name="lock" size={15} />
              <span>
                Rantai membuktikan konsistensi catatan sejak dipasang. Keaslian berkas asli
                dibuktikan melalui manifest yang diekspor keluar sistem.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
