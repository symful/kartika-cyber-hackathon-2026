import { Composition, registerRoot } from "remotion";
import React from "react";
import { Rantai } from "./Rantai";
import timing from "../timing.json";

const T = timing as { fps: number; totalFrames: number };

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Rantai"
    component={Rantai}
    durationInFrames={T.totalFrames}
    fps={T.fps}
    width={1920}
    height={1080}
  />
);

registerRoot(RemotionRoot);
