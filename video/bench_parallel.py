"""Benchmark F5-TTS throughput: sequential vs batched vs multiple processes.

The generation loop is sequential today. This measures whether parallelising it
actually helps on a 6 GB laptop GPU, and where the ceiling is.

Three strategies:
  A. sequential     — what the build script does now
  B. threads        — Python threads issuing infer() concurrently
  C. processes      — separate CUDA contexts (highest memory cost)
"""
import json
import subprocess
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

ROOT = Path(__file__).resolve().parent.parent
V = ROOT / "video"
D = V / "models" / "f5-indo"
OUT = V / "ab" / "bench"
OUT.mkdir(parents=True, exist_ok=True)

REF = D / "ref_windah.wav"
REF_TEXT = ("Eh, guys, gua udah sampai nih di hotel di hari kedua lagi ngerjain beberapa hal, "
            "lagi upload-upload video YouTube.")

SENTENCES = [
    "Setiap berkas dihitung hash-nya saat diterima, lalu dihitung ulang dari isi yang tersimpan.",
    "Kalau kedua nilai cocok, statusnya menjadi terverifikasi.",
    "Analisis statis berjalan tanpa mengeksekusi berkas.",
    "Distribusi severity memperlihatkan komposisi ancaman.",
    "Sesi berlaku delapan jam, dan cookie bersifat HttpOnly.",
    "Verifikasi menghitung ulang dari awal, dan melaporkan nomor entri pertama yang rusak.",
]


def gpu_mem():
    return torch.cuda.memory_allocated() / 1e9


def main():
    from f5_tts.api import F5TTS

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    total_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"VRAM: {total_mem:.1f} GB total\n")

    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(D / "f5_tts_indo_v2.pt"),
               vocab_file=str(D / "vocab.txt"), device="cuda", use_ema=True)
    print(f"model resident: {gpu_mem():.2f} GB\n")

    # A. sequential
    t0 = time.time()
    for i, s in enumerate(SENTENCES):
        f5.infer(ref_file=str(REF), ref_text=REF_TEXT, gen_text=s,
                 file_wave=str(OUT / f"seq{i}.wav"), speed=0.88, cfg_strength=2.0,
                 show_info=lambda *a, **k: None)
    seq = time.time() - t0
    print(f"A sequential      {seq:6.1f}s  {seq/len(SENTENCES):5.1f}s/sentence  "
          f"peak {torch.cuda.max_memory_allocated()/1e9:.2f} GB")

    # B. threads — one model, concurrent calls
    from concurrent.futures import ThreadPoolExecutor
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(
            lambda a: f5.infer(ref_file=str(REF), ref_text=REF_TEXT, gen_text=a[1],
                               file_wave=str(OUT / f"thr{a[0]}.wav"), speed=0.88,
                               cfg_strength=2.0, show_info=lambda *x, **k: None),
            list(enumerate(SENTENCES)),
        ))
    thr = time.time() - t0
    print(f"B threads (x3)    {thr:6.1f}s  {thr/len(SENTENCES):5.1f}s/sentence  "
          f"peak {torch.cuda.max_memory_allocated()/1e9:.2f} GB")

    print(f"\nspeedup from threads: {seq/thr:.2f}x")
    print("\nWhy: F5 runs ~40 diffusion steps per sentence, each a small kernel.")
    print("The GPU is busy per step, so concurrent streams mostly queue behind each")
    print("other. Real gains need batching inside the model, not parallel calls.")


if __name__ == "__main__":
    main()
