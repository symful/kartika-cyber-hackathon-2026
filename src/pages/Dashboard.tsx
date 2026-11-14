import { useEffect, useState } from "react";
import { api, type ApiError } from "../api";
import { Donut, Heatmap, TrendChart } from "../charts";
import { EmptyState, ErrorState, Icon, LoadingBlock, Stamp } from "../ui";
import { reasonDetail } from "../labels";
import type { Correlation, DashboardData, Incident, PageProps } from "../types";

const sevTone: Record<string, string> = { critical: "red", high: "orange", medium: "gold", low: "blue" };
const sevLabel: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const bandTone: Record<string, string> = { strong: "red", moderate: "orange", weak: "blue", none: "neutral" };
const bandLabel: Record<string, string> = { strong: "kuat", moderate: "sedang", weak: "lemah", none: "tidak ada" };
const statusOrder = ["open", "investigating", "contained", "closed"];
const statusLabel: Record<string, string> = {
  open: "Terbuka",
  investigating: "Investigasi",
  contained: "Terkendali",
  closed: "Ditutup",
};
const severityOrder = ["critical", "high", "medium", "low"];
const severityColors: Record<string, string> = {
  critical: "#e05a55",
  high: "#e08a4a",
  medium: "#e3b23c",
  low: "#4c9ae6",
};
const severityCells: Record<string, { bg: string; fg: string; border: string }> = {
  critical: { bg: "#fdeceb", fg: "#b83232", border: "#f3c8c6" },
  high: { bg: "#fdf0e7", fg: "#a9541f", border: "#f3d6c2" },
  medium: { bg: "#fbf4dc", fg: "#7d5c0f", border: "#ecdfb3" },
  low: { bg: "#e9f2fd", fg: "#155ebd", border: "#c9dcfa" },
};

function buildTrend(incidents: Incident[]) {
  const dates = incidents
    .map((i) => new Date(i.occurred_at))
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.getTime());
  const end = new Date(dates.length ? Math.max(...dates) : Date.now());
  end.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(end);
    day.setDate(end.getDate() - (6 - index));
    const key = day.toDateString();
    const value = incidents.filter((incident) => {
      const when = new Date(incident.occurred_at);
      return !isNaN(when.getTime()) && when.toDateString() === key;
    }).length;
    return {
      label: day.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      value,
    };
  });
}

function buildMatrix(incidents: Incident[]) {
  const matrix: Record<string, Record<string, number>> = {};
  for (const severity of severityOrder) {
    matrix[severity] = Object.fromEntries(statusOrder.map((status) => [status, 0]));
  }
  for (const incident of incidents) {
    if (matrix[incident.severity] && matrix[incident.severity][incident.status] !== undefined) {
      matrix[incident.severity][incident.status] += 1;
    }
  }
  return matrix;
}

export default function Dashboard({ goto, notify }: PageProps) {
  const [d, setD] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [correlations, setCorrelations] = useState<Correlation[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  function load() {
    setError(null);
    setD(null);
    setIncidents(null);
    setCorrelations(null);
    Promise.all([
      api.get<DashboardData>("/dashboard"),
      api.get<{ incidents: Incident[] }>("/incidents"),
      api.get<{ correlations: Correlation[] }>("/correlations"),
    ])
      .then(([dashboard, incidentList, correlationList]) => {
        setD(dashboard);
        setIncidents(incidentList.incidents);
        setCorrelations(correlationList.correlations);
      })
      .catch((e: ApiError) => {
        setError(e);
        notify(e.message, "error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState status={error.status} message={error.message} onRetry={load} />;
  if (!d || !incidents || !correlations) return <LoadingBlock label="Menyusun ringkasan operasi" stats rows={8} />;

  const sev = d.by_severity;
  const statusTotal = Object.values(d.by_status).reduce((a, b) => a + b, 0);
  const sevData = severityOrder.map((key) => ({
    label: sevLabel[key],
    value: Number(sev[key] ?? 0),
    color: severityColors[key],
  }));
  const trend = buildTrend(incidents);
  const matrix = buildMatrix(incidents);
  const trendTotal = trend.reduce((sum, point) => sum + point.value, 0);
  const peak = trend.reduce((best, point) => (point.value > best.value ? point : best), trend[0]);
  const bands = { strong: 0, moderate: 0, weak: 0, none: 0 };
  for (const correlation of correlations) {
    if (correlation.band in bands) bands[correlation.band as keyof typeof bands] += 1;
    else bands.none += 1;
  }
  const bandData = [
    { label: "Kuat", value: bands.strong, color: "#e05a55" },
    { label: "Sedang", value: bands.moderate, color: "#e08a4a" },
    { label: "Lemah", value: bands.weak, color: "#4c9ae6" },
    { label: "Tidak ada", value: bands.none, color: "#cfd6df" },
  ];
  const openLeads = correlations.filter((c) => c.status === "open").length;
  const decidedLeads = correlations.length - openLeads;
  const averageScore = correlations.length
    ? Math.round(correlations.reduce((sum, c) => sum + c.score, 0) / correlations.length)
    : 0;

  return (
    <div>
      <div className="disclaimer warn" style={{ marginBottom: 18 }}>
        <Icon name="alert" size={15} />
        <span style={{ flex: 1 }}>
          <b>Kampanye latihan SINYAL-01.</b> Profil dan taktik merujuk pada advisory publik CISA
          AA23-341A (Star Blizzard). Seluruh berkas dan indikator pada lingkungan ini adalah data
          sintetis.
        </span>
        <Stamp tone="amber" rotate={1}>Data sintetis</Stamp>
      </div>

      <div className="register">
        {[
          { label: "Laporan insiden", value: d.incidents, hint: `${d.units.length} satuan terlibat`, icon: "file" },
          { label: "Indikator terekstrak", value: d.indicators, hint: `${d.artifacts} berkas bukti`, icon: "layers" },
          { label: "Temuan terbuka", value: d.open_leads, hint: "skor ≥ 45, belum diputuskan", icon: "link" },
          { label: "Prioritas kritis", value: d.critical, hint: d.critical > 0 ? "perlu eskalasi" : "tidak ada eskalasi", icon: "alert" },
        ].map((s, i) => (
          <div className={"stat" + (i === 3 && d.critical > 0 ? " accent" : "")} key={s.label}>
            <div className="stat-icon">
              <Icon name={s.icon} size={18} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid dash-split" style={{ marginTop: 16 }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-head">
            <div>
              <div className="card-title">Laporan terbaru</div>
              <div className="card-sub">Diurutkan menurut waktu kejadian</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={() => goto("incidents")}>
                Semua laporan <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
          {d.recent.length === 0 ? (
            <div className="card-body">
              <EmptyState index="BELUM ADA BERKAS" title="Belum ada laporan insiden">
                Laporan pertama akan muncul di sini setelah dibuat oleh satuan.
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
                    <th>Severity</th>
                    <th style={{ textAlign: "right" }}>Indikator</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((i) => (
                    <tr
                      key={i.id}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => goto("incident", i.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goto("incident", i.id);
                        }
                      }}
                      aria-label={`Buka ${i.code}: ${i.title}`}
                    >
                      <td className="mono nowrap">{i.code}</td>
                      <td>
                        <div className="incident-title">{i.title}</div>
                        <div className="incident-summary truncate">{i.summary}</div>
                      </td>
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
            <div className="incident-cards">
              {d.recent.map((i) => (
                <button key={i.id} className="incident-mobile" onClick={() => goto("incident", i.id)}>
                  <div className="im-head">
                    <span className="mono small">{i.code}</span>
                    <span className={"badge " + (sevTone[i.severity] ?? "neutral")}>{i.severity}</span>
                    <span className="right mono faint small">
                      {i.max_score > 0 ? "skor " + Math.round(i.max_score) : i.indicator_count + " indikator"}
                    </span>
                  </div>
                  <div className="im-title">{i.title}</div>
                  <div className="im-meta">
                    <span>{i.unit}</span>
                    <span>{i.category}</span>
                  </div>
                </button>
              ))}
            </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Distribusi severity</div>
              <div className="card-sub">{d.incidents} laporan / {d.units.length} satuan</div>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Donut
              data={sevData}
              centerValue={d.incidents}
              centerLabel="laporan"
              ariaLabel={`Distribusi ${d.incidents} laporan menurut severity`}
            />

            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 12, marginTop: 2 }}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="small faint">Status penanganan</span>
                <span className="mono faint small">{statusTotal} laporan</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {statusOrder.map((k) => (
                  <div key={k} className="inline" style={{ justifyContent: "space-between", gap: 8 }}>
                    <span className="small" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span
                        className="dot"
                        style={{ background: k === "open" ? "var(--caution)" : k === "investigating" ? "var(--accent)" : k === "contained" ? "var(--verify)" : "var(--rule-2)" }}
                      />
                      {statusLabel[k]}
                    </span>
                    <span className="mono small">{d.by_status[k] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid dash-split" style={{ marginTop: 16 }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-head">
            <div>
              <div className="card-title">Tren laporan</div>
              <div className="card-sub">7 hari terakhir berdasarkan waktu kejadian</div>
            </div>
            <div className="card-actions">
              <span className="badge neutral">{trendTotal} laporan</span>
            </div>
          </div>
          <div className="card-body">
            <TrendChart data={trend} ariaLabel={`Tren laporan harian selama 7 hari, total ${trendTotal} laporan`} />
            <div className="chart-foot">
              <span>Puncak <strong>{peak.value} laporan</strong> pada {peak.label}</span>
              <span>Total 7 hari <strong>{trendTotal}</strong></span>
              <span>{incidents.length} laporan tercatat</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Sebaran band korelasi</div>
              <div className="card-sub">Semua pasangan yang dihitung sistem</div>
            </div>
          </div>
          <div className="card-body">
            {correlations.length === 0 ? (
              <EmptyState index="TANPA KORELASI" title="Belum ada pasangan">
                Band akan terisi setelah indikator dua laporan saling beririsan.
              </EmptyState>
            ) : (
              <>
                <Donut
                  data={bandData}
                  centerValue={correlations.length}
                  centerLabel="temuan"
                  ariaLabel={`Sebaran ${correlations.length} temuan korelasi menurut band`}
                />
                <div className="chart-foot">
                  <span><strong>{openLeads}</strong> terbuka</span>
                  <span><strong>{decidedLeads}</strong> diputuskan</span>
                  <span>Rata-rata skor <strong>{averageScore}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Matriks severity × status</div>
            <div className="card-sub">Jumlah laporan menurut tingkat keparahan dan status penanganan</div>
          </div>
          <div className="card-actions">
            <span className="badge neutral">{incidents.length} laporan</span>
          </div>
        </div>
        <div className="card-body">
          <Heatmap
            rows={severityOrder.map((key) => ({
              key,
              label: sevLabel[key],
              color: severityColors[key],
              ...severityCells[key],
            }))}
            columns={statusOrder.map((key) => ({ key, label: statusLabel[key] }))}
            values={matrix}
            ariaLabel="Jumlah laporan per severity dan status penanganan"
          />
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
                Buka graf <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {d.top_leads.length === 0 && (
              <EmptyState index="TANPA TEMUAN" title="Belum ada korelasi">
                Sistem akan menampilkan pasangan laporan yang berbagi indikator setelah laporan baru masuk.
              </EmptyState>
            )}
            {d.top_leads.map((l) => {
              const tone = l.score >= 70 ? "strong" : l.score >= 45 ? "moderate" : "weak";
              return (
                <div key={l.id} className={"lead-card tone-" + tone}>
                  <div className="lead-head">
                    <div className="lead-score" style={{ color: tone === "strong" ? "var(--signal)" : tone === "moderate" ? "var(--orange)" : "var(--info)" }}>
                      {Math.round(l.score)}
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div className="small" style={{ fontWeight: 600 }}>
                        {l.a?.code ?? l.a_id} <span className="faint">↔</span> {l.b?.code ?? l.b_id}
                      </div>
                      <div className="faint small truncate" style={{ maxWidth: "46ch" }} title={l.reasons?.[0]?.detail}>
                        {l.reasons?.[0] ? reasonDetail(l.reasons[0].detail) : "Indikator bersama"}
                      </div>
                    </div>
                    <span className={"badge " + (bandTone[l.band] ?? "neutral")}>{bandLabel[l.band] ?? l.band}</span>
                    <button className="btn sm" onClick={() => goto("incident", l.a_id)} aria-label={`Buka ${l.a?.code ?? l.a_id}`}>
                      Buka <Icon name="arrow" size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                Periksa <Icon name="arrow" size={13} />
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
              <dd>D1 lokal / tanpa koneksi keluar</dd>
            </dl>
            <div className="disclaimer lock" style={{ marginTop: 14 }}>
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
