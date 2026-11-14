import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, FONT, SCORES, WEIGHTS } from "./theme";
import { BrandBar, BrowserFrame, Grain, Vignette, captionStyle, useCount, useDrift } from "./ui";
import { staticFile } from "remotion";

const shell = (dark = false): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  background: dark ? BRAND.navyDeep : BRAND.paper,
  fontFamily: FONT.sans,
});

/* ---------------------------------------------------------------- 1. cold open */

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cards = [
    { u: "ALPHA", f: "faktur-pengadaan.eml", x: -470, y: -120 },
    { u: "BRAVO", f: "koneksi-keluar.log", x: 470, y: -120 },
    { u: "PUSAT", f: "laporan-002.json", x: 0, y: 170 },
  ];

  const line = spring({ frame: frame - 52, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={shell(true)}>
      <BrandBar />

      {cards.map((c, i) => {
        const p = spring({ frame: frame - i * 7, fps, config: { damping: 170, mass: 0.7 } });
        const drift = interpolate(p, [0, 1], [1, 1]);
        return (
          <div
            key={c.f}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${c.x}px), calc(-50% + ${c.y}px)) scale(${drift})`,
              opacity: p,
              width: 360,
              padding: "20px 22px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 24px 60px -30px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: "#8fa2ba", letterSpacing: "0.12em" }}>
              {c.u}
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "#e6edf3", marginTop: 8 }}>
              {c.f}
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.12)",
                margin: "14px 0 10px",
              }}
            />
            <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: "#9fb0ca" }}>
              terpisah · tanpa keterkaitan
            </div>
          </div>
        );
      })}

      {/* connecting lines between the three cards */}
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {[
          [-470, -120, 0, 170],
          [470, -120, 0, 170],
          [-470, -120, 470, -120],
        ].map(([x1, y1, x2, y2], i) => {
          const p = spring({ frame: frame - (56 + i * 8), fps, config: { damping: 200 } });
          return (
            <line
              key={i}
              x1={960 + x1}
              y1={540 + y1 + 40}
              x2={960 + x1 + (x2 - x1) * p}
              y2={540 + y1 + (y2 - y1) * p + 40}
              stroke={BRAND.accent}
              strokeWidth={2}
              opacity={0.75 * p}
              strokeDasharray="5 7"
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 190,
          transform: `translateX(-50%) scale(${spring({ frame: frame - 78, fps, config: { damping: 14, mass: 0.5 } })})`,
          opacity: line,
          display: "flex",
          alignItems: "baseline",
          gap: 18,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 92, fontWeight: 600, color: BRAND.accent }}>
          100
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 24, color: "#9fb0ca" }}>skor korelasi</div>
      </div>

      <Grain opacity={0.07} />
      <Vignette />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 2. problem */

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = [
    "Laporan insiden jarang datang lengkap.",
    "Dan hampir tidak pernah datang sendirian.",
  ];
  const ask = spring({ frame: frame - 62, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 330, width: 1500 }}>
        {lines.map((l, i) => {
          const p = spring({ frame: frame - i * 16, fps, config: { damping: 190, mass: 0.7 } });
          const y = interpolate(p, [0, 1], [46, 0]);
          return (
            <div
              key={l}
              style={{
                fontFamily: FONT.sans,
                fontSize: 74,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.16,
                color: i === 1 ? BRAND.faint : BRAND.ink,
                opacity: p,
                transform: `translateY(${y}px)`,
                marginBottom: 12,
              }}
            >
              {l}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 660,
          fontFamily: FONT.sans,
          fontSize: 31,
          color: BRAND.muted,
          maxWidth: 1180,
          lineHeight: 1.5,
          opacity: ask,
          transform: `translateY(${interpolate(ask, [0, 1], [22, 0])}px)`,
        }}
      >
        Satu satuan melaporkan email phishing. Satuan lain melaporkan koneksi keluar yang
        mencurigakan. Tanpa cara membandingkan bukti, keduanya tetap dua berkas yang tidak pernah
        bertemu.
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 130,
          width: interpolate(spring({ frame: frame - 88, fps, config: { damping: 200 } }), [0, 1], [0, 120]),
          height: 5,
          background: BRAND.accent,
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 3. value props */

export const Values: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = [
    "Setiap berkas bukti diberi sidik jari SHA-256 dan manifest Merkle.",
    "Indikator disimpan bersama asal barisnya, bukan sebagai nilai lepas.",
    "Pencocokan lintas satuan memakai HMAC tanpa membuka nilai mentah.",
    "Setiap tindakan masuk rantai audit hash-linked dengan checkpoint Ed25519.",
    "Kebijakan TLP, cakupan berbagi, dan approval ditegakkan di server.",
  ];

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 150 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 15, color: BRAND.accent, letterSpacing: "0.18em" }}>
          RINGKASAN
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 56, fontWeight: 800, color: BRAND.ink, marginTop: 12 }}>
          Yang RANTAI jaga
        </div>
      </div>

      <div style={{ position: "absolute", left: 120, top: 330, width: 1560 }}>
        {items.map((t, i) => {
          const p = spring({ frame: frame - 14 - i * 13, fps, config: { damping: 180, mass: 0.7 } });
          const y = interpolate(p, [0, 1], [34, 0]);
          const drawn = interpolate(frame - (20 + i * 13), [0, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={t}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                marginBottom: 30,
                opacity: p,
                transform: `translateY(${y}px)`,
              }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" style={{ flex: "none", marginTop: 4 }}>
                <circle cx="15" cy="15" r="14" fill={BRAND.accentWash} stroke={BRAND.accent} strokeWidth="1.6" />
                <path
                  d="M8.5 15.5l4.2 4.2 8-8.6"
                  fill="none"
                  stroke={BRAND.accent}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="22"
                  strokeDashoffset={22 - 22 * drawn}
                />
              </svg>
              <div style={{ fontFamily: FONT.sans, fontSize: 27, color: BRAND.ink2, lineHeight: 1.45 }}>
                {t}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 4. generic screenshot scene */

export const ShotScene: React.FC<{
  src: string;
  title: string;
  caption: string;
  highlight?: number[];
  push?: number;
}> = ({ src, title, caption, highlight, push = 0.04 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.8 } });
  const scale = interpolate(enter, [0, 1], [0.9, 1]) * (1 + push * (frame / fps / 10));
  const y = interpolate(enter, [0, 1], [70, 0]);
  const titleP = spring({ frame: frame - 6, fps, config: { damping: 200 } });

  const sweep = interpolate(frame - 34, [0, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 132,
          fontFamily: FONT.sans,
          fontSize: 40,
          fontWeight: 800,
          color: BRAND.ink,
          opacity: titleP,
          transform: `translateY(${interpolate(titleP, [0, 1], [18, 0])}px)`,
        }}
      >
        {title}
      </div>

      <div style={{ transform: `translateY(${y}px)` }}>
        <BrowserFrame src={src} scale={scale}>
          {highlight && (
            <div
              style={{
                position: "absolute",
                left: `${highlight[0] * 100}%`,
                top: `${highlight[1] * 100}%`,
                width: `${highlight[2] * 100}%`,
                height: `${highlight[3] * 100}%`,
                border: `3px solid ${BRAND.accent}`,
                borderRadius: 4,
                boxShadow: `0 0 0 4000px rgba(24,102,219,${0.10 * (1 - Math.abs(sweep - 0.5) * 2)})`,
                opacity: sweep > 0 ? 1 : 0,
                transform: `scale(${interpolate(sweep, [0, 0.4, 1], [1.06, 1, 1])})`,
              }}
            />
          )}
        </BrowserFrame>
      </div>

      <div style={captionStyle}>{caption}</div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 5. score bands */

export const ScoreBands: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxBar = 980;

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 140 }}>
        <div style={{ fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
          Skor pada data demo
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 21, color: BRAND.muted, marginTop: 8 }}>
          Skor 0–100 adalah kekuatan bukti, bukan probabilitas statistik.
        </div>
      </div>

      {SCORES.map((s, i) => {
        const delay = 16 + i * 11;
        const p = spring({ frame: frame - delay, fps, config: { damping: 190, mass: 0.8 } });
        const w = (s.value / 100) * maxBar * p;
        const shown = useCount(s.value, delay, 40);
        return (
          <div key={s.label} style={{ position: "absolute", left: 120, top: 300 + i * 132, width: 1640 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 20, fontWeight: 600, color: BRAND.ink }}>
                {s.label}
                <span style={{ fontFamily: FONT.sans, fontSize: 13, color: BRAND.muted, marginLeft: 12 }}>
                  {s.note}
                </span>
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 30,
                  fontWeight: 600,
                  color: s.color,
                  opacity: p,
                }}
              >
                {Math.round(shown)}
              </div>
            </div>
            <div style={{ height: 26, background: BRAND.sunk, borderRadius: 3, position: "relative" }}>
              <div
                style={{
                  width: w,
                  height: "100%",
                  background: s.color,
                  borderRadius: 3,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: BRAND.muted,
                letterSpacing: "0.08em",
                marginTop: 6,
                opacity: p,
              }}
            >
              {s.band}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 74,
          fontFamily: FONT.sans,
          fontSize: 22,
          color: BRAND.muted,
          opacity: spring({ frame: frame - 76, fps, config: { damping: 200 } }),
        }}
      >
        Angka nol sama pentingnya dengan angka seratus: bukti bahwa mesin tidak memaksakan temuan.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 6. pipeline */

export const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stages = [
    ["Ingest", ".eml .csv .log .txt .zip"],
    ["Parse", "header, baris, arsip aman"],
    ["Ekstrak & normalisasi", "defang · homoglyph · IDN"],
    ["Bobot", "spesifisitas df · bonus waktu"],
    ["Skor pasangan", "0–100 + alasan"],
  ];
  const bands = [
    ["Kuat", "≥ 70", BRAND.accentWash, BRAND.accent],
    ["Sedang", "45–69", BRAND.cautionWash, BRAND.caution],
    ["Lemah", "25–44", "#fbf4dc", BRAND.gold],
    ["Dibuang", "< 25", BRAND.sunk, BRAND.rule],
  ];

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 138, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Mesin korelasi
      </div>

      {stages.map(([name, note], i) => {
        const p = spring({ frame: frame - 10 - i * 10, fps, config: { damping: 180, mass: 0.7 } });
        const x = 120 + i * 344;
        return (
          <React.Fragment key={name}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: 300,
                width: 300,
                padding: "22px 20px",
                border: `1.5px solid ${i === 2 ? BRAND.accent : BRAND.rule}`,
                background: i === 2 ? BRAND.accentWash : "#fff",
                borderRadius: 4,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px)`,
              }}
            >
              <div style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: BRAND.ink }}>
                {name}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: BRAND.muted, marginTop: 8, lineHeight: 1.5 }}>
                {note}
              </div>
            </div>
            {i < stages.length - 1 && (
              <svg width="46" height="24" style={{ position: "absolute", left: x + 302, top: 340, opacity: p }}>
                <line x1="0" y1="12" x2="34" y2="12" stroke={BRAND.accent} strokeWidth="2" />
                <path d="M34 12l-7 -5v10z" fill={BRAND.accent} />
              </svg>
            )}
          </React.Fragment>
        );
      })}

      {bands.map(([name, range, bg, border], i) => {
        const p = spring({ frame: frame - 66 - i * 7, fps, config: { damping: 190 } });
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: 120 + i * 410,
              top: 560,
              width: 380,
              height: 96,
              background: bg as string,
              border: `1.5px solid ${border as string}`,
              borderRadius: 4,
              padding: "16px 18px",
              opacity: p,
              transform: `scale(${interpolate(p, [0, 1], [0.94, 1])})`,
            }}
          >
            <div style={{ fontFamily: FONT.sans, fontSize: 18, fontWeight: 700, color: BRAND.ink }}>
              {name}
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: BRAND.ink2, marginTop: 7 }}>
              {range}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 712,
          width: 1700,
          fontFamily: FONT.sans,
          fontSize: 21,
          color: BRAND.muted,
          lineHeight: 1.55,
          opacity: spring({ frame: frame - 96, fps, config: { damping: 200 } }),
        }}
      >
        Indikator umum tetap dihitung tetapi dibatasi 2 poin per indikator dan 8 poin per pasangan.
        Pasangan yang hanya berbagi infrastruktur umum ditahan di 24 poin — di bawah ambang lemah.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 7. weights */

export const Weights: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 138, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Bobot dasar indikator
      </div>
      <div style={{ position: "absolute", left: 120, top: 196, fontFamily: FONT.sans, fontSize: 20, color: BRAND.muted }}>
        w = base / (1 + 0.5 × (df − 1))
      </div>

      {WEIGHTS.map((w, i) => {
        const p = spring({ frame: frame - 12 - i * 8, fps, config: { damping: 190, mass: 0.8 } });
        const width = (w.value / 100) * 1180 * p;
        return (
          <div key={w.label} style={{ position: "absolute", left: 120, top: 300 + i * 84, width: 1560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 250, fontFamily: FONT.sans, fontSize: 19, color: BRAND.ink }}>
                {w.label}
              </div>
              <div style={{ height: 24, width, background: i === 0 ? BRAND.accent : BRAND.accentDeep, opacity: 0.35 + 0.65 * (1 - i / 9), borderRadius: 3 }} />
              <div style={{ fontFamily: FONT.mono, fontSize: 17, fontWeight: 600, color: BRAND.ink, opacity: p }}>
                {w.value}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 8. integrity chain */

export const Integrity: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const blocks = ["H₀", "H₁", "H₂", "H₃", "H₄", "H₅"];
  const tamperAt = 4;
  const tamperP = interpolate(frame, [110, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 138, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Integritas bukti
      </div>
      <div style={{ position: "absolute", left: 120, top: 196, fontFamily: FONT.mono, fontSize: 19, color: BRAND.muted }}>
        H_i = SHA256(H_(i−1) ‖ canonical_json(E_i))
      </div>

      {blocks.map((b, i) => {
        const p = spring({ frame: frame - 12 - i * 9, fps, config: { damping: 180, mass: 0.7 } });
        const tampered = i === tamperAt && tamperP > 0.4;
        return (
          <React.Fragment key={b}>
            <div
              style={{
                position: "absolute",
                left: 130 + i * 296,
                top: 320,
                width: 250,
                height: 130,
                border: `2px solid ${tampered ? BRAND.signal : BRAND.accent}`,
                background: tampered ? BRAND.signalWash : BRAND.accentWash,
                borderRadius: 5,
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 600, color: BRAND.ink }}>{b}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: tampered ? BRAND.signal : BRAND.muted }}>
                {i === 0 ? "64 digit nol" : `E_${i}`}
              </div>
            </div>
            {i < blocks.length - 1 && (
              <svg width="46" height="20" style={{ position: "absolute", left: 384 + i * 296, top: 375, opacity: p }}>
                <line x1="0" y1="10" x2="32" y2="10" stroke={tampered || (i + 1 === tamperAt && tamperP > 0.4) ? BRAND.signal : BRAND.accent} strokeWidth="2" />
                <path d={`M32 10l-7 -5v10z`} fill={tampered || (i + 1 === tamperAt && tamperP > 0.4) ? BRAND.signal : BRAND.accent} />
              </svg>
            )}
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 130,
          top: 510,
          width: 700,
          padding: "22px 24px",
          background: tamperP > 0.4 ? BRAND.signalWash : BRAND.verifyWash,
          border: `1.5px solid ${tamperP > 0.4 ? BRAND.signal : BRAND.verify}`,
          borderRadius: 5,
          opacity: spring({ frame: frame - 96, fps, config: { damping: 200 } }),
        }}
      >
        <div style={{ fontFamily: FONT.sans, fontSize: 19, fontWeight: 700, color: tamperP > 0.4 ? BRAND.signal : BRAND.verify }}>
          {tamperP > 0.4 ? "TERDETEKSI · entri #4 diubah" : "TERVERIFIKASI · rantai utuh"}
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 15.5, color: BRAND.ink2, marginTop: 8, lineHeight: 1.55 }}>
          Checkpoint Ed25519 menandatangani kepala rantai, sehingga penulisan ulang seluruh rantai
          tetap terdeteksi.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 130,
          top: 510,
          width: 620,
          fontFamily: FONT.sans,
          fontSize: 17,
          color: BRAND.muted,
          lineHeight: 1.6,
          opacity: spring({ frame: frame - 104, fps, config: { damping: 200 } }),
        }}
      >
        Manifest laporan menyertakan SHA-256 tiap berkas dan Merkle root, sehingga keaslian dapat
        diverifikasi di luar sistem. Rantai membuktikan konsistensi, bukan keaslian berkas sebelum
        diunggah.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 9. architecture */

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const node = (x: number, y: number, w: number, title: string, note: string, delay: number, accent = false) => {
    const p = spring({ frame: frame - delay, fps, config: { damping: 185, mass: 0.7 } });
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          padding: "18px 20px",
          background: accent ? BRAND.accentWash : "#fff",
          border: `1.5px solid ${accent ? BRAND.accent : BRAND.rule}`,
          borderRadius: 4,
          opacity: p,
          transform: `translateX(${interpolate(p, [0, 1], [-40, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: FONT.sans, fontSize: 16.5, fontWeight: 700, color: BRAND.ink }}>{title}</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: BRAND.muted, marginTop: 6 }}>{note}</div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 132, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Arsitektur
      </div>

      <div style={{ position: "absolute", left: 120, top: 214, width: 1680, height: 250, background: BRAND.sunk, border: `1.5px solid ${BRAND.rule}`, borderRadius: 5 }} />
      <div style={{ position: "absolute", left: 146, top: 236, fontFamily: FONT.mono, fontSize: 11.5, color: BRAND.ink2, letterSpacing: "0.1em" }}>
        MODE CLOUDFLARE · TERKELOLA
      </div>
      {node(150, 286, 300, "React 19 + Vite", "dist/ statis", 10, true)}
      {node(510, 286, 340, "Cloudflare Worker", "Hono · API + auth", 20, true)}
      {node(910, 268, 320, "D1 · SQLite", "BLOB bukti · audit", 30)}
      {node(910, 356, 320, "WebCrypto", "SHA-256 · HMAC · Ed25519", 38)}

      <div style={{ position: "absolute", left: 120, top: 500, width: 1680, height: 250, background: BRAND.sunk, border: `1.5px solid ${BRAND.rule}`, borderRadius: 5 }} />
      <div style={{ position: "absolute", left: 146, top: 522, fontFamily: FONT.mono, fontSize: 11.5, color: BRAND.ink2, letterSpacing: "0.1em" }}>
        MODE ON-PREMISE · OFFLINE
      </div>
      {node(150, 572, 300, "React 19 + Vite", "dist/ dilayani Node", 46, true)}
      {node(510, 572, 340, "Node + Hono", "@hono/node-server", 54, true)}
      {node(910, 554, 320, "node:sqlite", "shim antarmuka D1", 62)}
      {node(910, 642, 320, "filesystem", "evidence/ · hingga 50 MB", 70)}

      {[
        [462, 336, 40],
        [862, 336, 40],
        [462, 622, 40],
        [862, 622, 40],
      ].map(([x, y], i) => {
        const p = spring({ frame: frame - (16 + i * 8), fps, config: { damping: 200 } });
        return (
          <svg key={i} width="52" height="20" style={{ position: "absolute", left: x, top: y, opacity: p }}>
            <line x1="0" y1="10" x2="38" y2="10" stroke={BRAND.accent} strokeWidth="2" />
            <path d="M38 10l-7 -5v10z" fill={BRAND.accent} />
          </svg>
        );
      })}

      <div
        style={{
          position: "absolute",
          right: 130,
          top: 300,
          width: 250,
          padding: "18px 16px",
          background: "#fff",
          border: `1.5px solid ${BRAND.rule}`,
          borderRadius: 4,
          opacity: spring({ frame: frame - 80, fps, config: { damping: 200 } }),
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: BRAND.ink }}>EvidenceStorage</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: BRAND.muted, marginTop: 8, lineHeight: 1.5 }}>
          put / get / delete
          <br />
          900 KB · D1
          <br />
          50 MB · disk
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 70,
          fontFamily: FONT.sans,
          fontSize: 20,
          color: BRAND.muted,
          opacity: spring({ frame: frame - 92, fps, config: { damping: 200 } }),
        }}
      >
        Satu Worker, satu basis data, tanpa layanan eksternal dan tanpa panggilan keluar saat runtime.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 10. graph */

export const Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nodes = [
    { id: "INC-2026-001", x: 470, y: 700, score: 100, color: BRAND.signal },
    { id: "INC-2026-002", x: 470, y: 470, score: 100, color: BRAND.signal },
    { id: "INC-2026-003", x: 470, y: 290, score: 58, color: BRAND.accent },
    { id: "INC-2026-004", x: 470, y: 130, score: 0, color: BRAND.faint },
  ];
  const inds = [
    { id: "kartika-supply.example", x: 1250, y: 180 },
    { id: "keuangan@kartika-supply", x: 1250, y: 480 },
    { id: "90ea3e77…a7c", x: 1250, y: 700 },
  ];
  const edges = [
    [0, 0], [1, 0], [2, 0], [0, 2], [1, 1], [2, 1], [3, 0],
  ];

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 132, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Graf kampanye
      </div>

      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {edges.map(([n, i], k) => {
          const p = spring({ frame: frame - 40 - k * 6, fps, config: { damping: 200 } });
          const a = nodes[n];
          const b = inds[i];
          return (
            <line
              key={k}
              x1={a.x + 78}
              y1={a.y}
              x2={a.x + 78 + (b.x - 90 - (a.x + 78)) * p}
              y2={a.y + (b.y - a.y) * p}
              stroke={a.score === 0 ? BRAND.rule : BRAND.accent}
              strokeWidth={a.score === 100 ? 2.2 : 1.6}
              opacity={0.55 * p}
            />
          );
        })}
      </svg>

      {nodes.map((n, i) => {
        const p = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 170, mass: 0.7 } });
        const pulse = n.score === 0 ? 1 + Math.sin((frame - 60) / 9) * 0.04 * (frame > 60 ? 1 : 0) : 1;
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y - 34,
              width: 78,
              height: 68,
              opacity: p,
              transform: `scale(${p * pulse})`,
            }}
          >
            <div
              style={{
                width: 78,
                height: 68,
                borderRadius: 99,
                border: `2.5px solid ${n.color}`,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                fontFamily: FONT.mono,
                fontSize: 19,
                fontWeight: 600,
                color: n.color,
              }}
            >
              {n.score}
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, color: BRAND.ink, marginTop: 8, whiteSpace: "nowrap" }}>
              {n.id}
            </div>
            {n.score === 0 && (
              <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: BRAND.faint, marginTop: 3 }}>
                tidak terkait
              </div>
            )}
          </div>
        );
      })}

      {inds.map((ind, i) => {
        const p = spring({ frame: frame - 30 - i * 9, fps, config: { damping: 180 } });
        return (
          <div
            key={ind.id}
            style={{
              position: "absolute",
              left: ind.x - 40,
              top: ind.y - 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: p,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 99,
                border: `2px solid #3dd6c4`,
                background: "#fff",
                flex: "none",
              }}
            />
            <div style={{ fontFamily: FONT.mono, fontSize: 13, color: BRAND.ink2, whiteSpace: "nowrap" }}>
              {ind.id}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 74,
          fontFamily: FONT.sans,
          fontSize: 21,
          color: BRAND.muted,
          opacity: spring({ frame: frame - 78, fps, config: { damping: 200 } }),
        }}
      >
        Korelasi adalah petunjuk penyelidikan, bukan bukti atribusi.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 11. TLP gate */

export const TlpGate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const card = spring({ frame: frame - 12, fps, config: { damping: 190 } });
  const approve = spring({ frame: frame - 46, fps, config: { damping: 160 } });
  const gate = spring({ frame: frame - 84, fps, config: { damping: 13, mass: 0.6 } });

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <div style={{ position: "absolute", left: 120, top: 132, fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink }}>
        Approval bukan izin mutlak
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 240,
          width: 720,
          background: "#fff",
          border: `1.5px solid ${BRAND.rule}`,
          borderRadius: 6,
          padding: "28px 28px",
          opacity: card,
          transform: `translateY(${interpolate(card, [0, 1], [30, 0])}px)`,
          boxShadow: "0 28px 60px -34px rgba(18,26,38,0.35)",
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: BRAND.faint, letterSpacing: "0.1em" }}>
          PERMINTAAN AKSES · BRAVO → ALPHA
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 700, color: BRAND.ink, marginTop: 14 }}>
          Bukti mentah · cakupan raw
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 15, color: BRAND.muted, marginTop: 10, lineHeight: 1.6 }}>
          Alasan: tinjauan forensik lampiran email. Masa berlaku tiga hari.
        </div>

        <div
          style={{
            marginTop: 22,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderRadius: 4,
            background: BRAND.verifyWash,
            border: `1.5px solid ${BRAND.verify}`,
            opacity: approve,
            transform: `scale(${interpolate(approve, [0, 1], [0.9, 1])})`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke={BRAND.verify} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: FONT.sans, fontSize: 15, fontWeight: 600, color: BRAND.verify }}>
            Disetujui koordinator
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 940,
          top: 240,
          width: 840,
          height: 400,
          display: "grid",
          placeItems: "center",
          opacity: gate,
        }}
      >
        <div
          style={{
            width: 820,
            border: `2.5px solid ${BRAND.signal}`,
            background: BRAND.signalWash,
            borderRadius: 6,
            padding: "34px 34px",
            transform: `scale(${interpolate(gate, [0, 1], [1.14, 1])})`,
            boxShadow: `0 0 0 18px rgba(184,50,50,${0.07 * gate})`,
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 15, color: BRAND.signal, letterSpacing: "0.14em", fontWeight: 600 }}>
            TLP:RED
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 30, fontWeight: 800, color: BRAND.signal, marginTop: 12 }}>
            Tetap ditolak lintas satuan
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 17, color: BRAND.ink2, marginTop: 14, lineHeight: 1.6 }}>
            Approval tidak mengalahkan larangan. Artefak <b>restricted</b> dan TLP RED/AMBER+STRICT
            selalu tertutup, juga pada laporan dan ekspor.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 96,
          fontFamily: FONT.mono,
          fontSize: 13.5,
          color: BRAND.muted,
          lineHeight: 1.9,
          opacity: spring({ frame: frame - 108, fps, config: { damping: 200 } }),
        }}
      >
        1 · satuan pemilik / koordinator — boleh
        <br />
        2 · share_scope restricted — selalu tolak
        <br />
        3 · RED, AMBER+STRICT — selalu tolak
        <br />
        4 · AMBER — perlu approval aktif
        <br />
        5 · GREEN, CLEAR — boleh, tunduk langkah 2
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 12. close */

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = useDrift(0.03);

  const lines = ["RANTAI mendukung Kartika CSIRT,", "bukan menggantikannya."];
  return (
    <AbsoluteFill style={shell(true)}>
      <div style={{ transform: `scale(${drift.scale})`, position: "absolute", inset: 0 }}>
        <BrandBar />
        <div style={{ position: "absolute", left: 120, top: 320, width: 1600 }}>
          {lines.map((l, i) => {
            const p = spring({ frame: frame - i * 12, fps, config: { damping: 190, mass: 0.7 } });
            return (
              <div
                key={l}
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 66,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: i === 1 ? "#8fa2ba" : "#fff",
                  lineHeight: 1.18,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
                }}
              >
                {l}
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 650,
            fontFamily: FONT.sans,
            fontSize: 23,
            color: "#9fb0ca",
            maxWidth: 1100,
            lineHeight: 1.6,
            opacity: spring({ frame: frame - 40, fps, config: { damping: 200 } }),
          }}
        >
          Menyatukan laporan lintas satuan, menjaga bukti tetap bisa dipercaya, dan membuat keputusan
          analis bisa dipertanggungjawabkan.
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 130,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            opacity: spring({ frame: frame - 62, fps, config: { damping: 200 } }),
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 21, color: "#6fa4f0" }}>
            rantai.careday17.workers.dev
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 17, color: "#8fa2ba" }}>
            github.com/symful/kartika-cyber-hackathon-2026
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 120,
            bottom: 130,
            textAlign: "right",
            fontFamily: FONT.sans,
            fontSize: 13,
            color: "#7d90ad",
            lineHeight: 1.7,
            maxWidth: 470,
          }}
        >
          Data pelatihan sintetis.
          <br />
          Profil kampanye merujuk pada advisory publik CISA AA23-341A.
        </div>
      </div>
      <Grain opacity={0.07} />
      <Vignette />
    </AbsoluteFill>
  );
};
