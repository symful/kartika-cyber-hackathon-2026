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
  TlpGate,
  Values,
  Weights,
} from "./scenes";
import { SurfaceScene } from "./surfaces";

type Timing = { index: number; kind: string; title?: string; frames: number; audio: string };
const T = timing as { fps: number; totalFrames: number; scenes: Timing[] };
const C = cues as unknown as { fps: number; scenes: { index: number; kind: string; frames: number; cues: Record<string, number> }[] };

type Cues = Record<string, number>;

/**
 * Screenshot scenes are replaced by recreated surfaces.
 *
 * Looked up by scene *title*, not by index: the scene order changed once already
 * and an index-keyed map silently produced blank frames.
 */
const SURFACES: Record<string, { kind: "login" | "dashboard" | "evidence"; title: string; caption: string }> = {
  "Masuk ke ruang kerja": {
    kind: "login",
    title: "Masuk ke ruang kerja",
    caption: "Tiga akun satuan · sesi 8 jam · cookie HttpOnly",
  },
  "Ringkasan operasi": {
    kind: "dashboard",
    title: "Ringkasan operasi",
    caption: "Metrik, severity, tren, dan band korelasi dalam satu pandangan",
  },
  "Bukti dan integritasnya": {
    kind: "evidence",
    title: "Bukti dan integritasnya",
    caption: "Hash saat diterima, dihitung ulang, lalu ditandai bila cocok",
  },
};

const renderScene = (title: string, kind: string, sceneCues: Cues): React.ReactNode => {
  const surface = SURFACES[title];
  if (surface) return <SurfaceScene {...surface} />;

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
        return (
          <Sequence key={s.index} from={from} durationInFrames={s.frames} name={`${s.index}-${s.kind}`}>
            {renderScene(s.title ?? "", s.kind, cueEntry?.cues ?? {})}
            <Audio src={staticFile(`vo/${s.audio}`)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
