"""Scan every generated clip for signs of truncated speech.

A clip where the words-per-second implies more words than the text contains means
words were dropped. Also flags clips that are implausibly short for their text.
"""
import json
import re
from pathlib import Path

import librosa

V = Path("video")
spec = json.loads((V / "narration-short.json").read_text(encoding="utf-8"))

bad = 0
tot = 0
fastest = []
for i, sc in enumerate(spec["scenes"], 1):
    for k, s in enumerate(sc["sentences"]):
        p = V / "audio" / "sent2" / f"s{i:02d}_{k:02d}.wav"
        if not p.exists():
            continue
        y, sr = librosa.load(str(p), sr=24000, mono=True)
        yt, _ = librosa.effects.trim(y, top_db=35)
        w = len(re.findall(r"\w+", s["text"]))
        d = len(yt) / sr if len(yt) else 0.01
        wpm = w / d * 60
        tot += 1
        fastest.append((wpm, p.name, d, w))
        if wpm > 300 or d < 0.5:
            bad += 1
            print(f"{p.name}: {d:.2f}s {w}w {wpm:.0f}wpm  <-- suspicious")

fastest.sort(reverse=True)
print(f"\n{tot} clips, {bad} suspicious")
print("fastest 5:")
for wpm, name, d, w in fastest[:5]:
    print(f"  {name:<14}{d:5.2f}s {w:3d}w {wpm:6.0f}wpm")
