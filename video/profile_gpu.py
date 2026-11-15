"""Find the real bottleneck: GPU compute, or per-call CPU overhead.

If GPU utilisation is low during a render while wall time is high, the cost is in
Python/tokenisation/vocoder overhead per call — which is what batching or
multiprocessing would fix, not more GPU streams.
"""
import json
import re
import subprocess
import threading
import time
from pathlib import Path

import soundfile as sf
import torch


def _patch_torchaudio():
    import torchaudio

    def _load(path, *a, **k):
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr

    torchaudio.load = _load


_patch_torchaudio()

V = Path("video")
D = V / "models" / "f5-indo"
OUT = V / "ab" / "bench"

REF = D / "ref_windah.wav"
REF_TEXT = ("Eh, guys, gua udah sampai nih di hotel di hari kedua lagi ngerjain beberapa hal, "
            "lagi upload-upload video YouTube.")
SENT = "Verifikasi menghitung ulang dari awal, dan melaporkan nomor entri pertama yang rusak."

samples = []


def poll_gpu(stop):
    while not stop.is_set():
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True)
        try:
            util, mem = [int(x) for x in r.stdout.strip().split(",")]
            samples.append((util, mem))
        except Exception:
            pass
        time.sleep(0.25)


def main():
    from f5_tts.api import F5TTS

    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(D / "f5_tts_indo_v2.pt"),
               vocab_file=str(D / "vocab.txt"), device="cuda", use_ema=True)

    # warm up so lazy CUDA init is not counted
    f5.infer(ref_file=str(REF), ref_text=REF_TEXT, gen_text="Pemanasan.",
             file_wave=str(OUT / "warm.wav"), speed=0.88, show_info=lambda *a, **k: None)

    stop = threading.Event()
    th = threading.Thread(target=poll_gpu, args=(stop,), daemon=True)
    th.start()

    t0 = time.time()
    for i in range(4):
        f5.infer(ref_file=str(REF), ref_text=REF_TEXT, gen_text=SENT,
                 file_wave=str(OUT / f"prof{i}.wav"), speed=0.88,
                 cfg_strength=2.0, show_info=lambda *a, **k: None)
    wall = time.time() - t0
    stop.set()
    th.join(timeout=2)

    utils = [s[0] for s in samples]
    mems = [s[1] for s in samples]
    print(f"wall for 4 sentences : {wall:.2f}s  ({wall/4:.2f}s each)")
    print(f"GPU util samples     : n={len(utils)} mean={sum(utils)/max(1,len(utils)):.0f}% "
          f"max={max(utils) if utils else 0}%")
    print(f"GPU mem used         : mean={sum(mems)/max(1,len(mems)):.0f} MiB "
          f"max={max(mems) if mems else 0} MiB")
    print()
    mean_util = sum(utils) / max(1, len(utils))
    if mean_util < 70:
        print(f"VERDICT: GPU sits at ~{mean_util:.0f}% while generating.")
        print("The bottleneck is per-call CPU work (tokenise, build batches, decode),")
        print("so parallel *processes* or true batching would help; more GPU streams will not.")
    else:
        print(f"VERDICT: GPU is ~{mean_util:.0f}% busy — it is the bottleneck.")
        print("Adding parallelism will not help; only a faster GPU or fewer diffusion steps will.")


if __name__ == "__main__":
    main()
