"""Generate an SRT from the same cue data that drives the visuals.

Because cues.json maps each narration cue to an exact frame, subtitles derived
from it are frame-accurate by construction — they cannot drift from the audio
the way a separately-timed file would.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"

# Use the same script the narration was built from, so cues always exist.
spec = json.loads((VIDEO / "narration-final.json").read_text(encoding="utf-8"))
timing = json.loads((VIDEO / "timing.json").read_text(encoding="utf-8"))
cues_all = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))
FPS = timing["fps"]


def ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def wrap(text: str, per_line: int = 46) -> str:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= per_line:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return "\n".join(lines)


blocks, idx, offset = [], 1, 0.0
scene_start = {}
for s in timing["scenes"]:
    scene_start[s["index"]] = offset
    offset += s["frames"] / FPS

cues_by_scene = {c["index"]: c for c in cues_all["scenes"]}

for si, sc in enumerate(spec["scenes"], 1):
    base = scene_start[si]
    cue_map = cues_by_scene[si]["cues"]
    sents = sc["sentences"]
    for k, sent in enumerate(sents):
        start = base + cue_map[sent["cue"]] / FPS
        if k + 1 < len(sents):
            end = base + cue_map[sents[k + 1]["cue"]] / FPS
        else:
            end = base + timing["scenes"][si - 1]["frames"] / FPS
        end = min(end, start + 6.0)
        if end - start < 0.6:
            end = start + 0.6
        blocks.append(f"{idx}\n{ts(start)} --> {ts(end)}\n{wrap(sent['text'])}\n")
        idx += 1

out = VIDEO / "out" / "rantai-demo.srt"
out.write_text("\n".join(blocks), encoding="utf-8")
print(f"wrote {out} ({len(blocks)} cues, {ts(start)} -> {ts(end)})")
