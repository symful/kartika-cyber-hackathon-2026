"""Inspect per-sentence F5 output for silence padding.

Hypothesis to test: each generated clip carries leading/trailing silence of its
own. Concatenating sentences then multiplies that dead air, which would explain
63% silence in the final track.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"
RAW = VIDEO / "audio" / "sent"

spec = json.loads((VIDEO / "narration-short.json").read_text(encoding="utf-8"))


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def edges(p):
    """Return (leading_silence, trailing_silence, total)."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(p), "-af",
         "silencedetect=noise=-38dB:d=0.12", "-f", "null", "NUL"],
        capture_output=True, text=True)
    log = r.stderr
    total = dur(p)

    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", log)]
    durs = [float(m) for m in re.findall(r"silence_duration: ([\d.]+)", log)]

    lead = 0.0
    if starts and starts[0] < 0.05:
        lead = durs[0] if durs else 0.0

    trail = 0.0
    if starts and ends and len(ends) == len(starts):
        if ends[-1] >= total - 0.05:
            trail = durs[-1] if durs else 0.0

    return lead, trail, total


print(f"{'file':<16}{'total':>8}{'lead':>7}{'trail':>7}{'speech':>8}")
n = 0
sum_total = sum_lead = sum_trail = 0.0
for i, sc in enumerate(spec["scenes"], 1):
    for k in range(len(sc["sentences"])):
        f = RAW / f"s{i:02d}_{k:02d}.wav"
        if not f.exists():
            continue
        lead, trail, total = edges(f)
        sum_total += total
        sum_lead += lead
        sum_trail += trail
        n += 1
        if n <= 12:
            print(f"{f.name:<16}{total:7.2f}s{lead:6.2f}s{trail:6.2f}s{total-lead-trail:7.2f}s")

print(f"\n{n} sentences")
print(f"total audio        {sum_total:7.1f}s")
print(f"leading silence    {sum_lead:7.1f}s  ({sum_lead/sum_total*100:.0f}%)")
print(f"trailing silence   {sum_trail:7.1f}s  ({sum_trail/sum_total*100:.0f}%)")
