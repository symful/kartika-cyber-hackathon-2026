import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, FONT } from "./theme";

/** Film grain + vignette, drawn as static SVG noise so it costs nothing per frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "multiply" }}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.16) 100%)",
    }}
  />
);

/** Brand bar used on every scene; slides in from the left on entry. */
export const BrandBar: React.FC<{ dark?: boolean; meta?: string[] }> = ({ dark, meta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const x = interpolate(p, [0, 1], [-60, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 96,
        background: BRAND.navy,
        display: "flex",
        alignItems: "center",
        padding: "0 56px",
        transform: `translateX(${x}px)`,
        opacity: p,
        borderBottom: `1px solid rgba(255,255,255,0.07)`,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 11,
          background: BRAND.accent,
          display: "grid",
          placeItems: "center",
          marginRight: 16,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9">
          <path d="M12 3l7.5 3v5.2c0 4.7-3.1 8.3-7.5 10.3-4.4-2-7.5-5.6-7.5-10.3V6L12 3z" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 27,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "0.16em",
          }}
        >
          RANTAI
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10.5,
            color: "#aab6c5",
            letterSpacing: "0.13em",
            marginTop: 2,
          }}
        >
          BERKAS BUKTI &amp; KOORDINASI INSIDEN
        </div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        {(meta ?? ["Kartika Cyber Hackathon 2026", "Kategori Penangkalan"]).map((m, i) => (
          <div
            key={m}
            style={{
              fontFamily: FONT.sans,
              fontSize: 14,
              color: i === 0 ? "#aab6c5" : "#8c98a8",
              marginTop: i ? 3 : 0,
            }}
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Slow, always-on camera move so nothing ever sits still. */
export const useDrift = (amount = 0.012) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames);
  return {
    scale: 1 + t * amount,
    translateY: -t * amount * 260,
  };
};

/** Counts a number up with easing; used for every metric on screen. */
export const useCount = (to: number, delayFrames = 0, durationFrames = 34) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = Math.max(1, durationFrames);
  const v = interpolate(frame - delayFrames, [0, d], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  return v;
};

export const captionStyle: React.CSSProperties = {
  position: "absolute",
  left: 120,
  bottom: 96,
  fontFamily: FONT.sans,
  fontSize: 25,
  color: BRAND.muted,
  maxWidth: 1300,
  lineHeight: 1.45,
};

export const keyNumberStyle = (color: string): React.CSSProperties => ({
  fontFamily: FONT.mono,
  fontWeight: 600,
  color,
});

/** Browser chrome wrapper: screenshots never appear naked. */
export const BrowserFrame: React.FC<{
  src: string;
  scale?: number;
  tilt?: number;
  push?: number;
  children?: React.ReactNode;
}> = ({ src, scale = 1, tilt = 0, push = 0, children }) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "52%",
      transform: `translate(-50%, -50%) scale(${scale}) perspective(2400px) rotateY(${tilt}deg)`,
      width: 1520,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 42px 90px -24px rgba(18,26,38,0.42), 0 8px 24px -8px rgba(18,26,38,0.2)",
      border: `1px solid ${BRAND.rule}`,
      background: "#fff",
    }}
  >
    <div
      style={{
        height: 42,
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
      <img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
      {children}
    </div>
  </div>
);
