"""Final pre-submission verification.

Checks every form field and file limit from the rulebook:
  link works, video duration/codec, thumbnail 1200x630 under 500 KB,
  five screenshots present, slide deck opens, no leftover cruft.
"""
import json
import subprocess
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ok = True


def check(label, passed, detail=""):
    global ok
    ok = ok and passed
    print(f"{'PASS' if passed else 'FAIL'}  {label:<46} {detail}")


def http(url):
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": "verify"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:
        return getattr(e, "code", 0)


check("Live app reachable", http("https://rantai.careday17.workers.dev/api/health") == 200)
check("Public slide deck reachable",
      http("https://artifacts.commandcode.ai/05jogva6nkovfhb2") == 200)

video = ROOT / "video" / "out" / "rantai-demo.mp4"
if video.exists():
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration,size:stream=codec_name,width,height", "-of", "json", str(video)],
        capture_output=True, text=True)
    d = json.loads(r.stdout)
    dur = float(d["format"]["duration"])
    size_mb = int(d["format"]["size"]) / 1e6
    vs = next(s for s in d["streams"] if s["codec_name"] == "h264")
    has_audio = any(s["codec_name"] == "aac" for s in d["streams"])
    check("Video under 10 minutes", dur <= 600, f"{dur/60:.2f} min")
    check("Video is 1080p", vs["width"] == 1920 and vs["height"] == 1080,
          f"{vs['width']}x{vs['height']}")
    check("Video has audio", has_audio)
    check("Video file size sane", size_mb < 100, f"{size_mb:.0f} MB")
else:
    check("Video exists", False, "missing")

thumb = ROOT / "docs" / "thumbnail.png"
im = Image.open(thumb)
check("Thumbnail 1200x630", im.size == (1200, 630), str(im.size))
check("Thumbnail under 500 KB", thumb.stat().st_size < 500 * 1024,
      f"{thumb.stat().st_size/1024:.0f} KB")

shots = sorted((ROOT / "docs" / "submission").glob("*.png"))
check("Five screenshots", len(shots) == 5, f"{len(shots)} found")

from pptx import Presentation
p = Presentation(ROOT / "docs" / "rantai-slides.pptx")
check("Deck opens", True, f"{len(p.slides)} slides")

srt = ROOT / "video" / "out" / "rantai-demo.srt"
check("Subtitles present", srt.exists(),
      f"{len(srt.read_text(encoding='utf-8').split(chr(10)+chr(10)))} cues" if srt.exists() else "")

leftovers = [
    p for p in subprocess.run(
        ["git", "ls-files", "video"], cwd=ROOT, capture_output=True, text=True
    ).stdout.splitlines()
    if p.endswith((".wav", ".pt", ".onnx"))
]
check("No audio or model files tracked in git", not leftovers, f"{len(leftovers)} tracked")

print("\n" + ("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
raise SystemExit(0 if ok else 1)
