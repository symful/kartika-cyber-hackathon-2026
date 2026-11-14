import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import timing from "../timing.json";
import {
  Architecture,
  Closing,
  ColdOpen,
  Graph,
  Integrity,
  Pipeline,
  Problem,
  ScoreBands,
  ShotScene,
  TlpGate,
  Values,
  Weights,
} from "./scenes";

type Scene = { index: number; kind: string; frames: number; seconds: number; audio: string };
const T = timing as { fps: number; totalFrames: number; scenes: Scene[] };

/** One entry per scene in video/scenes.json, in the same order. */
const SCENE_COMPONENTS: React.FC[] = [
  ColdOpen,     // 01 title
  Values,       // 02 bullets
  ShotScene,    // 03 login
  ShotScene,    // 04 dashboard
  ShotScene,    // 05 incident list
  ShotScene,    // 06 incident detail
  ShotScene,    // 07 evidence vault
  ShotScene,    // 08 passport
  Pipeline,     // 09 correlation diagram
  ScoreBands,   // 10 score bands diagram
  Graph,        // 11 correlation graph
  TlpGate,      // 12 access / TLP
  Integrity,    // 13 integrity diagram
  ShotScene,    // 14 audit integrity
  Architecture, // 15 architecture
  Closing,      // 16 closing
];

const SHOT_PROPS: Record<number, { src: string; title: string; caption: string; highlight?: number[] }> = {
  3: { src: "shots/01-login.png", title: "Masuk ke ruang kerja", caption: "Tiga akun satuan: Alpha, Bravo, dan koordinator." },
  4: {
    src: "shots/02-dashboard.png",
    title: "Ringkasan operasi",
    caption: "Matriks severity × status dan sebaran band korelasi memberi gambaran satu kampanye dalam satu pandangan.",
    highlight: [0.675, 0.405, 0.315, 0.275],
  },
  5: {
    src: "shots/03-incident-list.png",
    title: "Daftar laporan",
    caption: "Cari, saring menurut severity, dan lihat skor korelasi tertinggi per laporan.",
    highlight: [0.165, 0.215, 0.815, 0.285],
  },
  6: {
    src: "shots/04-incident-detail.png",
    title: "Detail insiden",
    caption: "Profil kampanye, pemetaan ATT&CK, dan komposisi indikator menurut jenis.",
    highlight: [0.165, 0.395, 0.665, 0.175],
  },
  7: {
    src: "shots/05-evidence-vault.png",
    title: "Bukti dan integritasnya",
    caption: "Unggah multi-berkas, status verifikasi, hash, dan penanda duplikat lintas kasus.",
  },
  8: {
    src: "shots/06-evidence-passport.png",
    title: "Passport artefak",
    caption: "Static analysis, aturan yang cocok, verdict, dan chain of custody per artefak.",
  },
  11: {
    src: "shots/09-correlation-graph.png",
    title: "Graf kampanye",
    caption: "Simpul insiden dan indikator bersama. Yang tidak terkait tetap terpisah.",
  },
  12: {
    src: "shots/08-access-approvals.png",
    title: "Akses dan TLP",
    caption: "Approval tidak mengalahkan larangan: TLP:RED tetap tertutup.",
  },
  14: {
    src: "shots/10-audit-integrity.png",
    title: "Verifikasi dan uji manipulasi",
    caption: "Ubah satu entri, dan verifikasi menunjuk tepat entri yang rusak.",
    highlight: [0.175, 0.175, 0.32, 0.255],
  },
};

const sceneFor = (index: number): React.ReactNode => {
  const Comp = SCENE_COMPONENTS[index - 1];
  if (!Comp) return null;
  if (Comp === ShotScene) {
    const props = SHOT_PROPS[index];
    return props ? <ShotScene {...props} /> : null;
  }
  return <Comp />;
};

export const Rantai: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: "#202a36" }}>
      {T.scenes.map((s) => {
        const from = cursor;
        cursor += s.frames;
        return (
          <Sequence key={s.index} from={from} durationInFrames={s.frames} name={`scene-${s.index}-${s.kind}`}>
            {sceneFor(s.index)}
            <Audio src={staticFile(`vo/${s.audio}`)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
