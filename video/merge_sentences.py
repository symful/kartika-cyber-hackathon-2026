"""Merge short sentences so F5 produces a stable voice identity.

Measured problem: 37 of 101 clips drifted to ~215 Hz (reporter-like) while the
reference is 119 Hz (windah). F5 derives prosody per call and drifts on very
short inputs — "Ini RANTAI." is 2 words / 0.54 s.

Rule: any sentence under MIN_WORDS is merged with its neighbour, so every
synthesis call is long enough to hold the reference's identity. Cue names are
preserved on the merged chunk, so visuals still fire at the right moment.
"""
import json
from pathlib import Path

V = Path("video")
MIN_WORDS = 8

src = json.loads((V / "narration-short.json").read_text(encoding="utf-8"))

merged_scenes = []
total_in = total_out = 0

for sc in src["scenes"]:
    sents = sc["sentences"]
    total_in += len(sents)

    out = []
    buf = None
    for s in sents:
        w = len(s["text"].split())
        if buf is None:
            buf = dict(s)
            buf_words = w
        else:
            buf["text"] = buf["text"].rstrip() + " " + s["text"]
            buf_words += w
        # flush when long enough
        if buf_words >= MIN_WORDS:
            out.append(buf)
            buf = None
            buf_words = 0
    if buf:
        if out:
            out[-1]["text"] = out[-1]["text"].rstrip() + " " + buf["text"]
        else:
            out.append(buf)

    total_out += len(out)
    merged_scenes.append({"kind": sc["kind"], "sentences": out, **{
        k: v for k, v in sc.items() if k not in ("kind", "sentences", "cues")
    }})

src["scenes"] = merged_scenes
(V / "narration-merge.json").write_text(
    json.dumps(src, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"sentences: {total_in} -> {total_out} (min {MIN_WORDS} words)")
for sc in merged_scenes:
    n = [len(s["text"].split()) for s in sc["sentences"]]
    print(f"  {sc['kind']:<12} {len(n)} chunks  words {n}")
