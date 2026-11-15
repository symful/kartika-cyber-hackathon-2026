"""A/B the reference clips by measuring the prosody of the generated speech.

F5 clones the reference's pitch contour, so a flat reference produces flat
narration. This generates the same sentence from each available reference and
reports the resulting F0 range, so the choice is measured.
"""
import re
import subprocess
from pathlib import Path

import librosa
import numpy as np
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
VIDEO = ROOT / "video"
D = VIDEO / "models" / "f5-indo"
MODEL = D / "f5_tts_indo_v2.pt"
VOCAB = D / "vocab.txt"
OUT = VIDEO / "ab" / "tone"
OUT.mkdir(parents=True, exist_ok=True)

TEXT = "Setiap berkas dihitung hash-nya saat diterima, lalu dihitung ulang dari isi yang tersimpan."

REFS = {
    "prabowo": ("ref_prabowo.wav", "Selamat pagi, salam sejahtera bagi kita sekalian."),
    "reporter": ("ref_reporter.wav", "dikatakan ternyata cek 3 miliar yang diberikan untuk mahar pernikahan ini adalah palsu."),
    "windah": ("ref_windah.wav", "Eh, guys, gua udah sampai nih di hotel di hari kedua lagi ngerjain beberapa hal, lagi upload-upload video YouTube."),
}


def prosody(path):
    y, sr = librosa.load(str(path), sr=24000, mono=True)
    y, _ = librosa.effects.trim(y, top_db=30)
    f0, _, _ = librosa.pyin(y, fmin=60, fmax=450, sr=sr)
    v = f0[~np.isnan(f0)]
    if v.size < 10:
        return None
    return {
        "med": float(np.median(v)),
        "range": float(12 * np.log2(np.percentile(v, 90) / np.percentile(v, 10))),
        "sd": float(12 * np.log2(np.percentile(v, 84) / np.percentile(v, 16)) / 2),
        "dur": len(y) / sr,
    }


def main():
    from f5_tts.api import F5TTS

    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(MODEL), vocab_file=str(VOCAB),
               device="cuda", use_ema=True)

    print(f"{'ref':<12}{'dur':>7}{'F0med':>8}{'range':>8}{'F0sd':>7}  output")
    print("-" * 62)
    for name, (wav, txt) in REFS.items():
        ref = D / wav
        if not ref.exists():
            print(f"{name:<12} (missing)")
            continue
        dst = OUT / f"{name}.wav"
        f5.infer(ref_file=str(ref), ref_text=txt, gen_text=TEXT,
                 file_wave=str(dst), speed=1.0, show_info=lambda *a, **k: None)
        p = prosody(dst)
        if p:
            print(f"{name:<12}{p['dur']:6.2f}s{p['med']:7.0f}Hz{p['range']:6.1f}st{p['sd']:6.1f}st  {dst.name}")

    print("\nTarget: range >= 6 st and F0sd >= 2.0 st reads as engaged, not sad.")


if __name__ == "__main__":
    main()
