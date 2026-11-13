import { useState } from "react";
import { api, errorMessage } from "../api";
import { Icon } from "../ui";
import type { LoginResponse, User } from "../types";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("alpha");
  const [password, setPassword] = useState("kartika2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api.post<LoginResponse>("/login", { username, password });
      onLogin(d.user);
    } catch (err) {
      setError(errorMessage(err) || "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  const demo = [
    { user: "alpha", label: "Letda A. Pratama", unit: "Satuan Alpha", role: "Analis" },
    { user: "bravo", label: "Serma B. Nugraha", unit: "Satuan Bravo", role: "Analis" },
    { user: "koordinator", label: "Kolonel K. Hartono", unit: "Pusat Koordinasi", role: "Koordinator" },
  ];

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="shield" size={19} />
          </div>
          <div>
            <div className="brand-name">RANTAI</div>
            <div className="brand-sub">Incident Evidence · Coordination</div>
          </div>
        </div>

        <div>
          <h1 className="login-title">
            Satu laporan.<br />
            Bukti yang <em>terverifikasi</em>.<br />
            Satu gambaran bersama.
          </h1>
          <div className="login-points">
            <div className="login-point">
              <Icon name="fingerprint" size={16} />
              <span>Setiap berkas bukti memiliki SHA-256 dan manifest Merkle.</span>
            </div>
            <div className="login-point">
              <Icon name="link" size={16} />
              <span>Indikator yang sama menghubungkan laporan dari satuan berbeda.</span>
            </div>
            <div className="login-point">
              <Icon name="lock" size={16} />
              <span>Bukti mentah tetap di satuan. Hanya indikator yang disetujui dibagikan.</span>
            </div>
            <div className="login-point">
              <Icon name="activity" size={16} />
              <span>Rantai audit hash-linked dengan checkpoint Ed25519.</span>
            </div>
          </div>
        </div>

        <div className="disclaimer">
          <Icon name="alert" size={16} />
          <span>
            Data pelatihan sintetis. Profil kampanye merujuk pada advisory publik CISA AA23-341A.
            Bukan insiden TNI AD yang sebenarnya.
          </span>
        </div>
      </div>

      <div className="login-form">
        <div className="login-box">
          <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: "-0.02em" }}>Masuk ke ruang kerja</h2>
          <p className="muted small" style={{ margin: "0 0 22px" }}>
            Gunakan akun satuan Anda. Setiap tindakan tercatat pada rantai audit.
          </p>

          <form onSubmit={submit} className="field" style={{ gap: 14 }}>
            <div className="field">
              <label>Nama pengguna</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label>Kata sandi</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="badge red" style={{ padding: "8px 10px", borderRadius: 8 }}>
                {error}
              </div>
            )}
            <button className="btn primary" style={{ padding: "10px 16px" }} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="arrow" size={16} />}
              Masuk
            </button>
          </form>

          <div className="section-title" style={{ margin: "26px 0 10px" }}>
            <h2>Akun demo</h2>
            <div className="line" />
          </div>
          <div className="demo-users">
            {demo.map((d) => (
              <button
                key={d.user}
                className="demo-user"
                onClick={() => {
                  setUsername(d.user);
                  setPassword("kartika2026");
                  setTimeout(() => submit(), 0);
                }}
              >
                <div className="avatar">{d.label.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.label}</div>
                  <div className="faint small">{d.unit} · {d.role}</div>
                </div>
                <span className="badge neutral mono">{d.user}</span>
              </button>
            ))}
          </div>
          <p className="faint small" style={{ marginTop: 14 }}>
            Kata sandi demo: <span className="mono">kartika2026</span>
          </p>
        </div>
      </div>
    </div>
  );
}
