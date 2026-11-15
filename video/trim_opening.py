"""Trim the cold open so the product appears at ~10 s instead of ~52 s.

The opening currently spends 7 sentences before anything is shown. Cut to the
essence: state the fragmentation, state that RANTAI resolves it, get to screen.
"""
import json
from pathlib import Path

V = Path("video")
src = json.loads((V / "narration-short.json").read_text(encoding="utf-8"))

for sc in src["scenes"]:
    if sc["kind"] != "coldopen":
        continue
    keep = {"card0", "card1", "lines", "score"}
    sc["sentences"] = [s for s in sc["sentences"] if s["cue"] in keep]
    # Re-word so the shortened version still reads as a complete thought.
    for s in sc["sentences"]:
        if s["cue"] == "lines":
            s["text"] = "Tanpa cara membandingkan bukti, keduanya tetap dua berkas yang tidak pernah bertemu."
        if s["cue"] == "score":
            s["text"] = "RANTAI mencocokkan indikator antar laporan, dan menemukan bahwa keduanya satu kampanye."

(V / "narration-short.json").write_text(
    json.dumps(src, indent=2, ensure_ascii=False), encoding="utf-8")

co = next(s for s in src["scenes"] if s["kind"] == "coldopen")
print("cold open sentences:")
for s in co["sentences"]:
    print(f"  [{s['cue']}] {s['text']}")
