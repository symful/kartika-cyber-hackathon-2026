import { useEffect, useState } from "react";
import { api, download, errorMessage, type ApiError } from "../api";
import { EmptyState, ErrorState, Icon, LoadingBlock, Stamp } from "../ui";
import type {
  AuditEntry,
  AuditVerifyResponse,
  Checkpoint,
  CheckpointVerification,
  Notify,
  User,
  VerifyResult,
} from "../types";

type PubKey = { algorithm: string; public_key: string; fingerprint: string };
type CheckpointsResponse = { checkpoints: Checkpoint[]; verification: CheckpointVerification };
type TamperResult = { before: string; after: string };
type AuditList = { entries: AuditEntry[] };
type RotateResult = { public_key: string; secret_once: string; note: string };

export default function AuditPage({ user, notify }: { user: User; notify: Notify }) {
  const [chain, setChain] = useState<VerifyResult | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointsResponse | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pub, setPub] = useState<PubKey | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [seq, setSeq] = useState("12");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TamperResult | null>(null);
  const [rotated, setRotated] = useState<RotateResult | null>(null);

  async function refresh() {
    const [v, cp, a, k] = await Promise.all([
      api.get<AuditVerifyResponse>("/audit/verify"),
      api.get<CheckpointsResponse>("/checkpoints"),
      api.get<AuditList>("/audit?limit=60"),
      api.get<PubKey>("/pubkey"),
    ]);
    setChain(v.chain);
    setCheckpoints(cp);
    setEntries(a.entries);
    setPub(k);
  }

  function load() {
    setError(null);
    setChain(null);
    refresh().catch((e: ApiError) => {
      setError(e);
      notify(errorMessage(e), "error");
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function verify() {
    setBusy(true);
    try {
      await refresh();
      setError(null);
      notify("Verifikasi selesai.", "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function tamper() {
    setBusy(true);
    try {
      const r = await api.post<TamperResult>("/dev/tamper", { seq: Number(seq) });
      setResult(r);
      notify(`Entri #${seq} diubah langsung di database. Jalankan verifikasi.`, "error");
      await refresh();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await api.post("/dev/restore", { seq: Number(seq) });
      setResult(null);
      notify("Entri dipulihkan. Verifikasi ulang untuk melihat rantai kembali utuh.", "ok");
      await refresh();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function checkpoint() {
    setBusy(true);
    try {
      await api.post("/checkpoints");
      await refresh();
      notify("Checkpoint Ed25519 dibuat dan ditandatangani.", "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportCheckpoints() {
    setBusy(true);
    try {
      const data = await api.get<unknown>("/checkpoints/export");
      download(`rantai-checkpoints-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
      notify("Checkpoint, kunci publik, dan status rantai diekspor.", "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!window.confirm("Rotasi kunci tanda tangan? Secret baru hanya ditampilkan sekali.")) return;
    setBusy(true);
    try {
      const d = await api.post<RotateResult>("/checkpoints/rotate", { confirm: "ROTATE" });
      setRotated(d);
      await refresh();
      notify("Kunci ditandatangani ulang. Simpan secret sekali-tampil sekarang.", "ok");
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState status={error.status} message={error.message} onRetry={load} />;
  if (!chain || !checkpoints) return <LoadingBlock label="Memeriksa rantai audit" rows={8} />;

  const isCoordinator = user.role === "coordinator";

  return (
    <div>
      <div className="page-bar">
        <div className="page-lede">
          Rantai audit hash-linked dan checkpoint tanda tangan Ed25519. Verifikasi membandingkan isi
          setiap entri dan memeriksa apakah kepala rantai masih cocok dengan checkpoint terakhir.
        </div>
        <div className="actions">
          <button className="btn" onClick={checkpoint} disabled={busy}>
            <Icon name="fingerprint" size={14} /> Buat checkpoint
          </button>
          <button className="btn primary" onClick={verify} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="shield" size={14} />} Verifikasi rantai
          </button>
        </div>
      </div>

      <div className="grid dash-split">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Status rantai</div>
              <div className="card-sub">Pemeriksaan hash berantai dari entri pertama</div>
            </div>
            <div className="card-actions">
              <span className={"badge " + (checkpoints.verification.ok ? "green" : "red")}>
                {checkpoints.verification.ok ? "checkpoint valid" : "checkpoint gagal"}
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="inline" style={{ gap: 12, alignItems: "center" }}>
              <Stamp tone={chain.ok ? "green" : "signal"} large rotate={chain.ok ? 1 : 2}>
                <Icon name={chain.ok ? "check" : "x"} size={13} />
                {chain.ok ? "Terverifikasi" : "Rantai rusak"}
              </Stamp>
              <span className="muted small">{chain.checked} entri diperiksa</span>
              <span className="faint small">/</span>
              <span className="faint small">{checkpoints.checkpoints.length} checkpoint</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="inline" style={{ justifyContent: "space-between", gap: 8 }}>
                <span className="small faint">Kepala rantai</span>
                <span className="mono faint small">{chain.verified_at ? "diperiksa " + new Date(chain.verified_at).toLocaleTimeString("id-ID") : ""}</span>
              </div>
              <div
                className="hash"
                style={{ marginTop: 5, padding: "8px 10px", border: "1px solid var(--rule)", background: "var(--paper-3)" }}
              >
                {chain.head}
              </div>
            </div>

            {!chain.ok && chain.broken_seq ? (
              <div className="login-error" style={{ marginTop: 12, display: "block" }}>
                <span className="mono-tag">RUSAK</span> Kerusakan pertama terdeteksi pada entri #{chain.broken_seq}.
              </div>
            ) : null}

            {chain.issues?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {chain.issues.map((i: string, n: number) => (
                  <div key={n} className="mono small" style={{ color: "var(--signal)", marginTop: 4, wordBreak: "break-word" }}>{i}</div>
                ))}
              </div>
            )}

            <div className="disclaimer" style={{ marginTop: 14 }}>
              <Icon name="alert" size={15} />
              <span>
                Rantai mendeteksi perubahan isi catatan, tetapi tidak membuktikan keaslian berkas sebelum
                diunggah. Manifest SHA-256 diekspor bersama laporan untuk verifikasi di luar sistem.
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Checkpoint &amp; kunci</div>
              <div className="card-sub">Tanda tangan perangkat Ed25519</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={exportCheckpoints} disabled={busy || !isCoordinator} title={!isCoordinator ? "Hanya koordinator" : "Ekspor checkpoint, kunci publik, dan status rantai"}>
                <Icon name="download" size={12} /> Ekspor
              </button>
            </div>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Jumlah</dt><dd>{checkpoints.checkpoints.length} checkpoint</dd>
              <dt>Algoritma</dt><dd>Ed25519</dd>
              <dt>Fingerprint</dt><dd className="mono small" style={{ wordBreak: "break-all" }}>{pub?.fingerprint ?? "—"}</dd>
            </dl>
            <div className="small faint key-text" style={{ marginTop: 8 }}>{pub?.public_key}</div>

            <div style={{ borderTop: "1px solid var(--rule)", marginTop: 12, paddingTop: 10 }}>
              <button
                className="btn sm"
                onClick={rotate}
                disabled={busy || !isCoordinator}
                title={!isCoordinator ? "Hanya koordinator" : "Rotasi kunci tanda tangan"}
              >
                <Icon name="key" size={12} /> Rotasi kunci
              </button>
              <div className="faint small" style={{ marginTop: 5 }}>
                Maksimum tiga kali per jam. Secret hanya tampil sekali.
              </div>
            </div>
          </div>
        </div>
      </div>

      {rotated && (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--signal)" }}>
          <div className="card-head">
            <div>
              <div className="card-title">Secret kunci baru — tampil sekali</div>
              <div className="card-sub">Simpan sebagai secret RANTAI_SIGNING_KEY sebelum menutup panel ini</div>
            </div>
            <div className="card-actions">
              <button className="btn sm" onClick={() => {
                navigator.clipboard?.writeText(rotated.secret_once).then(
                  () => notify("Secret disalin ke papan klip.", "ok"),
                  () => notify("Papan klip tidak tersedia.", "error")
                );
              }}>
                <Icon name="copy" size={12} /> Salin
              </button>
              <button className="btn sm" onClick={() => download("rantai-signing-key.txt", rotated.secret_once, "text/plain")}>
                <Icon name="download" size={12} /> Unduh
              </button>
              <button className="btn ghost sm" onClick={() => setRotated(null)} aria-label="Tutup panel secret">
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="login-error" style={{ display: "block", marginBottom: 10 }}>
              <span className="mono-tag">PERHATIAN</span> Nilai ini tidak akan ditampilkan lagi dan tidak
              disimpan pada respons berikutnya. Jangan menaruhnya di bundle frontend atau repositori.
            </div>
            <textarea className="textarea mono" readOnly value={rotated.secret_once} rows={3} style={{ fontSize: 10.5 }} />
            <div className="faint small" style={{ marginTop: 6 }}>Kunci publik baru: <span className="mono">{rotated.public_key}</span></div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Uji manipulasi</div>
              <div className="card-sub">Hanya koordinator / lingkungan demo</div>
            </div>
          </div>
          <div className="card-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              Mengubah satu entri langsung di database, melewati penulis audit. Perubahan sekecil apa pun
              akan terdeteksi saat verifikasi.
            </p>
            <div className="inline">
              <label className="sr-only" htmlFor="tamper-seq">Nomor entri</label>
              <input id="tamper-seq" className="input mono" style={{ width: 110 }} value={seq} onChange={(e) => setSeq(e.target.value)} disabled={!isCoordinator} />
              <button className="btn danger" onClick={tamper} disabled={busy || !isCoordinator}>Ubah entri</button>
              <button className="btn" onClick={restore} disabled={busy || !isCoordinator}>Pulihkan</button>
            </div>
            {!isCoordinator && <div className="faint small" style={{ marginTop: 8 }}>Masuk sebagai koordinator untuk mencoba uji manipulasi.</div>}
            {result && (
              <div className="card" style={{ marginTop: 12, padding: 12, boxShadow: "none", background: "var(--paper-3)" }}>
                <div className="small faint">Sebelum</div>
                <div className="hash">{result.before?.slice(0, 220)}</div>
                <div className="small faint" style={{ marginTop: 8 }}>Sesudah</div>
                <div className="hash">{result.after?.slice(0, 220)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Checkpoint tersimpan</div>
              <div className="card-sub">Setiap titik dapat diverifikasi mandiri</div>
            </div>
          </div>
          {checkpoints.checkpoints.length === 0 ? (
            <div className="card-body">
              <EmptyState index="TANPA CHECKPOINT" title="Belum ada checkpoint">
                Buat checkpoint agar kepala rantai terikat pada tanda tangan perangkat.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Seq</th><th>Waktu</th><th>Head</th></tr></thead>
                <tbody>
                  {checkpoints.checkpoints.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">#{c.seq}</td>
                      <td className="mono small">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                      <td className="hash" style={{ maxWidth: 180 }} title={c.head_hash}>{c.head_hash.slice(0, 20)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section-title">
        <h2>Catatan audit terbaru</h2>
        <span className="hint">{entries.length} entri</span>
      </div>
      {entries.length === 0 ? (
        <EmptyState index="AUDIT KOSONG" title="Belum ada catatan audit">
          Entri akan muncul setiap kali ada mutasi pada insiden, bukti, atau konfigurasi.
        </EmptyState>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-wrap wide">
            <table>
              <thead><tr><th>Seq</th><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Objek</th><th>Hash</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.seq} className="audit-row">
                    <td className="mono">#{e.seq}</td>
                    <td className="mono small nowrap">{new Date(e.ts).toLocaleString("id-ID")}</td>
                    <td>{e.actor}</td>
                    <td className="mono small">{e.action}</td>
                    <td className="mono small">{e.object_type}/{e.object_id.slice(0, 12)}…</td>
                    <td className="hash" style={{ maxWidth: 190 }} title={e.hash}>{e.hash.slice(0, 22)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
