"""Generate Indonesian narration with F5-TTS Indonesian fine-tune (v2).

torchaudio 2.15 on Windows routes `load()` through torchcodec, which needs
FFmpeg shared DLLs that aren't present. Rather than install more binaries we
shim `torchaudio.load` onto `soundfile`, which is already a dependency and reads
the 24 kHz mono WAV references we prepared.
"""
from pathlib import Path

import numpy as np
import soundfile as sf
import torch


def _patch_torchaudio():
    import torchaudio

    def _load(path, *args, **kwargs):
        data, sr = sf.read(str(path), dtype="float32", always_2d=True)
        # soundfile returns (frames, channels); torchaudio returns (channels, frames)
        tensor = torch.from_numpy(data.T.copy())
        return tensor, sr

    torchaudio.load = _load


_patch_torchaudio()

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "video" / "models" / "f5-indo" / "f5_tts_indo_v2.pt"
VOCAB = ROOT / "video" / "models" / "f5-indo" / "vocab.txt"
OUT = ROOT / "video" / "ab"

REF_TEXT = "Selamat pagi, salam sejahtera bagi kita sekalian."

TEXT = (
    "Setiap berkas bukti diberi sidik jari SHA-256, setiap indikator disimpan bersama "
    "asal-usulnya, dan setiap tindakan tercatat pada rantai audit hash-linked. "
    "Laporan dari satuan berbeda dapat dihubungkan tanpa memindahkan bukti mentah."
)


def main():
    from f5_tts.api import F5TTS

    print("loading F5-TTS ...", flush=True)
    f5 = F5TTS(
        model="F5TTS_v1_Base",
        ckpt_file=str(MODEL),
        vocab_file=str(VOCAB),
        device="cpu",
        use_ema=True,
    )

    refs = [
        ("prabowo", "Selamat pagi, salam sejahtera bagi kita sekalian."),
        ("reporter", "dikatakan ternyata cek 3 miliar yang diberikan untuk mahar pernikahan ini adalah palsu."),
    ]

    for name, ref_text in refs:
        ref_audio = ROOT / "video" / "models" / "f5-indo" / f"ref_{name}.wav"
        out = OUT / f"L_f5indo_{name}.wav"
        print(f"generating {out.name} ...", flush=True)
        f5.infer(
            ref_file=str(ref_audio),
            ref_text=ref_text,
            gen_text=TEXT,
            file_wave=str(out),
            speed=1.0,
            show_info=print,
        )
        print(f"  wrote {out}", flush=True)


if __name__ == "__main__":
    main()
