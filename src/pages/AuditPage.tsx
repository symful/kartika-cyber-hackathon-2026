import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { Icon } from "../ui";
import type {
  AuditEntry, AuditVerifyResponse, Checkpoint, CheckpointVerification, Notify, User, VerifyResult,
} from "../types";

type PubKey = { algorithm: string; public_key: string; fingerprint: string };
type CheckpointsResponse = { checkpoints: Checkpoint[]; verification: CheckpointVerification };
type TamperResult = { before: string; after: string };
type AuditList = { entries: AuditEntry[] };

export default function AuditPage({ user, notify }: { user: User; notify: Notify }) {
  const [chain, setChain] = useState<VerifyResult | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointsResponse | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pub, setPub] = useState<PubKey | null>(null);
  const [seq, setSeq] = useState("12");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TamperResult | null>(null);

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

  useEffect(() => { refresh().catch((e) => notify(errorMessage(e), "error")); }, []);

  async function verify() {
    setBusy(true);
    try {
      await refresh();
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

  if (!chain) {
    return <div className="loading-screen"><span className="spinner" /><div className="small">Memeriksa rantai…</div></div>;
  }

  return (
    <div className="fade-up">
      <div className="inline" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Integritas bukti</div>
          <div className="muted small">Rantai audit hash-linked dan checkpoint tanda tangan Ed25519.</div>
        </div>
        <div className="inline">
          <button className="btn" onClick={checkpoint} disabled={busy}><Icon name="fingerprint" size={15} /> Buat checkpoint</button>
          <button className="btn primary" onClick={verify} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="shield" size={15} />} Verifikasi rantai
          </button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card stat" style={{ gridColumn: "span 2" }}>
          <div className="stat-label">Status rantai</div>
          <div className="inline" style={{ gap: 12, marginTop: 8 }}>
            <span className={"badge " + (chain.ok ? "green" : "red")} style={{ fontSize: 13, padding: "6px 12px" }}>
              <Icon name={chain.ok ? "check" : "x"} size={14} />
              {chain.ok ? "TERVERIFIKASI" : "RANTAI RUSAK"}
            </span>
            <span className="muted small">{chain.checked} entri diperiksa</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="small faint">Kepala rantai</div>
            <div className="hash" style={{ marginTop: 4 }}>{chain.head}</div>
          </div>
          {chain.broken_seq ? (
            <div className="badge red" style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8 }}>
              Kerusakan pertama terdeteksi pada entri #{chain.broken_seq}
            </div>
          ) : null}
          {chain.issues?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {chain.issues.map((i: string, n: number) => (
                <div key={n} className="small" style={{ color: "var(--red)", fontFamily: "var(--mono)", marginTop: 4 }}>{i}</div>
              ))}
            </div>
          )}
          <div className="disclaimer" style={{ marginTop: 14 }}>
            <Icon name="alert" size={15} />
            <span>
              Rantai mendeteksi perubahan isi catatan. Ia tidak membuktikan keaslian berkas sebelum diunggah.
              Manifest SHA-256 diekspor bersama laporan untuk verifikasi di luar sistem.
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><div className="card-title">Checkpoint</div><div className="card-sub">Tanda tangan perangkat</div></div></div>
          <div className="card-body">
            <div className={"badge " + (checkpoints?.verification?.ok ? "green" : "red")}>
              {checkpoints?.verification?.ok ? "Tanda tangan valid" : "Tanda tangan gagal"}
            </div>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Jumlah</dt><dd>{checkpoints?.checkpoints?.length ?? 0}</dd>
              <dt>Algoritma</dt><dd>Ed25519</dd>
              <dt>Fingerprint</dt><dd className="mono small">{pub?.fingerprint}</dd>
            </dl>
            <div className="small faint" style={{ marginTop: 10, wordBreak: "break-all" }}>{pub?.public_key}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><div><div className="card-title">Uji manipulasi</div><div className="card-sub">Hanya koordinator</div></div></div>
          <div className="card-body">
            <p className="muted small" style={{ marginTop: 0 }}>
              Mengubah satu entri langsung di database, melewati penulis audit. Ini memperagakan bahwa perubahan
              sekecil apa pun akan terdeteksi saat verifikasi.
            </p>
            <div className="inline">
              <input className="input" style={{ width: 120 }} value={seq} onChange={(e) => setSeq(e.target.value)} />
              <button className="btn danger" onClick={tamper} disabled={busy || user.role !== "coordinator"}>Ubah entri</button>
              <button className="btn" onClick={restore} disabled={busy || user.role !== "coordinator"}>Pulihkan</button>
            </div>
            {user.role !== "coordinator" && <div className="faint small" style={{ marginTop: 8 }}>Masuk sebagai koordinator untuk mencoba.</div>}
            {result && (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <div className="small faint">Sebelum</div>
                <div className="hash">{result.before?.slice(0, 180)}</div>
                <div className="small faint" style={{ marginTop: 8 }}>Sesudah</div>
                <div className="hash">{result.after?.slice(0, 180)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><div className="card-title">Checkpoint tersimpan</div><div className="card-sub">Setiap titik dapat diverifikasi mandiri</div></div></div>
          <table>
            <thead><tr><th>Seq</th><th>Waktu</th><th>Head</th></tr></thead>
            <tbody>
              {(checkpoints?.checkpoints ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="mono">#{c.seq}</td>
                  <td className="mono small">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                  <td className="hash" style={{ maxWidth: 180 }}>{c.head_hash.slice(0, 20)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-title"><h2>Catatan audit terbaru</h2><div className="line" /></div>
      <div className="card" style={{ overflow: "hidden" }}>
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
                <td className="hash" style={{ maxWidth: 190 }}>{e.hash.slice(0, 22)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
