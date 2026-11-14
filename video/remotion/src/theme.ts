import { loadFont } from "@remotion/google-fonts/Archivo";

export const BRAND = {
  navy: "#2c3644",
  navyDeep: "#222b36",
  ink: "#202a36",
  ink2: "#354152",
  muted: "#55647a",
  faint: "#637286",
  rule: "#e1e5ea",
  paper: "#ffffff",
  sunk: "#f7f9fc",
  accent: "#1866db",
  accentDeep: "#1456b8",
  accentWash: "#e8f0fe",
  signal: "#b83232",
  signalWash: "#fdeceb",
  verify: "#2c6f52",
  verifyWash: "#e6f4ee",
  caution: "#8a5810",
  cautionWash: "#fdf3e2",
  orange: "#a9541f",
  gold: "#7d5c0f",
};

export const FONT = {
  sans: 'Archivo, "Helvetica Neue", Arial, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Consolas, monospace',
};

// Weights used in the app; kept in sync so slides and product screenshots agree.
export const WEIGHTS = [
  { label: "SHA-256 berkas", value: 100 },
  { label: "Alamat email", value: 45 },
  { label: "Domain", value: 40 },
  { label: "Alamat IP", value: 35 },
  { label: "URL", value: 30 },
  { label: "MD5", value: 25 },
  { label: "Domain lookalike", value: 20 },
  { label: "Nama berkas", value: 15 },
];

export const SCORES = [
  { label: "INC-2026-001 ↔ -002", value: 100, band: "KUAT", color: BRAND.accent, note: "hash lampiran, domain, URL, waktu" },
  { label: "INC-2026-001 ↔ -003", value: 58, band: "SEDANG", color: BRAND.orange, note: "email pengirim, domain, waktu" },
  { label: "INC-2026-002 ↔ -003", value: 28, band: "LEMAH", color: BRAND.gold, note: "domain saja" },
  { label: "INC-2026-004 ↔ semua", value: 0, band: "TIDAK ADA", color: BRAND.faint, note: "tanpa indikator bersama" },
];
