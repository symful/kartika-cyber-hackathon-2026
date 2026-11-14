from huggingface_hub import snapshot_download
import os

dest = os.path.join("video", "models", "f5-indo")
print("downloading to", os.path.abspath(dest), flush=True)
p = snapshot_download(
    "Eempostor/F5-TTS-INDO-FINETUNE-V2",
    local_dir=dest,
    allow_patterns=["f5_tts_indo_v2.pt", "vocab.txt", "ref_*.mp3"],
)
print("OK", p, flush=True)
for f in sorted(os.listdir(dest)):
    fp = os.path.join(dest, f)
    print(f"  {f}  {os.path.getsize(fp)/1e6:.1f} MB", flush=True)
