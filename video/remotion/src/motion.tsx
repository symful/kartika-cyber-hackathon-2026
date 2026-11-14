import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Motion toolkit.
 *
 * The failure mode this exists to prevent: everything animating in during the
 * first 3 seconds and then sitting still for the remaining 20. Every helper here
 * is duration-aware so motion is spread across a whole scene.
 */

/** Normalised progress through the current scene: 0 at the first frame, 1 at the last. */
export const useProgress = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
};

/** Progress between two normalised points of the scene, clamped to 0..1. */
export const useWindow = (from: number, to: number) => {
  const p = useProgress();
  return interpolate(p, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Eased window (ease-out cubic) for reveals that should feel deliberate. */
export const useEase = (from: number, to: number) => {
  const t = useWindow(from, to);
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Continuous camera move across the entire scene. Slow enough to feel like a
 * camera, not a zoom effect. `amount` is total scale delta.
 */
export const useCamera = (amount = 0.075, driftY = -18) => {
  const p = useProgress();
  const e = interpolate(p, [0, 1], [0, 1]);
  return {
    scale: 1 + amount * e,
    x: 0,
    y: driftY * e,
  };
};

/** Gentle idle float so nothing is ever pixel-still. */
export const useFloat = (amplitude = 6, speed = 0.045, phase = 0) => {
  const frame = useCurrentFrame();
  return Math.sin(frame * speed + phase) * amplitude;
};

/** Slow breathing pulse for emphasis dots, rings, counters. */
export const usePulse = (speed = 0.055, phase = 0) => {
  const frame = useCurrentFrame();
  return 0.5 + 0.5 * Math.sin(frame * speed + phase);
};

/** Spring that starts at a normalised point of the scene, so order can be spread out. */
export const useSceneSpring = (
  at: number,
  config: { damping?: number; mass?: number; stiffness?: number } = {},
  delayFrames = 0,
) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const start = Math.round(at * durationInFrames) + delayFrames;
  return spring({
    frame: frame - start,
    fps,
    config: { damping: config.damping ?? 180, mass: config.mass ?? 0.7, stiffness: config.stiffness },
  });
};

/** Count a value up, starting at a normalised scene position. */
export const useSceneCount = (to: number, at: number, span = 0.22) => {
  const v = useEase(at, Math.min(1, at + span));
  return to * v;
};

/** Draw-on progress for SVG strokes. */
export const useDraw = (at: number, span = 0.3) => useEase(at, Math.min(1, at + span));

/** Type-on text: returns the substring revealed so far. */
export const useTyped = (text: string, at: number, span = 0.3) => {
  const t = useEase(at, Math.min(1, at + span));
  const n = Math.round(text.length * t);
  return { shown: text.slice(0, n), done: n >= text.length, progress: t };
};

/** Convenience: staggered reveal delays (in frames) for list items. */
export const stagger = (i: number, per = 9, base = 0) => base + i * per;

/** Minimal ambient background motion: soft moving glow, used on every scene. */
export const Ambient: React.FC<{ hue?: string; opacity?: number }> = ({
  hue = "#1866db",
  opacity = 0.1,
}) => {
  const p = useProgress();
  const x = interpolate(p, [0, 1], [18, 82]);
  const y = interpolate(p, [0, 1], [24, 72]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(60% 55% at ${x}% ${y}%, ${hue}22 0%, transparent 70%)`,
        opacity,
      }}
    />
  );
};

/** Thin progress rail at the very bottom of the frame; cheap sense of momentum. */
export const ProgressRail: React.FC<{ color?: string }> = ({ color = "#1866db" }) => {
  const p = useProgress();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,0.06)" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: color, opacity: 0.55 }} />
    </div>
  );
};
