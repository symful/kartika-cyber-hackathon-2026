"""Full narration render with F5-TTS Indonesian fine-tune v2.

Loads the model once, generates every scene from video/scenes.json, masters each
track, and emits timing.json for Remotion. CPU-only, so this is meant to run as a
background job.

Reference voice: `ref_prabowo` (male, formal oratorical) — the register a security
brief is usually delivered in. F5 clones prosody from the clip, which is what makes
the delivery carry intonation instead of reading flat.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

def _patch_torchaudio():
    """torchaudio 2.15 routes load() through torchcodec, which needs FFmpeg DLLs
    that are absent on this machine. soundfile reads the same WAVs."""
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
RAW = VIDEO / "audio" / "f5-raw"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)

FPS = 30
TAIL = 0.55
LEAD_IN = 0.35
SR = 48000

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


def duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def main():
    scenes = json.loads((VIDEO / "scenes.json").read_text(encoding="utf-8"))

    from f5_tts.api import F5TTS

    print("loading F5-TTS (cpu)...", flush=True)
    t0 = time.time()
    f5 = F5TTS(
        model="F5TTS_v1_Base",
        ckpt_file=str(MODEL),
        vocab_file=str(VOCAB),
        device="cpu",
        use_ema=True,
    )
    print(f"model ready in {time.time()-t0:.1f}s", flush=True)

    timing = []
    for i, sc in enumerate(scenes, 1):
        raw = RAW / f"raw-{i:02d}.wav"
        if raw.exists() and raw.stat().st_size > 1000:
            print(f"[{i:02d}] cached, skipping synthesis", flush=True)
        else:
            print(f"[{i:02d}] synthesising ({len(sc['vo'])} chars)...", flush=True)
            t = time.time()
            f5.infer(
                ref_file=str(REF_WAV),
                ref_text=REF_TEXT,
                gen_text=sc["vo"],
                file_wave=str(raw),
                speed=1.0,
                show_info=lambda *a, **k: None,
            )
            print(f"[{i:02d}] done in {time.time()-t:.0f}s", flush=True)

        mastered = OUT / f"vo-{i:02d}.wav"
        ff(["-i", str(raw), "-af", MASTER, "-ar", str(SR), "-ac", "1", str(mastered)], "master")

        d = duration(mastered)
        frames = round((d + TAIL) * FPS)
        timing.append({
            "index": i,
            "kind": sc["kind"],
            "frames": frames,
            "seconds": round(frames / FPS, 3),
            "audio": f"vo-{i:02d}.wav",
        })
        print(f"[{i:02d}] {frames}f  {frames/FPS:.2f}s", flush=True)

    total = sum(t["frames"] for t in timing)
    (VIDEO / "timing.json").write_text(
        json.dumps({"fps": FPS, "totalFrames": total, "scenes": timing}, indent=2),
        encoding="utf-8",
    )

    # Pad each track to its exact budget so the concatenated voice stays in sync.
    parts = VIDEO / "audio" / "_pad"
    parts.mkdir(parents=True, exist_ok=True)
    padded = []
    for t in timing:
        src = OUT / t["audio"]
        dst = parts / f"pad-{t['index']:02d}.wav"
        secs = t["frames"] / FPS
        ff(["-i", str(src), "-af",
            f"apad=whole_dur={secs:.6f},atrim=0:{secs:.6f}",
            "-ar", str(SR), "-ac", "1", str(dst)], "pad")
        padded.append(dst)

    lst = parts / "list.txt"
    lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in padded), encoding="utf-8")
    ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-ar", str(SR), "-ac", "1",
        str(OUT / "voice-full.wav")], "concat")

    print(f"TOTAL {total} frames = {total/FPS/60:.2f} min", flush=True)
    print("narration render complete", flush=True)


if __name__ == "__main__":
    main()
