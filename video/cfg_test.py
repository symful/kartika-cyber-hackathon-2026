"""Tune cfg_strength on the liveliest reference.

cfg_strength controls how strongly generation adheres to the reference's
prosody. Too low and it drifts; too high and it copies the reference so hard the
delivery sounds strained. Sweep it and measure the result.
"""
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
OUT = VIDEO / "ab" / "cfg"
OUT.mkdir(parents=True, exist_ok=True)

REF = D / "ref_windah.wav"
REF_TEXT = "Eh, guys, gua udah sampai nih di hotel di hari kedua lagi ngerjain beberapa hal, lagi upload-upload video YouTube."
TEXT = "Setiap berkas dihitung hash-nya saat diterima, lalu dihitung ulang dari isi yang tersimpan."


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
        "sd": float(np.log2(np.percentile(v, 84) / np.percentile(v, 16)) * 6 / 2),
        "dur": len(y) / sr,
    }


def main():
    from f5_tts.api import F5TTS

    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(D / "f5_tts_indo_v2.pt"),
               vocab_file=str(D / "vocab.txt"), device="cuda", use_ema=True)

    print(f"{'cfg':>6}{'dur':>8}{'F0med':>8}{'range':>8}{'F0sd':>7}")
    print("-" * 40)
    for cfg in (1.6, 2.0, 2.4, 2.8):
        dst = OUT / f"cfg{cfg:.1f}.wav"
        f5.infer(ref_file=str(REF), ref_text=REF_TEXT, gen_text=TEXT,
                 file_wave=str(dst), speed=1.0, cfg_strength=cfg,
                 show_info=lambda *a, **k: None)
        p = prosody(dst)
        if p:
            print(f"{cfg:>6.1f}{p['dur']:7.2f}s{p['med']:7.0f}Hz{p['range']:6.1f}st{p['sd']:6.1f}st")


if __name__ == "__main__":
    main()
