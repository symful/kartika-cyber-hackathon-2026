"""Separate articulation rate from overall rate.

Average wpm can look slow while the speech still sounds fast, if the voice
delivers short bursts separated by long silences. This measures:
  - speech time (silence removed)  -> articulation rate, what the ear hears
  - silence time                   -> dead air that inflates the average
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"


def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def speech_time(path, noise_db=-35, min_sil=0.25):
    """Total non-silent duration."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af",
         f"silencedetect=noise={noise_db}dB:d={min_sil}", "-f", "null", "NUL"],
        capture_output=True, text=True)
    sil = [float(m) for m in re.findall(r"silence_duration: ([\d.]+)", r.stderr)]
    total = dur(path)
    return total - sum(sil), sum(sil), len(sil)


def words(t):
    return len(re.findall(r"\w+", t))


spec = json.loads((VIDEO / "narration-short.json").read_text(encoding="utf-8"))

print(f"{'scene':<22}{'total':>8}{'speech':>8}{'silence':>9}{'wpm':>7}{'artikulasi':>12}")
ts = tsup = tsil = tw = 0
for i, sc in enumerate(spec["scenes"], 1):
    a = VIDEO / "out" / f"vo-{i:02d}.wav"
    if not a.exists():
        continue
    text = " ".join(s["text"] for s in sc["sentences"])
    total = dur(a)
    sp, si, n = speech_time(a)
    w = words(text)
    ts += total; tsup += sp; tsil += si; tw += w
    print(f"{sc['kind']:<22}{total:7.1f}s{sp:7.1f}s{si:8.1f}s{w/total*60:6.1f}{w/sp*60:11.1f}")

print(f"\nTOTAL                 {ts:7.1f}s{tsup:7.1f}s{tsil:8.1f}s{tw/ts*60:6.1f}{tw/tsup*60:11.1f}")
print(f"\nsilence is {tsil/ts*100:.0f}% of the track")
print("articulation > 190 wpm means the words themselves are being spat out fast,")
print("even if the average looks calm because of pauses.")
