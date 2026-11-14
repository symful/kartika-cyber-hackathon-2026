import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import timing from "../timing.json";
import cues from "../cues.json";
import {
  Architecture,
  Closing,
  ColdOpen,
  Feasible,
  Graph,
  Integrity,
  Pipeline,
  Privacy,
  Problem,
  Proof,
  ScoreBands,
  ShotScene,
  TlpGate,
  Values,
  Weights,
} from "./scenes";

type Timing = { index: number; kind: string; frames: number; audio: string };
const T = timing as { fps: number; totalFrames: number; scenes: Timing[] };
const C = cues as { fps: number; scenes: { index: number; kind: string; frames: number; cues: Record<string, number> }[] };

type Cues = Record<string, number>;

const SHOT_PROPS: Record<number, { src: string; title: string; caption: string; highlight?: number[] }> = {
  4: { src: "shots/01-login.png", title: "Masuk ke ruang kerja", caption: "Tiga akun satuan: Alpha, Bravo, dan koordinator." },
  5: {
    src: "shots/02-dashboard.png",
    title: "Ringkasan operasi",
    caption: "Empat metrik, distribusi severity, tren laporan, matriks severity × status, dan sebaran band korelasi.",
    highlight: [0.675, 0.405, 0.315, 0.275],
  },
  6: {
    src: "shots/03-incident-list.png",
    title: "Daftar laporan",
    caption: "Pencarian dan filter severity dikerjakan di sisi server, sesuai hak akses satuan.",
    highlight: [0.165, 0.215, 0.815, 0.285],
  },
  7: {
    src: "shots/04-incident-detail.png",
    title: "Detail insiden",
    caption: "Profil kampanye, pemetaan ATT&CK dengan artefak pendukung, dan komposisi indikator.",
    highlight: [0.165, 0.395, 0.665, 0.175],
  },
  8: {
    src: "shots/05-evidence-vault.png",
    title: "Bukti dan integritasnya",
    caption: "Hash dihitung saat diterima, dihitung ulang dari isi tersimpan, lalu ditandai bila cocok.",
  },
  9: {
    src: "shots/06-evidence-passport.png",
    title: "Passport artefak",
    caption: "Static analysis, aturan yang cocok, verdict, dan chain of custody per artefak.",
  },
  15: {
    src: "shots/10-audit-integrity.png",
    title: "Verifikasi dan uji manipulasi",
    caption: "Status rantai, checkpoint Ed25519, uji manipulasi, dan catatan audit terbaru.",
    highlight: [0.175, 0.175, 0.32, 0.255],
  },
};

const renderScene = (index: number, kind: string, sceneCues: Cues): React.ReactNode => {
  const shot = SHOT_PROPS[index];
  switch (kind) {
    case "coldopen":
      return <ColdOpen cues={sceneCues} />;
    case "problem":
      return <Problem cues={sceneCues} />;
    case "values":
      return <Values cues={sceneCues} />;
    case "pipeline":
      return <Pipeline cues={sceneCues} />;
    case "weights":
      return <Weights cues={sceneCues} />;
    case "scores":
      return <ScoreBands cues={sceneCues} />;
    case "graph":
      return <Graph cues={sceneCues} />;
    case "tlp":
      return <TlpGate cues={sceneCues} />;
    case "integrity":
      return <Integrity cues={sceneCues} />;
    case "privacy":
      return <Privacy cues={sceneCues} />;
    case "architecture":
      return <Architecture cues={sceneCues} />;
    case "proof":
      return <Proof cues={sceneCues} />;
    case "feasible":
      return <Feasible cues={sceneCues} />;
    case "closing":
      return <Closing cues={sceneCues} />;
    case "shot":
      return shot ? <ShotScene cues={sceneCues} {...shot} /> : null;
    default:
      return null;
  }
};

export const Rantai: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: "#202a36" }}>
      {T.scenes.map((s) => {
        const from = cursor;
        cursor += s.frames;
        const cueEntry = C.scenes.find((c) => c.index === s.index);
        const sceneCues: Cues = cueEntry?.cues ?? {};
        return (
          <Sequence key={s.index} from={from} durationInFrames={s.frames} name={`${s.index}-${s.kind}`}>
            {renderScene(s.index, s.kind, sceneCues)}
            <Audio src={staticFile(`vo/${s.audio}`)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
