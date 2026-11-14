"""Build narration + music bed and emit exact frame timings.

Design notes:
- One TTS call per *sentence* is the single biggest win over per-paragraph synthesis:
  it gives natural sentence-final falling intonation and lets us insert real silence.
- Rate is -4% (not +8%): rushing is what reads as robotic.
- A standard mastering chain (high-pass, presence EQ, de-esser, gentle compression,
  limiter, loudnorm) brings a cheap neural voice up to broadcast-consistent loudness.
- Output frame counts are derived from audio so picture and voice cannot drift.
"""
import asyncio, json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"
OUT = VIDEO / "out"
PARTS = VIDEO / "audio" / "_parts"
PARTS.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "id-ID-ArdiNeural"
RATE = "-4%"
PITCH = "-3Hz"
SR = 48000
FPS = 30
SENT_GAP = 0.42
CLAUSE_GAP = 0.22
LEAD_IN = 0.35      # silence before narration starts in a scene
TAIL = 0.55         # breathing room after narration


def sentences(text):
    return [p.strip() for p in re.findall(r"[^.!?]+[.!?]*", text) if p.strip()]


def clauses(sentence):
    if len(sentence) < 150:
        return [sentence]
    return [p.strip() for p in re.split(r"(?<=[;—])\s+", sentence) if p.strip()]


async def synth(text, dest):
    import edge_tts
    await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(str(dest))


def run(args, desc):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg failed ({desc}):\n{r.stderr}")


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def silence(path, seconds):
    run(["-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{seconds:.3f}", str(path)],
        "silence")


def build_scene_audio(idx, text):
    n = 0
    pieces = []
    for sent in sentences(text):
        for i, clause in enumerate(clauses(sent)):
            n += 1
            raw = PARTS / f"s{idx:02d}_{n:03d}.mp3"
            asyncio.run(synth(clause, raw))
            is_last_of_sentence = i == len(clauses(sent)) - 1
            pieces.append((raw, SENT_GAP if is_last_of_sentence else CLAUSE_GAP))

    concat_lines = []
    sil = PARTS / "_sil.mp3"
    for raw, gap in pieces:
        concat_lines.append(f"file '{raw.as_posix()}'")
        silence(sil, gap)
        concat_lines.append(f"file '{sil.as_posix()}'")

    lead = PARTS / "_lead.mp3"
    silence(lead, LEAD_IN)
    concat_lines.insert(0, f"file '{lead.as_posix()}'")

    clist = PARTS / f"_concat{idx:02d}.txt"
    clist.write_text("\n".join(concat_lines), encoding="utf-8")

    joined = PARTS / f"_joined{idx:02d}.wav"
    run(["-f", "concat", "-safe", "0", "-i", str(clist), "-ar", str(SR), "-ac", "1", str(joined)],
        "concat")

    mastered = OUT / f"vo-{idx:02d}.wav"
    run(["-i", str(joined), "-af", ",".join([
        "highpass=f=95",
        "equalizer=f=180:t=q:w=1.0:g=1.5",
        "equalizer=f=3200:t=q:w=1.4:g=2.4",
        "deesser=i=0.4",
        "acompressor=threshold=-19dB:ratio=2.6:attack=12:release=240:makeup=2.4",
        "alimiter=limit=0.94",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
    ]), "-ar", str(SR), "-ac", "1", str(mastered)], "master")
    return mastered


def main():
    scenes = json.loads((VIDEO / "scenes.json").read_text(encoding="utf-8"))
    timing = []
    print(f"{len(scenes)} scenes")

    for i, sc in enumerate(scenes, 1):
        vo = build_scene_audio(i, sc["vo"])
        d = duration(vo)
        total = d + TAIL
        frames = round(total * FPS)
        timing.append({"index": i, "kind": sc["kind"], "frames": frames,
                       "seconds": round(frames / FPS, 3), "audio": f"vo-{i:02d}.wav"})
        print(f"  {i:02d} {sc['kind']:<9} {frames:>5}f  {frames/FPS:6.2f}s")

    total_frames = sum(t["frames"] for t in timing)
    print(f"TOTAL {total_frames} frames = {total_frames/FPS/60:.2f} min")

    (VIDEO / "timing.json").write_text(
        json.dumps({"fps": FPS, "totalFrames": total_frames, "scenes": timing}, indent=2),
        encoding="utf-8")

    # Pad each mastered VO to its exact frame budget so the single-track mix stays in sync.
    padded = []
    for t, sc in zip(timing, scenes):
        src = OUT / t["audio"]
        dst = PARTS / f"pad-{t['index']:02d}.wav"
        run(["-i", str(src), "-af",
             f"apad=whole_dur={t['frames']/FPS:.6f},atrim=0:{t['frames']/FPS:.6f}",
             "-ar", str(SR), "-ac", "1", str(dst)], "pad")
        padded.append(dst)

    lst = PARTS / "voice_concat.txt"
    lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in padded), encoding="utf-8")
    voice = OUT / "voice-full.wav"
    run(["-f", "concat", "-safe", "0", "-i", str(lst), "-ar", str(SR), "-ac", "1", str(voice)],
        "voice concat")
    print(f"voice track: {duration(voice):.2f}s")

    # Music bed: sparse low pulse, deliberately quiet, ducked under narration.
    dur = total_frames / FPS
    bed = OUT / "bed.wav"
    run(["-f", "lavfi", "-i",
         f"sine=frequency=55:sample_rate={SR}:duration={dur}",
         "-f", "lavfi", "-i",
         f"sine=frequency=110:sample_rate={SR}:duration={dur}",
         "-filter_complex",
         "[0:a]volume=0.05,tremolo=f=1.2:d=0.35[a0];"
         "[1:a]volume=0.02,tremolo=f=0.4:d=0.5[a1];"
         "[a0][a1]amix=inputs=2:normalize=0,lowpass=f=220,"
         "aformat=channel_layouts=mono[out]",
         "-map", "[out]", "-ar", str(SR), "-ac", "1", str(bed)], "bed")
    print("audio ready")


if __name__ == "__main__":
    main()
