"""Restructure the opening so a product surface appears within ~10 seconds.

Measured problem: the first screenshot did not appear until 51.8 s, because the
cold open ran 27 s and the problem statement another 24 s.

New order:
  1. cold open       (18 s)  three reports converge into one score
  2. dashboard       (20 s)  product on screen by ~18 s, not 52 s
  3. problem         (20 s)  why that mattered
  4. login           ...
"""
import json
from pathlib import Path

V = Path("video")
src = json.loads((V / "narration-merge.json").read_text(encoding="utf-8"))

by_kind = {}
for sc in src["scenes"]:
    by_kind.setdefault(sc["kind"], []).append(sc)

shots = by_kind.get("shot", [])
dashboard = next((s for s in shots if "Ringkasan" in s.get("title", "")), None)
login = next((s for s in shots if "Masuk" in s.get("title", "")), None)
evidence = next((s for s in shots if "Bukti" in s.get("title", "")), None)

order = [
    by_kind["coldopen"][0],
    dashboard,
    by_kind["problem"][0],
    login,
    evidence,
    by_kind["pipeline"][0],
    by_kind["scores"][0],
    by_kind["tlp"][0],
    by_kind["integrity"][0],
    by_kind["architecture"][0],
    by_kind["proof"][0],
    by_kind["feasible"][0],
    by_kind["closing"][0],
]

src["scenes"] = [s for s in order if s]
(V / "narration-final.json").write_text(
    json.dumps(src, indent=2, ensure_ascii=False), encoding="utf-8")

print("new order:")
for i, s in enumerate(src["scenes"], 1):
    print(f"  {i:2d} {s['kind']:<12} {s.get('title', '')}")
