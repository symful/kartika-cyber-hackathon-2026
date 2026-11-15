"""Measure actual speaking rate so pacing is a number, not an opinion.

Compares the generated narration against the reference clip F5 clones. If the
reference is fast, F5 reproduces that speed even at speed=1.0 — which is why
lowering `speed` alone did not fix the rushed feel.
"""
import json
import re
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"


def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def words(text):
    return len(re.findall(r"\w+", text))


def report(label, text, audio):
    d = dur(audio)
    w = words(text)
    print(f"{label:<28} {d:6.2f}s  {w:4d} kata  {w/d*60:5.1f} wpm")


print("=== reference clip (what F5 clones the delivery from) ===")
ref = VIDEO / "models" / "f5-indo" / "ref_prabowo.wav"
report("ref_prabowo", "Selamat pagi, salam sejahtera bagi kita sekalian.", ref)

print("\n=== generated narration ===")
spec = json.loads((VIDEO / "narration-short.json").read_text(encoding="utf-8"))
total_d = 0.0
total_w = 0
for i, sc in enumerate(spec["scenes"], 1):
    audio = VIDEO / "out" / f"vo-{i:02d}.wav"
    if not audio.exists():
        continue
    text = " ".join(s["text"] for s in sc["sentences"])
    d = dur(audio)
    total_d += d
    total_w += words(text)
    report(f"scene {i:02d} ({sc['kind']})", text, audio)

print(f"\n{'OVERALL':<28} {total_d:6.2f}s  {total_w:4d} kata  {total_w/total_d*60:5.1f} wpm")
print("\nIndonesian narration typically sits at 110-130 wpm; above ~145 reads as rushed.")
