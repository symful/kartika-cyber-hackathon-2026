import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT, SCORES, WEIGHTS } from "./theme";
import { BrandBar, Grain, Vignette, captionStyle } from "./ui";
import { staticFile } from "remotion";

/**
 * Cue-driven scenes.
 *
 * Every visual element is bound to a narration cue: the frame at which the
 * matching sentence starts speaking. That is what keeps picture and voice aligned
 * even though each scene has a different length.
 */

type Cues = Record<string, number>;

const sceneFrames = (): number => useVideoConfig().durationInFrames;

/** Frame at which a cue fires. Falls back to a fraction of the scene if missing. */
const cue = (cues: Cues, name: string, fallbackFrac = 0): number => {
  if (name in cues) return cues[name];
  const total = sceneFrames();
  return Math.round(fallbackFrac * total);
};

/** Spring that starts at a cue. */
const atCue = (cues: Cues, name: string, fallbackFrac = 0, cfg = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = cue(cues, name, fallbackFrac);
  return spring({
    frame: frame - start,
    fps,
    config: { damping: (cfg as any).damping ?? 170, mass: (cfg as any).mass ?? 0.7 },
  });
};

/** Linear 0..1 progress that starts at a cue and runs for `span` frames. */
const atCueLinear = (cues: Cues, name: string, span = 26, fallbackFrac = 0) => {
  const frame = useCurrentFrame();
  const start = cue(cues, name, fallbackFrac);
  return interpolate(frame - start, [0, span], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
  });
};

/** Counts to a value starting at a cue. */
const countAtCue = (cues: Cues, name: string, to: number, span = 40, fallbackFrac = 0) => {
  const p = atCueLinear(cues, name, span, fallbackFrac);
  return to * p;
};

const shell = (dark = false): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  background: dark ? BRAND.navyDeep : BRAND.paper,
  fontFamily: FONT.sans,
  overflow: "hidden",
});

/** Slow camera drift for the whole scene so nothing is ever static. */
const Cam: React.FC<{ amount?: number; children: React.ReactNode }> = ({ amount = 0.05, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${1 + amount * p}) translateY(${-14 * p}px)`,
        transformOrigin: "50% 55%",
      }}
    >
      {children}
    </div>
  );
};

const Idle: React.FC<{ phase?: number; amp?: number }> = ({ phase = 0, amp = 4 }) => {
  const frame = useCurrentFrame();
  const y = Math.sin(frame * 0.035 + phase) * amp;
  return <span style={{ display: "inline-block", transform: `translateY(${y}px)` }} />;
};

const useIdle = (phase = 0, amp = 4) => {
  const frame = useCurrentFrame();
  return Math.sin(frame * 0.035 + phase) * amp;
};

const usePulse = (phase = 0) => {
  const frame = useCurrentFrame();
  return 0.5 + 0.5 * Math.sin(frame * 0.06 + phase);
};

const ProgressRail: React.FC<{ color?: string }> = ({ color = BRAND.accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(0,0,0,0.06)" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: color, opacity: 0.5 }} />
    </div>
  );
};

const Ambient: React.FC<{ hue?: string; opacity?: number }> = ({ hue = "#1866db", opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(62% 58% at ${18 + p * 64}% ${24 + p * 46}%, ${hue}24 0%, transparent 70%)`,
        opacity,
      }}
    />
  );
};

/* ============================================================ 1. cold open */
export const ColdOpen: React.FC<{ cues: Cues }> = ({ cues }) => {
  const cards = [
    { u: "ALPHA", f: "faktur-pengadaan.eml", x: -470, y: -110, c: "card0" },
    { u: "BRAVO", f: "koneksi-keluar.log", x: 470, y: -110, c: "card1" },
    { u: "PUSAT", f: "laporan-002.json", x: 0, y: 180, c: "card2" },
  ];
  const linesP = atCueLinear(cues, "lines", 40);
  const scoreIn = atCue(cues, "score", 0.5, { damping: 14, mass: 0.55 });
  const score = countAtCue(cues, "score", 100, 46);
  const labelP = atCueLinear(cues, "label", 30);
  const ctaP = atCueLinear(cues, "cta", 34);

  return (
    <AbsoluteFill style={shell(true)}>
      <BrandBar />
      <Ambient hue="#1867db" opacity={0.15} />
      <Cam amount={0.075}>
        {cards.map((c, i) => {
          const p = atCue(cues, c.c, i * 0.04);
          const float = useIdle(i * 1.7, 6);
          return (
            <div
              key={c.f}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${c.x}px), calc(-50% + ${c.y + float}px)) scale(${0.88 + p * 0.12})`,
                opacity: p,
                width: 360,
                padding: "20px 22px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid rgba(255,255,255,${0.12 + p * 0.1})`,
                boxShadow: "0 24px 60px -30px rgba(0,0,0,0.8)",
              }}
            >
              <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: "#8fa2ba", letterSpacing: "0.12em" }}>{c.u}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 16, color: "#e6edf3", marginTop: 8 }}>{c.f}</div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "14px 0 10px" }} />
              <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: "#9fb0ca" }}>terpisah · tanpa keterkaitan</div>
            </div>
          );
        })}

        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          {[
            [-470, -70, -20, 210],
            [470, -70, 20, 210],
            [-470, -70, 470, -70],
          ].map(([x1, y1, x2, y2], i) => {
            const d = atCueLinear(cues, "lines", 44 + i * 10);
            return (
              <line
                key={i}
                x1={960 + x1}
                y1={540 + y1 + 40}
                x2={960 + x1 + (x2 - x1) * d}
                y2={540 + y1 + (y2 - y1) * d}
                stroke={BRAND.accent}
                strokeWidth={2}
                opacity={0.7 * linesP}
                strokeDasharray="6 8"
              />
            );
          })}
        </svg>

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 185,
            transform: `translateX(-50%) scale(${scoreIn})`,
            opacity: Math.min(1, scoreIn * 1.3),
            display: "flex",
            alignItems: "baseline",
            gap: 18,
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 96, fontWeight: 600, color: BRAND.accent }}>{Math.round(score)}</div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 24,
              color: "#9fb0ca",
              opacity: labelP,
              transform: `translateX(${interpolate(labelP, [0, 1], [-16, 0])}px)`,
            }}
          >
            skor korelasi
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 96,
            fontFamily: FONT.mono,
            fontSize: 14,
            letterSpacing: "0.14em",
            color: "#8fa2ba",
            opacity: ctaP,
          }}
        >
          RANTAI · INCIDENT EVIDENCE &amp; COORDINATION
        </div>
      </Cam>
      <ProgressRail color="#4f8cff" />
      <Grain opacity={0.07} />
      <Vignette />
    </AbsoluteFill>
  );
};

/* ============================================================ 2. problem */
export const Problem: React.FC<{ cues: Cues }> = ({ cues }) => {
  const h1 = atCue(cues, "h1", 0.02);
  const h2 = atCue(cues, "h2", 0.35);
  const b1 = atCueLinear(cues, "body1", 34);
  const b2 = atCueLinear(cues, "body2", 34);
  const b3 = atCueLinear(cues, "body3", 34);
  const rule = atCueLinear(cues, "rule", 40, 0.85);

  const body = (p: number, text: string, top: number) => (
    <div
      style={{
        position: "absolute",
        left: 120,
        top,
        width: 1180,
        fontFamily: FONT.sans,
        fontSize: 29,
        lineHeight: 1.55,
        color: BRAND.muted,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px)`,
      }}
    >
      {text}
    </div>
  );

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam>
        <div
          style={{
            position: "absolute",
            left: 120,
            top: 250,
            width: 1500,
            fontFamily: FONT.sans,
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.14,
            color: BRAND.ink,
            opacity: h1,
            transform: `translateY(${interpolate(h1, [0, 1], [40, 0])}px)`,
          }}
        >
          Masalahnya bukan kekurangan alat deteksi.
        </div>

        {body(b1, "Setiap satuan punya laporan sendiri, tersimpan sendiri, dan sering kali tidak pernah dibandingkan dengan laporan satuan lain.", 430)}

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 570,
            fontFamily: FONT.sans,
            fontSize: 56,
            fontWeight: 800,
            color: BRAND.faint,
            letterSpacing: "-0.02em",
            opacity: h2,
            transform: `translateY(${interpolate(h2, [0, 1], [30, 0])}px)`,
          }}
        >
          Yang hilang adalah benang penghubungnya.
        </div>

        {body(b2, "Bukti sulit dibuktikan tetap utuh setelah berpindah tangan, karena tidak ada catatan siapa memegangnya dan kapan.", 700)}
        {body(b3, "Koordinasi berjalan lewat pesan dan spreadsheet, sehingga keputusan analis tidak meninggalkan jejak yang bisa diperiksa.", 790)}

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 120,
            width: interpolate(rule, [0, 1], [0, 150]),
            height: 5,
            background: BRAND.accent,
            opacity: rule,
          }}
        />
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 3. values */
export const Values: React.FC<{ cues: Cues }> = ({ cues }) => {
  const items = [
    { c: "i0", t: "Setiap berkas bukti diberi sidik jari SHA-256 dan manifest Merkle." },
    { c: "i1", t: "Indikator disimpan bersama asal barisnya, bukan sebagai nilai lepas." },
    { c: "i2", t: "Pencocokan lintas satuan memakai HMAC tanpa membuka nilai mentah." },
    { c: "i3", t: "Setiap tindakan masuk rantai audit hash-linked dengan checkpoint Ed25519." },
    { c: "i4", t: "Kebijakan TLP, cakupan berbagi, dan approval ditegakkan di server." },
  ];
  const kicker = atCueLinear(cues, "kicker", 26);
  const close = atCueLinear(cues, "close", 34);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.04}>
        <div style={{ position: "absolute", left: 120, top: 150 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 15, color: BRAND.accent, letterSpacing: "0.18em", opacity: kicker }}>
            RINGKASAN
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 56, fontWeight: 800, color: BRAND.ink, marginTop: 12 }}>
            Yang RANTAI jaga
          </div>
        </div>

        <div style={{ position: "absolute", left: 120, top: 320, width: 1560 }}>
          {items.map((it, i) => {
            const p = atCue(cues, it.c, 0.15 + i * 0.14, { damping: 175 });
            const d = atCueLinear(cues, it.c, 18, 0.15 + i * 0.14);
            const float = useIdle(i, 2.5);
            return (
              <div
                key={it.t}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  marginBottom: 28,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [30, 0]) + float}px)`,
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
                    strokeDashoffset={22 - 22 * d}
                  />
                </svg>
                <div style={{ fontFamily: FONT.sans, fontSize: 26, color: BRAND.ink2, lineHeight: 1.45 }}>{it.t}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 92,
            fontFamily: FONT.sans,
            fontSize: 19,
            color: BRAND.muted,
            opacity: close,
          }}
        >
          Lima jaminan ini berlaku sama, baik di Cloudflare maupun di lingkungan offline.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 4. screenshot */
export const ShotScene: React.FC<{
  cues: Cues;
  src: string;
  title: string;
  caption: string;
  highlight?: number[];
}> = ({ cues, src, title, caption, highlight }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);

  const frameIn = atCue(cues, "frame", 0.05, { damping: 195, mass: 0.85 });
  const titleIn = atCueLinear(cues, "title", 28);
  const hl = atCueLinear(cues, "verify", 44, 0.55);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 128,
          fontFamily: FONT.sans,
          fontSize: 38,
          fontWeight: 800,
          color: BRAND.ink,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [16, 0])}px)`,
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "53%",
          transform: `translate(-50%, -50%) scale(${interpolate(frameIn, [0, 1], [0.93, 1]) * (1 + p * 0.035)})`,
          width: 1500,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 42px 90px -24px rgba(18,26,38,0.4), 0 8px 24px -8px rgba(18,26,38,0.18)",
          border: `1px solid ${BRAND.rule}`,
          background: "#fff",
          opacity: Math.min(1, frameIn * 1.5),
        }}
      >
        <div
          style={{
            height: 40,
            background: "#eef2f7",
            borderBottom: `1px solid ${BRAND.rule}`,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
          }}
        >
          {["#e0655f", "#e0b14e", "#5fb87a"].map((c) => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />
          ))}
          <div
            style={{
              marginLeft: 14,
              flex: 1,
              height: 22,
              borderRadius: 6,
              background: "#fff",
              border: `1px solid ${BRAND.rule}`,
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              fontFamily: FONT.mono,
              fontSize: 11,
              color: BRAND.faint,
            }}
          >
            rantai.careday17.workers.dev
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img
            src={staticFile(src)}
            style={{ width: "100%", display: "block", transform: `scale(${1.03 + p * 0.05}) translateY(${-p * 22}px)` }}
          />
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
                boxShadow: `0 0 0 4000px rgba(24,102,219,${0.11 * Math.sin(Math.PI * hl)})`,
                opacity: hl > 0.02 ? 1 : 0,
                transform: `scale(${interpolate(hl, [0, 0.4, 1], [1.06, 1, 1])})`,
              }}
            />
          )}
        </div>
      </div>

      <div style={{ ...captionStyle, fontSize: 22 }}>{caption}</div>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 5. score bands */
export const ScoreBands: React.FC<{ cues: Cues }> = ({ cues }) => {
  const maxBar = 980;
  const note = atCueLinear(cues, "note", 34, 0.85);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.04}>
        <div style={{ position: "absolute", left: 120, top: 136 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>Skor pada data demo</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 20, color: BRAND.muted, marginTop: 8, opacity: atCueLinear(cues, "sub", 26) }}>
            Skor 0–100 adalah kekuatan bukti, bukan probabilitas statistik.
          </div>
        </div>

        {SCORES.map((s, i) => {
          const name = `r${i}`;
          const p = atCue(cues, name, 0.12 + i * 0.17, { damping: 190 });
          const grow = atCueLinear(cues, name, 44, 0.12 + i * 0.17);
          const shown = countAtCue(cues, name, s.value, 44, 0.12 + i * 0.17);
          const pulse = s.value === 0 ? usePulse() : 0;
          return (
            <div key={s.label} style={{ position: "absolute", left: 120, top: 296 + i * 130, width: 1640 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: FONT.sans, fontSize: 19, fontWeight: 600, color: BRAND.ink }}>
                  {s.label}
                  <span style={{ fontSize: 12.5, color: BRAND.muted, marginLeft: 12, fontWeight: 400 }}>{s.note}</span>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 29,
                    fontWeight: 600,
                    color: s.color,
                    opacity: p,
                    transform: `scale(${1 + pulse * (s.value === 0 ? 0.06 : 0)})`,
                  }}
                >
                  {Math.round(shown)}
                </div>
              </div>
              <div style={{ height: 24, background: BRAND.sunk, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: (s.value / 100) * maxBar * grow, height: "100%", background: s.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, color: BRAND.muted, letterSpacing: "0.08em", marginTop: 6, opacity: p }}>
                {s.band}
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 70,
            fontFamily: FONT.sans,
            fontSize: 21,
            color: BRAND.muted,
            opacity: note,
            transform: `translateY(${interpolate(note, [0, 1], [12, 0])}px)`,
          }}
        >
          Angka nol sama pentingnya dengan angka seratus: bukti bahwa mesin tidak memaksakan temuan.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 6. pipeline */
export const Pipeline: React.FC<{ cues: Cues }> = ({ cues }) => {
  const stages = [
    ["Ingest", ".eml .csv .log .txt .zip", "s0"],
    ["Parse", "header, baris, arsip aman", "s1"],
    ["Ekstrak & normalisasi", "defang · homoglyph · IDN", "s2"],
    ["Bobot", "spesifisitas df · bonus waktu", "s3"],
    ["Skor pasangan", "0–100 + alasan", "s4"],
  ];
  const bands = [
    ["Kuat", "≥ 70", BRAND.accentWash, BRAND.accent, "b0"],
    ["Sedang", "45–69", BRAND.cautionWash, BRAND.caution, "b1"],
    ["Lemah", "25–44", "#fbf4dc", BRAND.gold, "b2"],
    ["Dibuang", "< 25", BRAND.sunk, BRAND.rule, "b3"],
  ];
  const note = atCueLinear(cues, "note", 36, 0.9);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 134, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Mesin korelasi
        </div>

        {stages.map(([name, sub, c], i) => {
          const p = atCue(cues, c, 0.06 + i * 0.07, { damping: 175 });
          const glow = i === 2 ? usePulse() : 0;
          const x = 120 + i * 344;
          return (
            <React.Fragment key={name}>
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: 292,
                  width: 300,
                  padding: "22px 20px",
                  border: `1.5px solid ${i === 2 ? BRAND.accent : BRAND.rule}`,
                  background: i === 2 ? BRAND.accentWash : "#fff",
                  borderRadius: 4,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)`,
                  boxShadow: i === 2 ? `0 0 0 ${6 * glow}px rgba(24,102,219,0.09)` : undefined,
                }}
              >
                <div style={{ fontFamily: FONT.sans, fontSize: 16.5, fontWeight: 700, color: BRAND.ink }}>{name}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: BRAND.muted, marginTop: 8, lineHeight: 1.5 }}>{sub}</div>
              </div>
              {i < stages.length - 1 && (
                <svg width="46" height="24" style={{ position: "absolute", left: x + 302, top: 330, opacity: p }}>
                  <line x1="0" y1="12" x2={34 * atCueLinear(cues, c, 14, 0.06 + i * 0.07)} y2="12" stroke={BRAND.accent} strokeWidth="2" />
                </svg>
              )}
            </React.Fragment>
          );
        })}

        {bands.map(([name, range, bg, border, c], i) => {
          const p = atCue(cues, c as string, 0.62 + i * 0.05, { damping: 190 });
          return (
            <div
              key={name}
              style={{
                position: "absolute",
                left: 120 + i * 410,
                top: 552,
                width: 380,
                height: 92,
                background: bg as string,
                border: `1.5px solid ${border as string}`,
                borderRadius: 4,
                padding: "16px 18px",
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.94, 1])})`,
              }}
            >
              <div style={{ fontFamily: FONT.sans, fontSize: 17.5, fontWeight: 700, color: BRAND.ink }}>{name}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, color: BRAND.ink2, marginTop: 7 }}>{range}</div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 700,
            width: 1690,
            fontFamily: FONT.sans,
            fontSize: 20,
            color: BRAND.muted,
            lineHeight: 1.55,
            opacity: note,
          }}
        >
          Setiap angka bisa dipertanggungjawabkan: daftar alasan selalu merujuk ke berkas dan baris asal.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 7. weights */
export const Weights: React.FC<{ cues: Cues }> = ({ cues }) => {
  const formula = atCueLinear(cues, "formula", 30);
  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 134, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Bobot dasar indikator
        </div>
        <div
          style={{
            position: "absolute",
            left: 120,
            top: 192,
            fontFamily: FONT.mono,
            fontSize: 19,
            color: BRAND.muted,
            opacity: formula,
            transform: `translateX(${interpolate(formula, [0, 1], [-18, 0])}px)`,
          }}
        >
          w = base / (1 + 0.5 × (df − 1))
        </div>

        {WEIGHTS.map((w, i) => {
          const c = `w${i}`;
          const p = atCue(cues, c, 0.1 + i * 0.09, { damping: 190 });
          const grow = atCueLinear(cues, c, 34, 0.1 + i * 0.09);
          return (
            <div key={w.label} style={{ position: "absolute", left: 120, top: 292 + i * 82, width: 1560 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 250, fontFamily: FONT.sans, fontSize: 18.5, color: BRAND.ink }}>{w.label}</div>
                <div
                  style={{
                    height: 22,
                    width: (w.value / 100) * 1180 * grow,
                    background: i === 0 ? BRAND.accent : BRAND.accentDeep,
                    opacity: 0.35 + 0.65 * (1 - i / 9),
                    borderRadius: 3,
                  }}
                />
                <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 600, color: BRAND.ink, opacity: p }}>{w.value}</div>
              </div>
            </div>
          );
        })}
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 8. integrity */
export const Integrity: React.FC<{ cues: Cues }> = ({ cues }) => {
  const blocks = ["H₀", "H₁", "H₂", "H₃", "H₄", "H₅"];
  const tamper = atCueLinear(cues, "tamper", 30, 0.7);
  const restore = atCueLinear(cues, "restore", 30, 0.9);
  const broken = tamper > 0.35 && restore < 0.5;
  const ok = atCueLinear(cues, "ok", 30, 0.55);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient hue="#b83232" opacity={0.05} />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 134, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Integritas bukti
        </div>
        <div style={{ position: "absolute", left: 120, top: 192, fontFamily: FONT.mono, fontSize: 18, color: BRAND.muted }}>
          H_i = SHA256(H_(i−1) ‖ canonical_json(E_i))
        </div>

        {blocks.map((b, i) => {
          const p = atCue(cues, `b${i}`, 0.06 + i * 0.08, { damping: 175 });
          const tampered = i === 4 && broken;
          return (
            <React.Fragment key={b}>
              <div
                style={{
                  position: "absolute",
                  left: 130 + i * 296,
                  top: 312,
                  width: 250,
                  height: 126,
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
                <div style={{ fontFamily: FONT.mono, fontSize: 23, fontWeight: 600, color: BRAND.ink }}>{b}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: tampered ? BRAND.signal : BRAND.muted }}>
                  {i === 0 ? "64 digit nol" : `E_${i}`}
                </div>
              </div>
              {i < blocks.length - 1 && (
                <svg width="46" height="20" style={{ position: "absolute", left: 384 + i * 296, top: 366, opacity: p }}>
                  <line
                    x1="0"
                    y1="10"
                    x2={32 * atCueLinear(cues, `b${i}`, 16, 0.06 + i * 0.08)}
                    y2="10"
                    stroke={broken && i >= 3 ? BRAND.signal : BRAND.accent}
                    strokeWidth="2"
                  />
                </svg>
              )}
            </React.Fragment>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 130,
            top: 498,
            width: 700,
            padding: "22px 24px",
            background: broken ? BRAND.signalWash : BRAND.verifyWash,
            border: `1.5px solid ${broken ? BRAND.signal : BRAND.verify}`,
            borderRadius: 5,
            opacity: Math.max(ok, tamper),
          }}
        >
          <div style={{ fontFamily: FONT.sans, fontSize: 18.5, fontWeight: 700, color: broken ? BRAND.signal : BRAND.verify }}>
            {broken ? "TERDETEKSI · entri #4 diubah" : "TERVERIFIKASI · rantai utuh"}
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 15, color: BRAND.ink2, marginTop: 8, lineHeight: 1.55 }}>
            Checkpoint Ed25519 menandatangani kepala rantai, sehingga penulisan ulang seluruh rantai tetap terdeteksi.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 130,
            top: 498,
            width: 620,
            fontFamily: FONT.sans,
            fontSize: 16.5,
            color: BRAND.muted,
            lineHeight: 1.6,
            opacity: restore,
          }}
        >
          Manifest laporan menyertakan SHA-256 tiap berkas dan Merkle root. Rantai membuktikan konsistensi, bukan
          keaslian berkas sebelum diunggah.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 9. architecture */
export const Architecture: React.FC<{ cues: Cues }> = ({ cues }) => {
  const node = (x: number, y: number, w: number, title: string, note: string, c: string, accent = false) => {
    const p = atCue(cues, c, 0.2, { damping: 185 });
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
          transform: `translateX(${interpolate(p, [0, 1], [-36, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: FONT.sans, fontSize: 16, fontWeight: 700, color: BRAND.ink }}>{title}</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 12, color: BRAND.muted, marginTop: 6 }}>{note}</div>
      </div>
    );
  };

  const lane1 = atCueLinear(cues, "lane1", 30, 0.05);
  const lane2 = atCueLinear(cues, "lane2", 30, 0.45);
  const storage = atCueLinear(cues, "storage", 30, 0.8);
  const note = atCueLinear(cues, "note", 34, 0.92);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.032}>
        <div style={{ position: "absolute", left: 120, top: 128, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Arsitektur
        </div>

        <div style={{ position: "absolute", left: 120, top: 206, width: 1680, height: 244, background: BRAND.sunk, border: `1.5px solid ${BRAND.rule}`, borderRadius: 5, opacity: lane1 }} />
        <div style={{ position: "absolute", left: 146, top: 228, fontFamily: FONT.mono, fontSize: 11, color: BRAND.ink2, letterSpacing: "0.1em", opacity: lane1 }}>
          MODE CLOUDFLARE · TERKELOLA
        </div>
        {node(150, 276, 300, "React 19 + Vite", "dist/ statis", "a0", true)}
        {node(510, 276, 340, "Cloudflare Worker", "Hono · API + auth", "a1", true)}
        {node(910, 258, 320, "D1 · SQLite", "BLOB bukti · audit", "a2")}
        {node(910, 344, 320, "WebCrypto", "SHA-256 · HMAC · Ed25519", "a3")}

        <div style={{ position: "absolute", left: 120, top: 486, width: 1680, height: 244, background: BRAND.sunk, border: `1.5px solid ${BRAND.rule}`, borderRadius: 5, opacity: lane2 }} />
        <div style={{ position: "absolute", left: 146, top: 508, fontFamily: FONT.mono, fontSize: 11, color: BRAND.ink2, letterSpacing: "0.1em", opacity: lane2 }}>
          MODE ON-PREMISE · OFFLINE
        </div>
        {node(150, 556, 300, "React 19 + Vite", "dist/ dilayani Node", "b0", true)}
        {node(510, 556, 340, "Node + Hono", "@hono/node-server", "b1", true)}
        {node(910, 538, 320, "node:sqlite", "shim antarmuka D1", "b2")}
        {node(910, 624, 320, "filesystem", "evidence/ · hingga 50 MB", "b3")}

        {[
          [462, 324, "a0"],
          [862, 324, "a1"],
          [462, 604, "b0"],
          [862, 604, "b1"],
        ].map(([x, y, c], i) => {
          const d = atCueLinear(cues, c as string, 18, 0.3);
          return (
            <svg key={i} width="52" height="20" style={{ position: "absolute", left: x as number, top: y as number, opacity: d }}>
              <line x1="0" y1="10" x2={38 * d} y2="10" stroke={BRAND.accent} strokeWidth="2" />
            </svg>
          );
        })}

        <div
          style={{
            position: "absolute",
            right: 128,
            top: 292,
            width: 248,
            padding: "16px 16px",
            background: "#fff",
            border: `1.5px solid ${BRAND.rule}`,
            borderRadius: 4,
            opacity: storage,
            transform: `scale(${interpolate(storage, [0, 1], [0.94, 1])})`,
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: BRAND.ink }}>EvidenceStorage</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 11, color: BRAND.muted, marginTop: 8, lineHeight: 1.6 }}>
            put / get / delete
            <br />
            900 KB · D1
            <br />
            50 MB · disk
          </div>
        </div>

        <div style={{ position: "absolute", left: 120, bottom: 62, fontFamily: FONT.sans, fontSize: 19, color: BRAND.muted, opacity: note }}>
          Satu Worker, satu basis data, tanpa layanan eksternal dan tanpa panggilan keluar saat runtime.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 10. graph */
export const Graph: React.FC<{ cues: Cues }> = ({ cues }) => {
  const nodes = [
    { id: "INC-2026-001", x: 470, y: 690, score: 100, color: BRAND.signal, c: "n0" },
    { id: "INC-2026-002", x: 470, y: 468, score: 100, color: BRAND.signal, c: "n1" },
    { id: "INC-2026-003", x: 470, y: 292, score: 58, color: BRAND.accent, c: "n1" },
    { id: "INC-2026-004", x: 470, y: 128, score: 0, color: BRAND.faint, c: "iso" },
  ];
  const inds = [
    { id: "kartika-supply.example", x: 1250, y: 176, c: "n2" },
    { id: "keuangan@kartika-supply", x: 1250, y: 470, c: "n2" },
    { id: "90ea3e77…a7c", x: 1250, y: 690, c: "n2" },
  ];
  const edges = [
    [0, 0, "e0"],
    [1, 0, "e0"],
    [2, 0, "e1"],
    [0, 2, "e1"],
    [1, 1, "e2"],
    [2, 1, "e2"],
    [3, 0, "iso"],
  ];
  const note = atCueLinear(cues, "note", 34, 0.9);
  const isoPulse = usePulse();

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 128, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Graf kampanye
        </div>

        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          {edges.map(([n, i, c], k) => {
            const d = atCueLinear(cues, c as string, 34, 0.5);
            const a = nodes[n as number];
            const b = inds[i as number];
            const isolated = a.score === 0;
            return (
              <line
                key={k}
                x1={a.x + 78}
                y1={a.y}
                x2={a.x + 78 + (b.x - 90 - (a.x + 78)) * d}
                y2={a.y + (b.y - a.y) * d}
                stroke={isolated ? BRAND.rule : BRAND.accent}
                strokeWidth={a.score === 100 ? 2.2 : 1.6}
                opacity={(isolated ? 0.2 + isoPulse * 0.2 : 0.55) * (isolated ? 1 : d)}
                strokeDasharray={isolated ? "4 8" : undefined}
              />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const p = atCue(cues, n.c, 0.1, { damping: 165 });
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
                transform: `scale(${p * (n.score === 0 ? 1 + isoPulse * 0.05 : 1)})`,
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
                  fontSize: 18,
                  fontWeight: 600,
                  color: n.color,
                }}
              >
                {n.score}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, color: BRAND.ink, marginTop: 8, whiteSpace: "nowrap" }}>{n.id}</div>
              {n.score === 0 && (
                <div style={{ fontFamily: FONT.sans, fontSize: 11, color: BRAND.faint, marginTop: 3 }}>tidak terkait</div>
              )}
            </div>
          );
        })}

        {inds.map((ind) => {
          const p = atCue(cues, ind.c, 0.2);
          return (
            <div
              key={ind.id}
              style={{ position: "absolute", left: ind.x - 40, top: ind.y - 12, display: "flex", alignItems: "center", gap: 12, opacity: p }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 99, border: `2px solid #3dd6c4`, background: "#fff", flex: "none" }} />
              <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: BRAND.ink2, whiteSpace: "nowrap" }}>{ind.id}</div>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 120, bottom: 66, fontFamily: FONT.sans, fontSize: 20, color: BRAND.muted, opacity: note }}>
          Korelasi adalah petunjuk penyelidikan, bukan bukti atribusi.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 11. TLP */
export const TlpGate: React.FC<{ cues: Cues }> = ({ cues }) => {
  const card = atCue(cues, "card", 0.05, { damping: 190 });
  const approve = atCue(cues, "approve", 0.35, { damping: 160 });
  const gate = atCue(cues, "gate", 0.5, { damping: 13, mass: 0.6 });
  const gatePulse = usePulse();
  const steps = [
    ["l0", "satuan pemilik / koordinator — boleh, tetap tercatat di audit"],
    ["l1", "share_scope restricted — selalu ditolak lintas satuan"],
    ["l2", "TLP RED, AMBER+STRICT — selalu ditolak; approval tidak mengalahkan larangan"],
    ["l3", "TLP AMBER — perlu approval aktif dan belum kedaluwarsa"],
    ["l4", "TLP GREEN, CLEAR — boleh, tunduk pada langkah 2"],
  ];

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient hue="#b83232" opacity={0.06} />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 124, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Approval bukan izin mutlak
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 208,
            width: 700,
            background: "#fff",
            border: `1.5px solid ${BRAND.rule}`,
            borderRadius: 6,
            padding: "24px 26px",
            opacity: card,
            transform: `translateY(${interpolate(card, [0, 1], [28, 0])}px)`,
            boxShadow: "0 28px 60px -34px rgba(18,26,38,0.35)",
          }}
        >
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: BRAND.faint, letterSpacing: "0.1em" }}>
            PERMINTAAN AKSES · BRAVO → ALPHA
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 700, color: BRAND.ink, marginTop: 12 }}>
            Bukti mentah · cakupan raw
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 14,
              color: BRAND.muted,
              marginTop: 10,
              lineHeight: 1.6,
              opacity: atCueLinear(cues, "reason", 28, 0.15),
            }}
          >
            Alasan: tinjauan forensik lampiran email. Masa berlaku tiga hari.
          </div>

          <div
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 15px",
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
            <span style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: BRAND.verify }}>Disetujui koordinator</span>
          </div>
        </div>

        <div style={{ position: "absolute", left: 880, top: 208, width: 860, height: 300, display: "grid", placeItems: "center", opacity: gate }}>
          <div
            style={{
              width: 820,
              border: `2.5px solid ${BRAND.signal}`,
              background: BRAND.signalWash,
              borderRadius: 6,
              padding: "30px 32px",
              transform: `scale(${interpolate(gate, [0, 1], [1.14, 1])})`,
              boxShadow: `0 0 0 ${16 * gate + 7 * gatePulse}px rgba(184,50,50,${0.07 * gate})`,
            }}
          >
            <div style={{ fontFamily: FONT.mono, fontSize: 14, color: BRAND.signal, letterSpacing: "0.14em", fontWeight: 600 }}>TLP:RED</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 28, fontWeight: 800, color: BRAND.signal, marginTop: 10 }}>
              Tetap ditolak lintas satuan
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 16, color: BRAND.ink2, marginTop: 12, lineHeight: 1.6 }}>
              Approval tidak mengalahkan larangan. Artefak <b>restricted</b> dan TLP RED/AMBER+STRICT selalu tertutup, juga
              pada laporan dan ekspor.
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 120, top: 520, width: 1640 }}>
          {steps.map(([c, text], i) => {
            const p = atCueLinear(cues, c as string, 26, 0.55 + i * 0.08);
            return (
              <div
                key={text}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginBottom: 12,
                  opacity: p,
                  transform: `translateX(${interpolate(p, [0, 1], [-16, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: i < 3 ? BRAND.signalWash : BRAND.verifyWash,
                    border: `1px solid ${i < 3 ? BRAND.signal : BRAND.verify}`,
                    color: i < 3 ? BRAND.signal : BRAND.verify,
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: 15.5, color: BRAND.ink2 }}>{text}</div>
              </div>
            );
          })}
        </div>
      </Cam>
      <ProgressRail color="#e0655f" />
    </AbsoluteFill>
  );
};

/* ============================================================ 12. privacy */
export const Privacy: React.FC<{ cues: Cues }> = ({ cues }) => {
  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.035}>
        <div style={{ position: "absolute", left: 120, top: 132, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Cocok tanpa membuka nilai
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 230,
            width: 1100,
            fontFamily: FONT.sans,
            fontSize: 26,
            lineHeight: 1.55,
            color: BRAND.ink2,
            opacity: atCueLinear(cues, "hmac", 34, 0.08),
          }}
        >
          Indikator yang tidak dibagikan tetap dapat dicocokkan lewat HMAC-SHA256 dengan kunci rahasia, bukan salt publik.
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 400,
            padding: "20px 24px",
            background: BRAND.sunk,
            border: `1.5px solid ${BRAND.rule}`,
            borderRadius: 4,
            fontFamily: FONT.mono,
            fontSize: 17,
            color: BRAND.ink,
            opacity: atCueLinear(cues, "formula", 34, 0.3),
            transform: `translateY(${interpolate(atCueLinear(cues, "formula", 34, 0.3), [0, 1], [16, 0])}px)`,
          }}
        >
          blind = "v&lt;version&gt;:&lt;hex&gt;" dari HMAC-SHA256(secret, "v&lt;version&gt;:" + kind + ":" + norm)
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 540,
            width: 1160,
            fontFamily: FONT.sans,
            fontSize: 20,
            lineHeight: 1.6,
            color: BRAND.muted,
            opacity: atCueLinear(cues, "rotate", 34, 0.55),
          }}
        >
          Rotasi menaikkan versi, menghitung ulang seluruh hash, dan menyimpan hash generasi sebelumnya di
          <span style={{ fontFamily: FONT.mono, color: BRAND.ink2 }}> blind_hash_prev</span>, sehingga perbandingan lama
          tidak langsung putus.
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 96,
            width: 1500,
            padding: "18px 22px",
            background: BRAND.cautionWash,
            border: `1.5px solid ${BRAND.caution}`,
            borderRadius: 4,
            fontFamily: FONT.sans,
            fontSize: 17,
            color: BRAND.ink2,
            lineHeight: 1.55,
            opacity: atCueLinear(cues, "limit", 34, 0.8),
          }}
        >
          Batas: pencocokan buta mengungkap kesamaan, bukan melindungi dari tebakan kamus. Kunci adalah rahasia
          organisasi, bukan salt yang boleh dipublikasikan.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 13. proof */
export const Proof: React.FC<{ cues: Cues }> = ({ cues }) => {
  const metrics = [
    { c: "m0", value: "24", label: "PEMERIKSAAN KEAMANAN", note: "verify.ps1 — seluruhnya lulus" },
    { c: "m1", value: "48", label: "BUTIR UJI FRONTEND", note: "Chrome & Firefox, 0 pelanggaran WCAG" },
    { c: "m2", value: "900", label: "PASANGAN BENAR", note: "400 insiden, 600 sampel negatif" },
    { c: "m3", value: "0.000", label: "FALSE POSITIVE RATE", note: "tanpa tautan silang CDN" },
  ];
  const bullets = [
    ["b0", "Uji manipulasi rantai: entri yang diubah terdeteksi tepat di nomornya."],
    ["b1", "ZIP bomb ditolak oleh batas keamanan arsip."],
    ["b2", "Kasus jujur: hash sama pada kampanye tak terkait masih terhubung — dilaporkan, bukan disembunyikan."],
  ];

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.032}>
        <div style={{ position: "absolute", left: 120, top: 124, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Semua klaim bisa diperiksa
        </div>

        <div style={{ position: "absolute", left: 120, top: 208, display: "flex", gap: 18, width: 1680 }}>
          {metrics.map((m, i) => {
            const p = atCue(cues, m.c, 0.1 + i * 0.13, { damping: 180 });
            return (
              <div
                key={m.label}
                style={{
                  flex: 1,
                  padding: "20px 20px",
                  background: i === 0 ? BRAND.accentWash : "#fff",
                  border: `1.5px solid ${i === 0 ? BRAND.accent : BRAND.rule}`,
                  borderRadius: 4,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px)`,
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: BRAND.muted, letterSpacing: "0.06em" }}>{m.label}</div>
                <div style={{ fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: BRAND.ink, marginTop: 8, letterSpacing: "-0.02em" }}>
                  {m.value}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: BRAND.muted, marginTop: 6, lineHeight: 1.4 }}>{m.note}</div>
              </div>
            );
          })}
        </div>

        <div style={{ position: "absolute", left: 120, top: 470, width: 1640 }}>
          {bullets.map(([c, t], i) => {
            const p = atCueLinear(cues, c as string, 30, 0.6 + i * 0.1);
            return (
              <div key={t} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20, opacity: p }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: BRAND.accent, marginTop: 11, flex: "none" }} />
                <div style={{ fontFamily: FONT.sans, fontSize: 21, color: BRAND.ink2, lineHeight: 1.5 }}>{t}</div>
              </div>
            );
          })}
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 14. feasible */
export const Feasible: React.FC<{ cues: Cues }> = ({ cues }) => {
  const rows = [
    ["b0", "Deploy satu perintah; berjalan sepenuhnya offline bila diperlukan."],
    ["b1", "Untuk volume besar, BLOB D1 diganti object storage; basis data menyimpan hash dan pointer."],
    ["b2", "Sengaja belum ada: sandbox dinamis, impor YARA eksternal, impor STIX."],
    ["b3", "Peta jalan: parser EVTX/pcap, notifikasi approval, rate limiter terdistribusi."],
  ];
  const close = atCueLinear(cues, "close", 34, 0.9);

  return (
    <AbsoluteFill style={shell()}>
      <BrandBar />
      <Ambient />
      <Cam amount={0.032}>
        <div style={{ position: "absolute", left: 120, top: 132, fontFamily: FONT.sans, fontSize: 38, fontWeight: 800, color: BRAND.ink }}>
          Kelayakan penerapan
        </div>

        <div style={{ position: "absolute", left: 120, top: 260, width: 1640 }}>
          {rows.map(([c, t], i) => {
            const p = atCueLinear(cues, c as string, 30, 0.1 + i * 0.17);
            return (
              <div
                key={t}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  marginBottom: 28,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px)`,
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 13, color: BRAND.accent, marginTop: 4, flex: "none", width: 30 }}>
                  0{i + 1}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: 25, color: BRAND.ink2, lineHeight: 1.5 }}>{t}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            bottom: 110,
            width: 1500,
            fontFamily: FONT.sans,
            fontSize: 18,
            color: BRAND.muted,
            opacity: close,
          }}
        >
          Semua itu tidak mengubah kontrak API, sehingga prototipe hari ini bisa tumbuh tanpa ditulis ulang.
        </div>
      </Cam>
      <ProgressRail />
    </AbsoluteFill>
  );
};

/* ============================================================ 15. closing */
export const Closing: React.FC<{ cues: Cues }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  const inScale = interpolate(p, [0, 1], [1.05, 1.0]);
  const h0 = atCue(cues, "h0", 0.04, { damping: 190 });
  const h1 = atCue(cues, "h1", 0.2, { damping: 190 });
  const body = atCueLinear(cues, "body", 34, 0.4);
  const links = atCueLinear(cues, "links", 34, 0.7);
  const attr = atCueLinear(cues, "attr", 34, 0.86);

  return (
    <AbsoluteFill style={shell(true)}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${inScale})`, transformOrigin: "50% 42%" }}>
        <BrandBar />
        <Ambient hue="#4f8cff" opacity={0.17} />
        <div style={{ position: "absolute", left: 120, top: 296, width: 1600 }}>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.18,
              color: "#fff",
              opacity: h0,
              transform: `translateY(${interpolate(h0, [0, 1], [34, 0])}px)`,
            }}
          >
            RANTAI tidak menggantikan Kartika CSIRT.
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.18,
              color: "#8fa2ba",
              opacity: h1,
              transform: `translateY(${interpolate(h1, [0, 1], [34, 0])}px)`,
            }}
          >
            Ia menambahkan kemampuan yang belum ada.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 120,
            top: 600,
            fontFamily: FONT.sans,
            fontSize: 22,
            color: "#9fb0ca",
            maxWidth: 1160,
            lineHeight: 1.6,
            opacity: body,
          }}
        >
          Menyatukan laporan lintas satuan, menjaga bukti tetap bisa dipercaya, dan membuat keputusan analis bisa
          dipertanggungjawabkan.
        </div>

        <div style={{ position: "absolute", left: 120, bottom: 128, display: "flex", flexDirection: "column", gap: 10, opacity: links }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 20, color: "#6fa4f0" }}>rantai.careday17.workers.dev</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 15, color: "#8fa2ba" }}>github.com/symful/kartika-cyber-hackathon-2026</div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 120,
            bottom: 128,
            textAlign: "right",
            fontFamily: FONT.sans,
            fontSize: 12.5,
            color: "#7d90ad",
            lineHeight: 1.7,
            maxWidth: 480,
            opacity: attr,
          }}
        >
          Data pelatihan sintetis.
          <br />
          Profil kampanye merujuk pada advisory publik CISA AA23-341A.
        </div>
      </div>
      <ProgressRail color="#4f8cff" />
      <Grain opacity={0.07} />
      <Vignette />
    </AbsoluteFill>
  );
};
