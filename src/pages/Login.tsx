import { useState } from "react";
import { api, errorMessage } from "../api";
import { Icon, Stamp } from "../ui";
import type { LoginResponse, User } from "../types";

const demo = [
  { user: "alpha", pass: "kartika2026", label: "Letda A. Pratama", unit: "Satuan Alpha", role: "Analis" },
  { user: "bravo", pass: "kartika2026", label: "Serma B. Nugraha", unit: "Satuan Bravo", role: "Analis" },
  { user: "koordinator", pass: "kartika2026", label: "Kolonel K. Hartono", unit: "Pusat Koordinasi", role: "Koordinator" },
];

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("alpha");
  const [password, setPassword] = useState("kartika2026");
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(user: string, pass: string, source: string) {
    setBusy(source);
    setError("");
    setErrorStatus(undefined);
    try {
      const d = await api.post<LoginResponse>("/login", { username: user, password: pass });
      onLogin(d.user);
    } catch (err) {
      setError(errorMessage(err) || "Gagal masuk. Periksa nama pengguna dan kata sandi.");
      setErrorStatus((err as { status?: number }).status);
    } finally {
      setBusy(null);
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError("Nama pengguna dan kata sandi wajib diisi.");
      setErrorStatus(undefined);
      return;
    }
    signIn(username.trim(), password, "form");
  }

  return (
    <div className="login">
      <header className="login-cover">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="chain" size={18} />
          </div>
          <div>
            <div className="brand-name">RANTAI</div>
            <div className="brand-sub">Berkas bukti &amp; koordinasi insiden</div>
          </div>
        </div>
        <div className="login-cover-meta">
          <span>Kartika Cyber Hackathon 2026</span>
          <span className="sep">/</span>
          <span className="hide-sm">Kategori Penangkalan</span>
          <span className="sep hide-sm">/</span>
          <span>D1 lokal / offline</span>
        </div>
      </header>

      <div className="login-body">
        <section className="login-hero" aria-labelledby="login-headline">
          <h1 id="login-headline">
            Bukti tetap di satuannya.
            <br />
            Temuannya bertemu di sini.
          </h1>
          <p className="lede">
            RANTAI mencocokkan indikator antar laporan, menjaga setiap hash dan asal-usulnya, lalu
            mencatat setiap tindakan pada <b>rantai audit hash-linked</b> yang bisa diperiksa ulang.
          </p>

          <div
            className="chain-figure"
            role="img"
            aria-label="Contoh korelasi: laporan Satuan Alpha dan Satuan Bravo berbagi hash berkas yang sama, menghasilkan temuan berskor 100."
          >
            <div className="chain-figure-head">
              <span>Manifest korelasi / SINYAL-01</span>
              <span>Contoh alur</span>
            </div>
            <div className="chain-rows">
              <div className="chain-row">
                <span className="chain-node" />
                <span className="chain-unit">Alpha</span>
                <span className="chain-file">faktur-pengadaan.eml</span>
                <span className="chain-hash">9f2c…a17d</span>
              </div>
              <div className="chain-row">
                <span className="chain-node" />
                <span className="chain-unit">Bravo</span>
                <span className="chain-file">koneksi-keluar.log</span>
                <span className="chain-hash">9f2c…a17d</span>
              </div>
              <div className="chain-row">
                <span className="chain-node" />
                <span className="chain-unit">Pusat</span>
                <span className="chain-file">laporan-002.json</span>
                <span className="chain-hash">3 indikator</span>
              </div>
            </div>
            <div className="chain-result">
              <div className="chain-score">100</div>
              <div>
                <div className="label">Hash lampiran sama</div>
                <div className="pair">INC-2026-001 ↔ INC-2026-002</div>
              </div>
              <span className="stamp green stamp-verified r1">Terverifikasi</span>
            </div>
          </div>

          <div className="login-hero-foot">
            <Stamp tone="amber" rotate={2}>Data sintetis</Stamp>
            <p>
              Lingkungan pelatihan. Profil kampanye merujuk pada advisory publik CISA AA23-341A
              (Star Blizzard); bukan insiden TNI AD yang sebenarnya.
            </p>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-box">
            <h2 id="login-title">Masuk ke ruang kerja</h2>
            <p className="sub">Gunakan akun satuan Anda. Setiap tindakan tercatat pada rantai audit.</p>

            <form onSubmit={submit} className="login-form" noValidate>
              <div className="field">
                <label htmlFor="username">Nama pengguna</label>
                <input
                  id="username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy !== null}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Kata sandi</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy !== null}
                />
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <span className="mono-tag">{errorStatus ? `HTTP ${errorStatus}` : "GAGAL"}</span>
                  <span>
                    {error}
                    {errorStatus === 429 && (
                      <span style={{ display: "block", marginTop: 3 }}>
                        Tunggu lima menit sebelum mencoba lagi. Batas ini juga berlaku per alamat IP.
                      </span>
                    )}
                  </span>
                </div>
              )}

              <button className="btn primary lg block" type="submit" disabled={busy !== null}>
                {busy === "form" ? <span className="spinner" /> : <Icon name="arrow" size={15} />}
                {busy === "form" ? "Memeriksa sesi" : "Masuk"}
              </button>
            </form>

            <div className="login-divider">Akun demo</div>
            <div className="demo-users">
              {demo.map((d) => (
                <button
                  key={d.user}
                  type="button"
                  className="demo-user"
                  disabled={busy !== null}
                  onClick={() => {
                    setUsername(d.user);
                    setPassword(d.pass);
                    signIn(d.user, d.pass, d.user);
                  }}
                >
                  <div className="avatar">{d.label.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{d.label}</div>
                    <div className="meta">
                      {d.unit} / {d.role}
                    </div>
                  </div>
                  <span className="user-tag">
                    {busy === d.user ? <span className="spinner" /> : d.user}
                  </span>
                </button>
              ))}
            </div>
            <p className="faint small" style={{ marginTop: 12 }}>
              Kata sandi demo: <span className="mono">kartika2026</span>
            </p>

            <div className="login-synthetic">
              <Stamp tone="amber" rotate={2}>Data sintetis</Stamp>
              <span>Lingkungan pelatihan. Bukan insiden TNI AD yang sebenarnya.</span>
            </div>

            <div className="login-meta">
              <span>RANTAI v1.0</span>
              <span>Sesi 8 jam / cookie HttpOnly</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
