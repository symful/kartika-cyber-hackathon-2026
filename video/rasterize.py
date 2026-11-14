import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs" / "diagrams"
OUT = ROOT / "video" / "diagram-png"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

sizes = {
    "architecture.svg": (1040, 520),
    "correlation-pipeline.svg": (1080, 460),
    "indicator-weights.svg": (880, 420),
    "score-bands.svg": (880, 430),
    "integrity-chain.svg": (1040, 470),
    "benchmark-results.svg": (920, 340),
}

for name, (w, h) in sizes.items():
    src = D / name
    dst = OUT / (name.replace(".svg", ".png"))
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=2",
        f"--window-size={w},{h}",
        f"--screenshot={dst}",
        src.as_uri(),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"{name} -> {dst.name} ({dst.stat().st_size} bytes)")
