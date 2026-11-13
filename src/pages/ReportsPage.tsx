import { useEffect, useRef, useState } from "react";
import { api, download, errorMessage } from "../api";
import { Icon } from "../ui";
import type { BundleExport, Incident, Notify } from "../types";

type PubKey = { algorithm: string; public_key: string; fingerprint: string };

export default function ReportsPage({ notify }: { notify: Notify }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [id, setId] = useState("");
  const [pub, setPub] = useState<PubKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ incidents: Incident[] }>("/incidents").then((d) => {
      setIncidents(d.incidents);
      if (d.incidents[0]) setId(d.incidents[0].id);
    });
    api.get<PubKey>("/pubkey").then(setPub).catch(() => {});
  }, []);

  const selected = incidents.find((i) => i.id === id);

  async function exportBundle() {
    try {
      const d = await api.post<BundleExport>("/export/bundle");
      download(`rantai-bundle-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2));
      notify(`Bundle berisi ${d.bundle.indicators.length} indikator ditandatangani dan diunduh.`, "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }

  async function importBundle(file: File) {
    try {
      const text = await file.text();
      const d = await api.post<{ code: string; imported: number; leads: number }>("/import/bundle", JSON.parse(text));
      notify(`Bundle diimpor sebagai ${d.code} (${d.imported} indikator, ${d.leads} korelasi).`, "ok");
      const list = await api.get<{ incidents: Incident[] }>("/incidents");
      setIncidents(list.incidents);
    } catch (e) {
      notify("Impor gagal: " + errorMessage(e), "error");
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Ekspor & laporan</div>
        <div className="muted small">Keluaran untuk dewan juri, atasan, atau arsip satuan.</div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><div><div className="card-title">Laporan forensik</div><div className="card-sub">Manifest, kronologi, korelasi, dan audit</div></div></div>
          <div className="card-body">
            <div className="field">
              <label>Pilih insiden</label>
              <select className="select" value={id} onChange={(e) => setId(e.target.value)}>
                {incidents.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}
              </select>
            </div>
            {selected && (
              <div className="chip-row" style={{ marginTop: 12 }}>
                <span className="chip"><span className="k">satuan</span> {selected.unit}</span>
                <span className="chip"><span className="k">berkas</span> {selected.artifact_count}</span>
                <span className="chip"><span className="k">indikator</span> {selected.indicator_count}</span>
                <span className="chip"><span className="k">korelasi</span> {selected.lead_count}</span>
              </div>
            )}
            <div className="inline" style={{ marginTop: 16 }}>
              <button className="btn primary" onClick={() => window.open(`/api/report/${id}?format=html`, "_blank")} disabled={!id}>
                <Icon name="file" size={15} /> Buka & cetak PDF
              </button>
              <button className="btn" onClick={async () => {
                const md = await fetch(`/api/report/${id}?format=md`, { credentials: "include" }).then((r) => r.text());
                download(`laporan-${selected?.code ?? "rantai"}.md`, md, "text/markdown");
              }} disabled={!id}>
                <Icon name="download" size={15} /> Markdown
              </button>
              <button className="btn" onClick={async () => {
                const j = await fetch(`/api/report/${id}?format=json`, { credentials: "include" }).then((r) => r.json());
                download(`laporan-${selected?.code ?? "rantai"}.json`, JSON.stringify(j, null, 2));
              }} disabled={!id}>
                <Icon name="download" size={15} /> JSON
              </button>
            </div>
            <div className="disclaimer" style={{ marginTop: 14 }}>
              <Icon name="alert" size={15} />
              <span>Gunakan dialog cetak peramban untuk menyimpan sebagai PDF. Dokumen menyertakan pernyataan bahwa korelasi bukan bukti atribusi.</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><div className="card-title">Interoperabilitas</div><div className="card-sub">STIX 2.1 dan bundle offline bertanda tangan</div></div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a className="btn" href="/api/export/stix"><Icon name="globe" size={15} /> Unduh bundel STIX 2.1</a>
            <button className="btn" onClick={exportBundle}><Icon name="layers" size={15} /> Ekspor bundle satuan</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Impor bundle dari satuan lain</button>
            <input
              ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importBundle(f); e.target.value = ""; }}
            />
            <div className="small faint" style={{ marginTop: 4 }}>
              Bundle ditandatangani Ed25519 dan hanya memuat indikator yang dibagikan. Cocok untuk satuan yang tidak terhubung internet.
            </div>
            {pub && (
              <div className="card" style={{ padding: 12, marginTop: 6 }}>
                <div className="small faint">Kunci publik perangkat</div>
                <div className="hash" style={{ marginTop: 4 }}>{pub.public_key}</div>
                <div className="faint small mono" style={{ marginTop: 4 }}>fingerprint {pub.fingerprint}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section-title"><h2>Ringkasan keluaran</h2><div className="line" /></div>
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
