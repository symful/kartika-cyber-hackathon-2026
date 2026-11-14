import { useEffect, useRef, useState } from "react";
import { api, download, errorMessage, type ApiError } from "../api";
import { EmptyState, ErrorState, Icon, LoadingBlock, Stamp } from "../ui";
import type { BundleExport, Incident, Notify } from "../types";

type PubKey = { algorithm: string; public_key: string; fingerprint: string };

export default function ReportsPage({ notify }: { notify: Notify }) {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [id, setId] = useState("");
  const [pub, setPub] = useState<PubKey | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setError(null);
    setIncidents(null);
    api.get<{ incidents: Incident[] }>("/incidents")
      .then((d) => {
        setIncidents(d.incidents);
        setId((prev) => prev || d.incidents[0]?.id || "");
      })
      .catch((e: ApiError) => {
        setError(e);
        notify(errorMessage(e), "error");
      });
    api.get<PubKey>("/pubkey").then(setPub).catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  const selected = incidents?.find((i) => i.id === id);

  async function exportBundle() {
    setBusy(true);
    try {
      const d = await api.post<BundleExport>("/export/bundle");
      download(`rantai-bundle-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2));
      notify(`Bundle berisi ${d.bundle.indicators.length} indikator ditandatangani dan diunduh.`, "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function importBundle(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const d = await api.post<{ code: string; imported: number; leads: number }>("/import/bundle", JSON.parse(text));
      notify(`Bundle diimpor sebagai ${d.code} (${d.imported} indikator, ${d.leads} korelasi).`, "ok");
      const list = await api.get<{ incidents: Incident[] }>("/incidents");
      setIncidents(list.incidents);
    } catch (e) {
      notify("Impor gagal: " + errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function fetchReport(format: "md" | "json") {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/report/${id}?format=${format}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const body = format === "json" ? JSON.stringify(await res.json(), null, 2) : await res.text();
      const ext = format;
      download(`laporan-${selected?.code ?? "rantai"}.${ext}`, body, format === "json" ? "application/json" : "text/markdown");
      notify(`Laporan ${format.toUpperCase()} diunduh.`, "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState status={error.status} message={error.message} onRetry={load} />;
  if (!incidents) return <LoadingBlock label="Menyiapkan meja ekspor" rows={6} />;

  return (
    <div>
      <div className="page-bar">
        <div className="page-lede">
          Keluaran untuk dewan juri, atasan, atau arsip satuan. Setiap laporan membawa manifest SHA-256,
          alasan korelasi, dan hasil verifikasi rantai.
        </div>
        <div className="actions">
          <span className="mono faint small">Siap cetak / STIX 2.1 / bundle offline</span>
        </div>
      </div>

      {incidents.length === 0 ? (
        <EmptyState
          index="TANPA BERKAS"
          title="Belum ada laporan untuk diekspor"
          action={<button className="btn" onClick={load}>Muat ulang</button>}
        >
          Buat laporan insiden terlebih dahulu. Ekspor akan tersedia setelah ada berkas kasus.
        </EmptyState>
      ) : (
        <div className="grid dash-split">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Laporan forensik</div>
                <div className="card-sub">Manifest, kronologi, korelasi, dan audit</div>
              </div>
              <div className="card-actions">
                <Stamp tone="ink" rotate={1}>Siap cetak</Stamp>
              </div>
            </div>
            <div className="card-body">
              <div className="field">
                <label htmlFor="report-incident">Pilih insiden</label>
                <select id="report-incident" className="select" value={id} onChange={(e) => setId(e.target.value)}>
                  {incidents.map((i) => <option key={i.id} value={i.id}>{i.code} / {i.title}</option>)}
                </select>
              </div>

              {selected && (
                <>
                  <div className="chip-row" style={{ marginTop: 10 }}>
                    <span className="chip"><span className="k">satuan</span> {selected.unit}</span>
                    <span className="chip"><span className="k">berkas</span> {selected.artifact_count}</span>
                    <span className="chip"><span className="k">indikator</span> {selected.indicator_count}</span>
                    <span className="chip"><span className="k">korelasi</span> {selected.lead_count}</span>
                  </div>

                  <div className="section-title"><h2>Format keluaran</h2></div>
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="pivot-row">
                      <span className="mono" style={{ color: "var(--accent)", minWidth: 46 }}>HTML</span>
                      <div style={{ flex: 1 }}>
                        <div className="small" style={{ fontWeight: 600 }}>Dokumen siap cetak</div>
                        <div className="faint small">Buka di tab baru, lalu simpan sebagai PDF dari dialog cetak.</div>
                      </div>
                      <button className="btn sm" onClick={() => window.open(`/api/report/${id}?format=html`, "_blank")} disabled={!id}>
                        <Icon name="external" size={12} /> Buka
                      </button>
                    </div>
                    <div className="pivot-row">
                      <span className="mono" style={{ color: "var(--accent)", minWidth: 46 }}>MD</span>
                      <div style={{ flex: 1 }}>
                        <div className="small" style={{ fontWeight: 600 }}>Markdown</div>
                        <div className="faint small">Untuk catatan investigasi dan wiki internal.</div>
                      </div>
                      <button className="btn sm" onClick={() => fetchReport("md")} disabled={!id || busy}>
                        <Icon name="download" size={12} /> Unduh
                      </button>
                    </div>
                    <div className="pivot-row">
                      <span className="mono" style={{ color: "var(--accent)", minWidth: 46 }}>JSON</span>
                      <div style={{ flex: 1 }}>
                        <div className="small" style={{ fontWeight: 600 }}>Data terstruktur</div>
                        <div className="faint small">Objek lengkap untuk diproses ulang oleh alat lain.</div>
                      </div>
                      <button className="btn sm" onClick={() => fetchReport("json")} disabled={!id || busy}>
                        <Icon name="download" size={12} /> Unduh
                      </button>
                    </div>
                  </div>

                  <div className="disclaimer" style={{ marginTop: 14 }}>
                    <Icon name="alert" size={15} />
                    <span>
                      Gunakan dialog cetak peramban untuk menyimpan PDF. Dokumen menyertakan pernyataan
                      bahwa korelasi bukan bukti atribusi.
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Interoperabilitas</div>
                <div className="card-sub">STIX 2.1 dan bundle offline bertanda tangan</div>
              </div>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a className="btn block" href="/api/export/stix">
                <Icon name="globe" size={14} /> Unduh bundel STIX 2.1
              </a>
              <button className="btn block" onClick={exportBundle} disabled={busy}>
                <Icon name="layers" size={14} /> Ekspor bundle satuan
              </button>
              <button className="btn block" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="upload" size={14} /> Impor bundle dari satuan lain
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBundle(f);
                  e.target.value = "";
                }}
              />
              <div className="faint small" style={{ marginTop: 4 }}>
                Bundle ditandatangani Ed25519 dan hanya memuat indikator yang dibagikan. Cocok untuk
                satuan yang tidak terhubung internet.
              </div>

              {pub && (
                <div className="card" style={{ padding: 12, marginTop: 6, boxShadow: "none", background: "var(--paper-3)" }}>
                  <div className="small faint">Kunci publik perangkat</div>
                  <div className="hash" style={{ marginTop: 4 }}>{pub.public_key}</div>
                  <div className="faint small mono" style={{ marginTop: 4 }}>fingerprint {pub.fingerprint}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="section-title">
        <h2>Ringkasan keluaran</h2>
      </div>
      <div className="grid grid-3">
        {[
          { icon: "file", title: "Laporan forensik", body: "HTML siap cetak, Markdown, dan JSON. Memuat manifest SHA-256, Merkle root, kronologi, alasan korelasi, dan hasil verifikasi rantai." },
          { icon: "globe", title: "STIX 2.1", body: "Indikator dipetakan ke pola STIX (domain-name, ipv4-addr, url, email-addr, file hashes) plus objek korelasi khusus RANTAI." },
          { icon: "layers", title: "Bundle offline", body: "Tanda tangan Ed25519 memungkinkan satuan terisolasi bertukar indikator tanpa koneksi langsung dan tanpa membuka bukti mentah." },
        ].map((c) => (
          <div className="card" key={c.title} style={{ padding: 16 }}>
            <Icon name={c.icon} size={18} />
            <div style={{ fontWeight: 650, marginTop: 8 }}>{c.title}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{c.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
