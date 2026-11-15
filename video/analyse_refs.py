"""Measure the prosody of each reference clip.

"Sad" or "flat" delivery is not subjective in a useful way — it shows up as:
  - low median F0 (pitch)
  - small F0 range (little melodic movement)
  - low energy variance (even loudness, no emphasis)
  - high proportion of falling phrase endings

This scores each candidate reference so the choice is evidence-based.
"""
import subprocess
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "video" / "models" / "f5-indo"

CLIPS = {
    "prabowo (formal, ceremonial)": D / "ref_prabowo.wav",
    "reporter (news read)": D / "ref_reporter.wav",
    "windah (casual, conversational)": D / "ref_windah.wav",
}


def analyse(path: Path):
    y, sr = librosa.load(str(path), sr=24000, mono=True)
    # trim silence so metrics describe speech, not pauses
    y, _ = librosa.effects.trim(y, top_db=30)
    if len(y) < sr // 4:
        return None

    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr)
    f0v = f0[~np.isnan(f0)]
    if f0v.size < 10:
        return None

    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]

    return {
        "dur": len(y) / sr,
        "f0_med": float(np.median(f0v)),
        "f0_p10": float(np.percentile(f0v, 10)),
        "f0_p90": float(np.percentile(f0v, 90)),
        "f0_range_semi": float(12 * np.log2(np.percentile(f0v, 90) / np.percentile(f0v, 10))),
        "f0_std_semi": float(12 * np.log2(np.percentile(f0v, 84) / np.percentile(f0v, 16)) / 2),
        "rms_cv": float(np.std(rms) / (np.mean(rms) + 1e-9)),
        "voiced_ratio": float(len(f0v) / max(1, len(f0))),
    }


def main():
    print(f"{'reference':<34}{'dur':>7}{'F0med':>8}{'range':>8}{'F0sd':>7}{'rmsCV':>8}")
    print("-" * 72)
    for name, p in CLIPS.items():
        if not p.exists():
            print(f"{name:<34}  (missing)")
            continue
        m = analyse(p)
        if not m:
            print(f"{name:<34}  (no voiced speech)")
            continue
        print(f"{name:<34}{m['dur']:6.1f}s{m['f0_med']:7.0f}Hz"
              f"{m['f0_range_semi']:6.1f}st{m['f0_std_semi']:6.1f}st{m['rms_cv']:8.2f}")

    print("\nHigher 'range' and 'F0sd' = more melodic movement (livelier).")
    print("Higher rmsCV = more dynamic emphasis. Low values on both read as flat/sad.")


if __name__ == "__main__":
    main()
