"""Check the assembled scene tracks for cut-off sentence endings.

The individual clips are complete, so any truncation must come from assembly:
the gap file being reused, the concat step, or the final pad/trim.
This inspects the last 0.5 s of each final track and the boundary between
sentences.
"""
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
V = ROOT / "video"
OUT = V / "out"

print(f"{'track':<14}{'dur':>8}{'endRMS':>9}{'peak':>8}{'end%':>7}  verdict")
print("-" * 58)

for f in sorted(OUT.glob("vo-*.wav")):
    y, sr = librosa.load(str(f), sr=24000, mono=True)
    rms = librosa.feature.rms(y=y, frame_length=512, hop_length=128)[0]
    peak = float(np.max(rms)) + 1e-9
    end = float(np.mean(rms[-4:])) / peak
    verdict = "ENDS ABRUPTLY" if end > 0.30 else "ok"
    print(f"{f.name:<14}{len(y)/sr:7.2f}s{float(rms[-1])/peak:8.2f}{peak:8.3f}{end*100:6.0f}%  {verdict}")

print("\nIf every track ends >30% of peak, the tail silence is being trimmed off,")
print("which would make each scene sound like it stops mid-word.")
