"""Build narration with per-sentence timing, then derive visual cues from it.

The core fix: visuals must be triggered by *when a sentence is spoken*, not by a
scene's total duration. This script synthesises every sentence separately, measures
its exact duration, and emits cues.json mapping each named cue to a frame offset
inside its scene.

Output:
  video/cues.json        per-scene cue -> frame map (consumed by Remotion)
  video/timing.json      scene frame counts (consumed by the composition)
  video/out/vo-NN.wav    mastered scene tracks
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import soundfile as sf
import torch


def _patch_torchaudio():
    import torchaudio

    def _load(path, *args, **kwargs):
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr

    torchaudio.load = _load


_patch_torchaudio()

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"
MODEL = VIDEO / "models" / "f5-indo" / "f5_tts_indo_v2.pt"
VOCAB = VIDEO / "models" / "f5-indo" / "vocab.txt"
REF_WAV = VIDEO / "models" / "f5-indo" / "ref_prabowo.wav"
REF_TEXT = "Selamat pagi, salam sejahtera bagi kita sekalian."

OUT = VIDEO / "out"
RAW = VIDEO / "audio" / "sent"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)

FPS = 30
SR = 48000
LEAD = 0.30          # silence before the first sentence
SENT_GAP = 0.18      # pause between sentences
TAIL = 0.75          # breathing room after the last sentence

MASTER = ",".join([
    f"aresample={SR}",
    "highpass=f=85",
    "equalizer=f=180:t=q:w=1.0:g=1.2",
    "equalizer=f=2900:t=q:w=1.3:g=2.2",
    "deesser=i=0.3",
    "acompressor=threshold=-20dB:ratio=2.4:attack=12:release=240:makeup=2.0",
    "alimiter=limit=0.94",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
])


def ff(args, desc):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg failed ({desc}):\n{r.stderr}")


def dur(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def main():
    spec = json.loads((VIDEO / "narration-short.json").read_text(encoding="utf-8"))
    scenes = spec["scenes"]
    speed = float(spec.get("speed", 1.0))
    print(f"speed: {speed}", flush=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}", flush=True)

    from f5_tts.api import F5TTS

    print("loading F5-TTS ...", flush=True)
    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(MODEL), vocab_file=str(VOCAB),
               device=device, use_ema=True)

    timing, cues_out = [], []

    for si, sc in enumerate(scenes, 1):
        cue_frames: dict[str, int] = {}
        parts: list[Path] = []

        # Lead-in silence so the first cue is not on frame 0.
        lead = RAW / f"s{si:02d}_lead.wav"
        ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{LEAD}", str(lead)], "lead")
        parts.append(lead)

        t = LEAD
        for k, s in enumerate(sc["sentences"]):
            raw = RAW / f"s{si:02d}_{k:02d}.wav"
            if not raw.exists() or raw.stat().st_size < 2000:
                print(f"[{si:02d}.{k}] synth: {s['text'][:44]}...", flush=True)
                t0 = time.time()
                f5.infer(ref_file=str(REF_WAV), ref_text=REF_TEXT, gen_text=s["text"],
                         file_wave=str(raw), speed=speed, show_info=lambda *a, **kw: None)
                print(f"       {time.time()-t0:.0f}s", flush=True)
            d = dur(raw)

            cue_frames[s["cue"]] = round(t * FPS)
            parts.append(raw)
            t += d

            gap = RAW / "_gap.wav"
            ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{SENT_GAP}", str(gap)], "gap")
            parts.append(gap)
            t += SENT_GAP

        total = t + TAIL
        frames = round(total * FPS)

        # Concatenate this scene's sentences, then master as one track.
        lst = RAW / f"list{si:02d}.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
        joined = RAW / f"joined{si:02d}.wav"
        ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-ar", str(SR), "-ac", "1", str(joined)], "concat")

        tail = RAW / "_tail.wav"
        ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{TAIL}", str(tail)], "tail")
        lst2 = RAW / f"list2-{si:02d}.txt"
        lst2.write_text(f"file '{joined.as_posix()}'\nfile '{tail.as_posix()}'", encoding="utf-8")
        padded = RAW / f"padded{si:02d}.wav"
        ff(["-f", "concat", "-safe", "0", "-i", str(lst2), "-ar", str(SR), "-ac", "1", str(padded)], "pad")

        mastered = OUT / f"vo-{si:02d}.wav"
        ff(["-i", str(padded), "-af", MASTER, "-ar", str(SR), "-ac", "1", str(mastered)], "master")
        ff(["-i", str(mastered), "-af",
            f"apad=whole_dur={frames/FPS:.6f},atrim=0:{frames/FPS:.6f}",
            "-ar", str(SR), "-ac", "1", str(mastered.with_suffix(".pad.wav"))], "fit")
        (mastered.with_suffix(".pad.wav")).replace(mastered)

        timing.append({"index": si, "kind": sc["kind"], "frames": frames,
                       "seconds": round(frames / FPS, 3), "audio": f"vo-{si:02d}.wav"})
        cues_out.append({"index": si, "kind": sc["kind"], "frames": frames, "cues": cue_frames})
        print(f"[{si:02d}] {sc['kind']:<12} {len(sc['sentences'])} sentences  {frames}f  {frames/FPS:6.2f}s", flush=True)

    total_frames = sum(t["frames"] for t in timing)
    (VIDEO / "timing.json").write_text(
        json.dumps({"fps": FPS, "totalFrames": total_frames, "scenes": timing}, indent=2), encoding="utf-8")
    (VIDEO / "cues.json").write_text(
        json.dumps({"fps": FPS, "scenes": cues_out}, indent=2), encoding="utf-8")

    print(f"\nTOTAL {total_frames} frames = {total_frames/FPS/60:.2f} min", flush=True)


if __name__ == "__main__":
    main()
