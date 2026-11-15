import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT } from "./theme";

/**
 * Recreated product surfaces, drawn as animation instead of screenshots.
 *
 * Reasons this replaces the screenshot scenes:
 *  - screenshots have inconsistent aspect ratios (0.76 to 1.60), so a fixed
 *    frame either squeezed or blew them up
 *  - a still image cannot show the product doing anything
 *  - they carried real text at unreadable sizes once scaled
 *
 * Every surface here is drawn at exactly 16:9 inside a shared window chrome, so
 * pacing, framing and typography stay identical between scenes.
 */

export const WINDOW_W = 1520;
export const WINDOW_H = 700;

const Chrome: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => (
  <div
    style={{
      width: WINDOW_W,
      height: WINDOW_H,
      borderRadius: 12,
      overflow: "hidden",
      background: "#fff",
      border: `1px solid ${BRAND.rule}`,
      boxShadow: "0 40px 88px -26px rgba(18,26,38,0.42), 0 8px 22px -8px rgba(18,26,38,0.18)",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 40,
        background: "#eef2f7",
        borderBottom: `1px solid ${BRAND.rule}`,
        display: "flex",
        alignItems: "center",
        padding: "0 15px",
        gap: 8,
        flex: "none",
      }}
    >
      {["#e0655f", "#e0b14e", "#5fb87a"].map((c) => (
        <div key={c} style={{ width: 10, height: 10, borderRadius: 99, background: c }} />
      ))}
      <div
        style={{
          marginLeft: 12,
          flex: 1,
          height: 21,
          borderRadius: 5,
          background: "#fff",
          border: `1px solid ${BRAND.rule}`,
          display: "flex",
          alignItems: "center",
          padding: "0 9px",
          fontFamily: FONT.mono,
          fontSize: 10.5,
          color: BRAND.faint,
        }}
      >
        rantai.careday17.workers.dev{url}
      </div>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>{children}</div>
  </div>
);

const Sidebar: React.FC<{ active: string; entered: number }> = ({ active, entered }) => {
  const items = ["Ringkasan", "Insiden", "Korelasi", "Integritas", "Ekspor"];
  return (
    <div
      style={{
        width: 196,
        background: BRAND.navy,
        padding: "18px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: "none",
        opacity: entered,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, paddingLeft: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: BRAND.accent }} />
        <div style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.12em" }}>
          RANTAI
        </div>
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 7.5, color: "#7d90ad", letterSpacing: "0.12em", paddingLeft: 8, marginBottom: 6 }}>
        OPERASI
      </div>
      {items.map((it) => (
        <div
          key={it}
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            fontFamily: FONT.sans,
            fontSize: 11.5,
            color: it === active ? "#fff" : "#aab6c5",
            background: it === active ? "rgba(79,140,255,0.18)" : "transparent",
            borderLeft: it === active ? `2px solid ${BRAND.accent}` : "2px solid transparent",
          }}
        >
          {it}
        </div>
      ))}
    </div>
  );
};

const Title: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{children}</div>
    {sub && (
      <div style={{ fontFamily: FONT.sans, fontSize: 10.5, color: BRAND.muted, marginTop: 3 }}>{sub}</div>
    )}
  </div>
);

/* ---------------------------------------------------------- dashboard surface */

export const DashboardSurface: React.FC<{ t: number }> = ({ t }) => {
  const metrics = [
    { n: 4, label: "Laporan insiden", sub: "2 satuan terlibat", color: BRAND.accent },
    { n: 23, label: "Indikator terekstrak", sub: "6 berkas bukti", color: BRAND.verify },
    { n: 2, label: "Temuan terbuka", sub: "skor ≥ 45", color: BRAND.orange },
    { n: 1, label: "Prioritas kritis", sub: "perlu eskalasi", color: BRAND.signal },
  ];
  const sev = [
    { l: "Critical", v: 1, c: BRAND.signal },
    { l: "High", v: 2, c: BRAND.orange },
    { l: "Medium", v: 1, c: BRAND.gold },
    { l: "Low", v: 0, c: BRAND.accent },
  ];
  const trend = [0, 0, 0, 2, 1, 0, 1];

  return (
    <Chrome url="/dashboard">
      <Sidebar active="Ringkasan" entered={1} />
      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, background: BRAND.paper }}>
        <Title sub="Kampanye latihan SINYAL-01 · seluruh data sintetis">Ringkasan operasi</Title>

        <div style={{ display: "flex", gap: 12 }}>
          {metrics.map((m, i) => {
            const r = interpolate(t, [0.05 + i * 0.06, 0.2 + i * 0.06], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={m.label}
                style={{
                  flex: 1,
                  border: `1px solid ${BRAND.rule}`,
                  borderLeft: `3px solid ${m.color}`,
                  borderRadius: 3,
                  padding: "10px 12px",
                  opacity: r,
                  transform: `translateY(${(1 - r) * 12}px)`,
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 600, color: m.color }}>
                  {Math.round(m.n * r)}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: 9.5, color: BRAND.ink, marginTop: 3 }}>{m.label}</div>
                <div style={{ fontFamily: FONT.sans, fontSize: 8.5, color: BRAND.muted, marginTop: 2 }}>{m.sub}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1.6, border: `1px solid ${BRAND.rule}`, borderRadius: 3, padding: 12, display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 10, fontWeight: 700, color: BRAND.ink, marginBottom: 10 }}>
              Laporan terbaru
            </div>
            {[
              ["INC-2026-004", "Banjir lalu lintas", "DDoS", "Critical", BRAND.signal],
              ["INC-2026-003", "Percobaan kredensial", "Account", "Medium", BRAND.gold],
              ["INC-2026-002", "Koneksi keluar", "Malware", "High", BRAND.orange],
              ["INC-2026-001", "Phishing faktur", "Phishing", "High", BRAND.orange],
            ].map(([code, title, cat, sevLabel, col], i) => {
              const r = interpolate(t, [0.22 + i * 0.05, 0.34 + i * 0.05], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div
                  key={code as string}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: i < 3 ? `1px solid ${BRAND.rule}` : undefined,
                    opacity: r,
                    transform: `translateX(${(1 - r) * 10}px)`,
                  }}
                >
                  <div style={{ fontFamily: FONT.mono, fontSize: 8, color: BRAND.accent, width: 74 }}>{code}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 9, color: BRAND.ink, flex: 1 }}>{title}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 8, color: BRAND.muted, width: 48 }}>{cat}</div>
                  <div
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 7.5,
                      fontWeight: 600,
                      color: col as string,
                      border: `1px solid ${col as string}`,
                      borderRadius: 2,
                      padding: "1px 5px",
                    }}
                  >
                    {sevLabel}
                  </div>
                </div>
              );
            })}

            <div style={{ fontFamily: FONT.sans, fontSize: 10, fontWeight: 700, color: BRAND.ink, margin: "14px 0 8px" }}>
              Tren laporan
            </div>
            <svg width="100%" height="120" viewBox="0 0 420 120" preserveAspectRatio="none" style={{ display: "block" }}>
              {[0, 1, 2, 3].map((g) => (
                <line key={g} x1="0" y1={12 + g * 32} x2="420" y2={12 + g * 32} stroke={BRAND.rule} strokeDasharray="3 4" />
              ))}
              <polyline
                points={trend
                  .map((v, i) => `${i * 70},${104 - v * 38}`)
                  .join(" ")}
                fill="none"
                stroke={BRAND.accent}
                strokeWidth="2"
                strokeDasharray="900"
                strokeDashoffset={900 - 900 * interpolate(t, [0.3, 0.62], [0, 1], { extrapolateRight: "clamp" })}
              />
              {trend.map((v, i) => {
                const r = interpolate(t, [0.3 + i * 0.03, 0.36 + i * 0.03], [0, 1], { extrapolateRight: "clamp" });
                return <circle key={i} cx={i * 70} cy={104 - v * 38} r={3 * r} fill="#fff" stroke={BRAND.accent} strokeWidth="2" />;
              })}
            </svg>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: `1px solid ${BRAND.rule}`, borderRadius: 3, padding: 12 }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 10, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>
                Distribusi severity
              </div>
              <svg width="100%" height="104" viewBox="0 0 140 104">
                {sev.map((s, i) => {
                  const total = sev.reduce((a, b) => a + b.v, 0) || 1;
                  const frac = s.v / total;
                  const start = sev.slice(0, i).reduce((a, b) => a + b.v, 0) / total;
                  const grow = interpolate(t, [0.16 + i * 0.04, 0.4 + i * 0.04], [0, 1], { extrapolateRight: "clamp" });
                  const C = 2 * Math.PI * 42;
                  return (
                    <circle
                      key={s.l}
                      cx="60"
                      cy="52"
                      r="42"
                      fill="none"
                      stroke={s.c}
                      strokeWidth="13"
                      strokeDasharray={`${C * frac * grow} ${C}`}
                      strokeDashoffset={-C * start}
                      transform="rotate(-90 60 52)"
                      opacity={frac === 0 ? 0 : 1}
                    />
                  );
                })}
                <text x="60" y="50" textAnchor="middle" fontFamily={FONT.mono} fontSize="20" fontWeight="600" fill={BRAND.ink}>
                  {Math.round(4 * interpolate(t, [0.16, 0.42], [0, 1], { extrapolateRight: "clamp" }))}
                </text>
                <text x="60" y="64" textAnchor="middle" fontFamily={FONT.sans} fontSize="8" fill={BRAND.muted}>
                  LAPORAN
                </text>
              </svg>
            </div>

            <div style={{ border: `1px solid ${BRAND.rule}`, borderRadius: 3, padding: 12, flex: 1 }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 10, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>
                Sebaran band korelasi
              </div>
              {[
                ["Kuat", 1, BRAND.accent],
                ["Sedang", 1, BRAND.orange],
                ["Lemah", 1, BRAND.gold],
              ].map(([l, v, c], i) => {
                const r = interpolate(t, [0.4 + i * 0.05, 0.55 + i * 0.05], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, opacity: r }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: c as string }} />
                    <div style={{ fontFamily: FONT.sans, fontSize: 9, color: BRAND.ink2, flex: 1 }}>{l}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9, color: BRAND.ink }}>{v as number}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
};

/* ---------------------------------------------------------- evidence surface */

export const EvidenceSurface: React.FC<{ t: number }> = ({ t }) => {
  const files = [
    { n: "laporan_phishing.eml", s: "24 KB", h: "9f2c…a17d", st: "Cocok", c: BRAND.verify },
    { n: "Faktur_Pengadaan_2026.zip", s: "182 KB", h: "9893…a780", st: "Cocok", c: BRAND.verify },
    { n: "proxy_dns_bravo.csv", s: "41 KB", h: "1b7e…09cc", st: "Cocok", c: BRAND.verify },
    { n: "catatan_analis.txt", s: "3 KB", h: "aa41…7f02", st: "Duplikat", c: BRAND.gold },
  ];

  return (
    <Chrome url="/incidents/INC-2026-001/evidence">
      <Sidebar active="Insiden" entered={1} />
      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, background: BRAND.paper }}>
        <Title sub="INC-2026-001 · Phishing faktur pengadaan · Satuan Alpha">Bukti &amp; integritas</Title>

        <div
          style={{
            border: `2px dashed ${t > 0.06 && t < 0.3 ? BRAND.accent : BRAND.rule2}`,
            background: t > 0.06 && t < 0.3 ? BRAND.accentWash : BRAND.sunk,
            borderRadius: 4,
            padding: "16px 0",
            textAlign: "center",
            transition: "none",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={BRAND.accent} strokeWidth="1.8" style={{ marginBottom: 4 }}>
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          <div style={{ fontFamily: FONT.sans, fontSize: 10.5, color: BRAND.ink2 }}>
            Lepas berkas di sini · maksimum 900 KB per berkas
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 8, color: BRAND.faint, marginTop: 3 }}>
            .eml .csv .log .txt .zip
          </div>
        </div>

        {/* upload progress bar that fills as the narration describes it */}
        <div style={{ opacity: t > 0.08 ? 1 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 9, color: BRAND.muted }}>Mengunggah 4 berkas…</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9, color: BRAND.accent }}>
              {Math.round(interpolate(t, [0.08, 0.3], [0, 100], { extrapolateRight: "clamp" }))}%
            </div>
          </div>
          <div style={{ height: 5, background: BRAND.sunk, borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${interpolate(t, [0.08, 0.3], [0, 100], { extrapolateRight: "clamp" })}%`,
                background: BRAND.accent,
              }}
            />
          </div>
        </div>

        <div style={{ border: `1px solid ${BRAND.rule}`, borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              padding: "7px 12px",
              background: BRAND.sunk,
              fontFamily: FONT.mono,
              fontSize: 7.5,
              color: BRAND.muted,
              letterSpacing: "0.06em",
            }}
          >
            <div style={{ flex: 2.4 }}>BERKAS</div>
            <div style={{ width: 60 }}>UKURAN</div>
            <div style={{ flex: 1.6 }}>SHA-256</div>
            <div style={{ width: 74 }}>STATUS</div>
          </div>
          {files.map((f, i) => {
            const r = interpolate(t, [0.3 + i * 0.09, 0.42 + i * 0.09], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={f.n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderTop: i ? `1px solid ${BRAND.rule}` : undefined,
                  opacity: r,
                  transform: `translateY(${(1 - r) * 8}px)`,
                }}
              >
                <div style={{ flex: 2.4, display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 13, height: 16, borderRadius: 2, background: BRAND.accentWash, border: `1px solid ${BRAND.accent}` }} />
                  <div style={{ fontFamily: FONT.mono, fontSize: 9, color: BRAND.ink }}>{f.n}</div>
                </div>
                <div style={{ width: 60, fontFamily: FONT.sans, fontSize: 8.5, color: BRAND.muted }}>{f.s}</div>
                <div style={{ flex: 1.6, fontFamily: FONT.mono, fontSize: 8.5, color: BRAND.ink2 }}>{f.h}</div>
                <div style={{ width: 74 }}>
                  <span
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 7.5,
                      fontWeight: 600,
                      color: f.c,
                      border: `1px solid ${f.c}`,
                      borderRadius: 2,
                      padding: "1px 5px",
                    }}
                  >
                    {f.st}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            opacity: interpolate(t, [0.66, 0.8], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {[
            ["Hash diterima", "9f2c…a17d"],
            ["Diverifikasi ulang", "9f2c…a17d"],
            ["Verdict statis", "suspicious"],
          ].map(([k, v], i) => {
            const r = interpolate(t, [0.66 + i * 0.06, 0.74 + i * 0.06], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={k}
                style={{
                  flex: 1,
                  border: `1px solid ${BRAND.rule}`,
                  borderRadius: 3,
                  padding: "8px 10px",
                  opacity: r,
                  transform: `translateY(${(1 - r) * 8}px)`,
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 7.5, color: BRAND.muted, letterSpacing: "0.05em" }}>
                  {k.toUpperCase()}
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: i === 2 ? BRAND.orange : BRAND.ink, marginTop: 3 }}>
                  {v}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Chrome>
  );
};

/* ---------------------------------------------------------- login surface */

export const LoginSurface: React.FC<{ t: number }> = ({ t }) => {
  const accounts = [
    ["LA", "Letda A. Pratama", "Satuan Alpha", "alpha"],
    ["SB", "Serma B. Nugraha", "Satuan Bravo", "bravo"],
    ["KK", "Kolonel K. Hartono", "Pusat Koordinasi", "koordinator"],
  ];
  const typed = Math.max(0, Math.round(interpolate(t, [0.28, 0.44], [0, 5], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })));
  const pw = Math.max(0, Math.round(interpolate(t, [0.46, 0.6], [0, 11], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })));
  const press = interpolate(t, [0.66, 0.7, 0.78], [1, 0.96, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <Chrome url="/login">
      <div style={{ flex: 1, display: "flex" }}>
        <div style={{ flex: 1.1, padding: "34px 32px", display: "flex", flexDirection: "column", justifyContent: "center", background: "#fff" }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1.14, letterSpacing: "-0.02em" }}>
            Bukti tetap di satuannya.
            <br />
            Temuannya bertemu di sini.
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 11, color: BRAND.muted, marginTop: 12, lineHeight: 1.6, maxWidth: 300 }}>
            RANTAI mencocokkan indikator antar laporan, menjaga setiap hash dan asal-usulnya, lalu mencatat setiap tindakan
            pada rantai audit hash-linked.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
            {["SHA-256 manifest", "audit hash-linked", "Ed25519", "STIX 2.1", "blinded"].map((c) => (
              <div
                key={c}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 7.5,
                  color: BRAND.ink2,
                  border: `1px solid ${BRAND.rule2}`,
                  borderRadius: 3,
                  padding: "3px 6px",
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: "30px 32px", borderLeft: `1px solid ${BRAND.rule}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: BRAND.ink }}>Masuk ke ruang kerja</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 9.5, color: BRAND.muted, marginTop: 4 }}>
            Gunakan akun satuan Anda.
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 8.5, color: BRAND.ink2, marginBottom: 4 }}>Nama pengguna</div>
            <div
              style={{
                border: `1px solid ${BRAND.rule2}`,
                borderRadius: 3,
                padding: "7px 9px",
                fontFamily: FONT.mono,
                fontSize: 10.5,
                color: BRAND.ink,
                minHeight: 30,
              }}
            >
              {"alpha".slice(0, typed)}
              <span style={{ opacity: typed < 5 ? 1 : 0 }}>|</span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 8.5, color: BRAND.ink2, marginBottom: 4 }}>Kata sandi</div>
            <div style={{ border: `1px solid ${BRAND.rule2}`, borderRadius: 3, padding: "7px 9px", minHeight: 30, fontFamily: FONT.mono, fontSize: 11, color: BRAND.ink2 }}>
              {"•".repeat(pw)}
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              background: BRAND.accent,
              borderRadius: 3,
              padding: "9px 0",
              textAlign: "center",
              fontFamily: FONT.sans,
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              transform: `scale(${press})`,
            }}
          >
            → Masuk
          </div>

          <div style={{ marginTop: 16, fontFamily: FONT.mono, fontSize: 7.5, color: BRAND.faint, letterSpacing: "0.06em" }}>
            AKUN DEMO
          </div>
          {accounts.map(([ini, name, unit, user], i) => {
            const r = interpolate(t, [0.08 + i * 0.06, 0.18 + i * 0.06], [0, 1], { extrapolateRight: "clamp" });
            const chosen = user === "alpha" && t > 0.26;
            return (
              <div
                key={user}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  marginTop: 5,
                  border: `1px solid ${chosen ? BRAND.accent : BRAND.rule}`,
                  background: chosen ? BRAND.accentWash : "#fff",
                  borderRadius: 3,
                  opacity: r,
                  transform: `translateX(${(1 - r) * 10}px)`,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: BRAND.accentWash,
                    border: `1px solid ${BRAND.accent}`,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: FONT.mono,
                    fontSize: 7.5,
                    fontWeight: 600,
                    color: BRAND.accent,
                  }}
                >
                  {ini}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.sans, fontSize: 9, fontWeight: 600, color: BRAND.ink }}>{name}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 7.5, color: BRAND.muted }}>{unit}</div>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 7,
                    color: BRAND.muted,
                    border: `1px solid ${BRAND.rule2}`,
                    borderRadius: 2,
                    padding: "1px 4px",
                  }}
                >
                  {user}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Chrome>
  );
};

/* ---------------------------------------------------------- wrapper */

export const SurfaceScene: React.FC<{
  kind: "login" | "dashboard" | "evidence";
  title: string;
  caption: string;
}> = ({ kind, title, caption }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.85 } });
  const titleIn = interpolate(t, [0, 0.08], [0, 1], { extrapolateRight: "clamp" });
  const capIn = interpolate(t, [0.6, 0.75], [0, 1], { extrapolateRight: "clamp" });
  const zoom = 1 + t * 0.03;

  // Fit the window between the title and the caption so there is no dead space.
  const TOP = 96;
  const BOTTOM = 108;
  const availH = 1080 - TOP - BOTTOM;
  const fit = Math.min(1, availH / WINDOW_H);

  return (
    <AbsoluteFill style={{ position: "absolute", inset: 0, background: BRAND.paper, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(62% 58% at ${20 + t * 60}% ${26 + t * 44}%, ${BRAND.accent}14 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 46,
          fontFamily: FONT.sans,
          fontSize: 34,
          fontWeight: 800,
          color: BRAND.ink,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 12}px)`,
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: TOP,
          transform: `translateX(-50%) scale(${(0.94 + enter * 0.06) * zoom * fit})`,
          transformOrigin: "50% 0%",
          opacity: Math.min(1, enter * 1.5),
        }}
      >
        {kind === "login" && <LoginSurface t={t} />}
        {kind === "dashboard" && <DashboardSurface t={t} />}
        {kind === "evidence" && <EvidenceSurface t={t} />}
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 40,
          fontFamily: FONT.sans,
          fontSize: 19,
          color: BRAND.muted,
          opacity: capIn,
          transform: `translateY(${(1 - capIn) * 10}px)`,
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
};
