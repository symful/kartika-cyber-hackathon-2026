"""Add scene titles to timing/cues so the visual layer can look scenes up by name.

Reordering proved that index-keyed lookups are fragile: a shot scene at a new
index silently rendered nothing. Titles come from the narration script, so this
backfills them without re-synthesising audio.
"""
import json
from pathlib import Path

V = Path("video")
spec = json.loads((V / "narration-final.json").read_text(encoding="utf-8"))
titles = [sc.get("title", "") for sc in spec["scenes"]]

for name in ("timing.json", "cues.json"):
    data = json.loads((V / name).read_text(encoding="utf-8"))
    for i, sc in enumerate(data["scenes"]):
        sc["title"] = titles[i] if i < len(titles) else ""
    (V / name).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{name}: {sum(1 for s in data['scenes'] if s['title'])} titled scenes")

for t, s in zip(titles, json.loads((V / "timing.json").read_text(encoding="utf-8"))["scenes"]):
    print(f"  {s['index']:2d} {s['kind']:<12} {t}")
