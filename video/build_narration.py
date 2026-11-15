"""Generate narration with the windah reference, guarding against cut-off speech.

Two changes aimed at the reported cutoff:

1. `remove_silence=False` is left off and `cross_fade_duration` is raised, so the
   internal chunk stitching F5 does for long sentences overlaps rather than
   butting up. F5 splits a long sentence into batches and cross-fades them; too
   short a fade can clip the junction, which sounds like a dropped word.

2. Clips are joined with a longer pause and each clip is faded rather than
   hard-trimmed, so sentence boundaries never start or stop mid-phoneme.

Also generates with the livelier `windah` reference and cfg 2.0, which measured
9.2 st of pitch range versus prabowo's 3.4 st.
"""
import json
import re
import subprocess
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
VIDEO = ROOT / "video"
D = VIDEO / "models" / "f5-indo"
MODEL = D / "f5_tts_indo_v2.pt"
VOCAB = D / "vocab.txt"

# Must be the untouched clip: F5 aligns ref_text to ref_audio, and a processed
# (denoised/resampled) reference breaks that alignment, which makes the model
# leak the reference sentence into the output ("...video YouTube").
REF = D / "ref_windah.wav"
REF_TEXT = (
    "Eh, guys, gua udah sampai nih di hotel di hari kedua lagi ngerjain beberapa hal, "
    "lagi upload-upload video YouTube."
)

OUT = VIDEO / "out"
RAW = VIDEO / "audio" / "sent2"
TRIM = VIDEO / "audio" / "trimmed2"
for p in (OUT, RAW, TRIM):
    p.mkdir(parents=True, exist_ok=True)

FPS = 30
SR = 48000
LEAD = 0.55
SENT_GAP = 0.42
TAIL = 0.90
FADE = 0.035          # short fade at every clip edge; no hard cuts
ESCAPE = 0.10         # keep extra silence so a soft onset/offset is never clipped

CFG = 2.0
CROSS_FADE = 0.30     # F5 internal stitch fade; longer than default 0.15
NFE = 40              # more sampling steps, fewer artefacts at joins

MASTER = ",".join([
    f"aresample={SR}",
    "highpass=f=95",
    # Denoise the generated speech: the windah reference carries audible room
    # tone (13 dB SNR) which F5 reproduces as background wash under the voice.
    "afftdn=nf=-28:nr=14:tn=1",
    "anlmdn=s=5:p=0.0015",
    "equalizer=f=180:t=q:w=1.0:g=1.2",
    "equalizer=f=2900:t=q:w=1.3:g=2.0",
    "deesser=i=0.3",
    "acompressor=threshold=-20dB:ratio=2.2:attack=15:release=260:makeup=1.8",
    "alimiter=limit=0.94",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
])


def ff(args, desc):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-y", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg failed ({desc}):\nCMD: ffmpeg {' '.join(args)}\n{r.stderr[-3000:]}")


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def voice_span(path: Path):
    """First and last non-silent moment, with a safety margin on each side."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af",
         "silencedetect=noise=-40dB:d=0.08", "-f", "null", "NUL"],
        capture_output=True, text=True)
    log = r.stderr
    total = dur(path)
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", log)]

    a = 0.0
    if starts and starts[0] < 0.05 and ends:
        a = max(0.0, ends[0] - ESCAPE)

    b = total
    if starts:
        tail_start = starts[-1] if (len(ends) < len(starts) or (ends and ends[-1] >= total - 0.05)) else None
        if tail_start is not None:
            b = min(total, tail_start + ESCAPE)

    if b - a < 0.2:
        return 0.0, total
    return a, b


def trim(src: Path, dst: Path):
    a, b = voice_span(src)
    length = b - a
    ff(["-i", str(src), "-af",
        f"atrim=start={a:.4f}:end={b:.4f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={FADE},afade=t=out:st={max(0,length-FADE):.4f}:d={FADE}",
        "-ar", str(SR), "-ac", "1", str(dst)], "trim")
    return dur(dst)


def main():
    spec = json.loads((VIDEO / "narration-final.json").read_text(encoding="utf-8"))
    scenes = spec["scenes"]
    speed = float(spec.get("speed", 1.0))

    # Clear intermediates so a stale list file can never point at a deleted clip.
    for pattern in ("list*.txt", "joined*.wav", "_gap*.wav", "_tail*.wav", "s*_lead.wav"):
        for f in TRIM.glob(pattern):
            f.unlink(missing_ok=True)

    from f5_tts.api import F5TTS

    print(f"ref: windah  cfg: {CFG}  nfe: {NFE}  cross_fade: {CROSS_FADE}", flush=True)
    f5 = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(MODEL), vocab_file=str(VOCAB),
               device="cuda", use_ema=True)

    timing, cues_out = [], []

    for si, sc in enumerate(scenes, 1):
        cue_frames: dict[str, int] = {}
        parts: list[Path] = []
        t = 0.0

        lead = TRIM / f"s{si:02d}_lead.wav"
        ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{LEAD}", str(lead)], "lead")
        parts.append(lead)
        t += LEAD

        for k, s in enumerate(sc["sentences"]):
            raw = RAW / f"s{si:02d}_{k:02d}.wav"
            if not raw.exists() or raw.stat().st_size < 2000:
                f5.infer(
                    ref_file=str(REF), ref_text=REF_TEXT, gen_text=s["text"],
                    file_wave=str(raw), speed=speed, cfg_strength=CFG,
                    nfe_step=NFE, cross_fade_duration=CROSS_FADE, seed=1234,
                    show_info=lambda *a, **kw: None,
                )
            clipped = TRIM / f"s{si:02d}_{k:02d}.wav"
            d = trim(raw, clipped)

            cue_frames[s["cue"]] = round(t * FPS)
            parts.append(clipped)
            t += d

            gap = TRIM / f"_gap{si:02d}_{k:02d}.wav"
            ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{SENT_GAP}", str(gap)], "gap")
            parts.append(gap)
            t += SENT_GAP

        frames = round((t + TAIL) * FPS)

        lst = TRIM / f"list{si:02d}.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
        joined = TRIM / f"joined{si:02d}.wav"
        ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-ar", str(SR), "-ac", "1", str(joined)], "concat")

        # Per-scene tail file: a shared name races with the concat demuxer.
        tail = TRIM / f"_tail{si:02d}.wav"
        ff(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{TAIL}", str(tail)], "tail")
        lst2 = TRIM / f"list2-{si:02d}.txt"
        lst2.write_text(f"file '{joined.as_posix()}'\nfile '{tail.as_posix()}'", encoding="utf-8")
        withtail = TRIM / f"withtail{si:02d}.wav"
        ff(["-f", "concat", "-safe", "0", "-i", str(lst2),
            "-ar", str(SR), "-ac", "1", str(withtail)], "addtail")
        mastered = OUT / f"vo-{si:02d}.wav"
        # afftdn alone. Chaining anlmdn after it aborts mid-stream on this ffmpeg
        # build (filter buffer overrun), and one denoiser is enough for a 13 dB
        # noise floor.
        denoised = TRIM / f"denoised{si:02d}.wav"
        ff(["-i", str(withtail), "-af",
            f"aresample={SR},highpass=f=95,afftdn=nf=-28:nr=14:tn=1",
            "-ar", str(SR), "-ac", "1", str(denoised)], "denoise")

        ff(["-i", str(denoised), "-af",
            "equalizer=f=180:t=q:w=1.0:g=1.2,"
            "equalizer=f=2900:t=q:w=1.3:g=2.0,"
            "deesser=i=0.3,"
            "acompressor=threshold=-20dB:ratio=2.2:attack=15:release=260:makeup=1.8,"
            "alimiter=limit=0.94,"
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar", str(SR), "-ac", "1", str(mastered.with_suffix(".m.wav"))], "master")

        ff(["-i", str(mastered.with_suffix(".m.wav")), "-af",
            f"apad=whole_dur={frames/FPS:.6f},atrim=0:{frames/FPS:.6f}",
            "-ar", str(SR), "-ac", "1", str(mastered)], "fit")

        timing.append({"index": si, "kind": sc["kind"], "title": sc.get("title", ""),
                       "frames": frames, "seconds": round(frames / FPS, 3),
                       "audio": f"vo-{si:02d}.wav"})
        cues_out.append({"index": si, "kind": sc["kind"], "title": sc.get("title", ""),
                         "frames": frames, "cues": cue_frames})
        print(f"[{si:02d}] {sc['kind']:<12} {frames:5d}f {frames/FPS:6.1f}s", flush=True)

    total = sum(x["frames"] for x in timing)
    (VIDEO / "timing.json").write_text(
        json.dumps({"fps": FPS, "totalFrames": total, "scenes": timing}, indent=2), encoding="utf-8")
    (VIDEO / "cues.json").write_text(
        json.dumps({"fps": FPS, "scenes": cues_out}, indent=2), encoding="utf-8")
    print(f"\nTOTAL {total} frames = {total/FPS/60:.2f} min", flush=True)


if __name__ == "__main__":
    main()
