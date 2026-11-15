"""Confirm the final narration has the livelier prosody we selected for."""
from pathlib import Path

import librosa
import numpy as np

V = Path("video")
OUT = V / "out"


def prosody(p):
    y, sr = librosa.load(str(p), sr=24000, mono=True)
    y, _ = librosa.effects.trim(y, top_db=35)
    f0, _, _ = librosa.pyin(y, fmin=60, fmax=450, sr=sr)
    v = f0[~np.isnan(f0)]
    if v.size < 20:
        return None
    return {
        "dur": len(y) / sr,
        "med": float(np.median(v)),
        "range": float(12 * np.log2(np.percentile(v, 90) / np.percentile(v, 10))),
        "sd": float(np.log2(np.percentile(v, 84) / np.percentile(v, 16)) * 3),
    }


print(f"{'track':<12}{'dur':>7}{'F0med':>8}{'range':>8}{'F0sd':>7}")
print("-" * 42)
ranges = []
for f in sorted(OUT.glob("vo-*.wav")):
    p = prosody(f)
    if not p:
        continue
    ranges.append(p["range"])
    print(f"{f.stem:<12}{p['dur']:6.1f}s{p['med']:7.0f}Hz{p['range']:6.1f}st{p['sd']:6.1f}st")

print(f"\nmean pitch range: {sum(ranges)/len(ranges):.1f} st")
print("target >= 6 st for an engaged delivery; prabowo measured 3.4 st.")
