# Video build

Deliverables land in `video/out/`:

| File | What it is |
|---|---|
| `rantai-demo.mp4` | 1920×1080, 30 fps, H.264 + AAC, 9:48, `+faststart` |
| `rantai-demo.srt` | Indonesian subtitles, generated from the same cue data as the visuals |

`*.mp4` is gitignored (80 MB). Upload it to YouTube, then paste the URL into the
submission form.

## How it is built

The pipeline is split so each step is reproducible and cheap to re-run.

```
video/narration.json       full 21-scene script (17.6 min — over the limit)
video/narration-short.json the 13-scene, 1.16× cut that fits 10 minutes
video/build_narration.py   F5-TTS per sentence → measures each one → cues.json
video/build_srt.py         cues.json → frame-accurate SRT
video/remotion/            Remotion composition; every element is bound to a cue
```

### Why sentence-level synthesis

The visuals used to be timed to *scene* duration, so all motion landed in the
first three seconds and the rest of the scene sat still. Now:

1. Each sentence is synthesised separately, so its exact duration is measurable.
2. `cues.json` maps every named cue to the frame that sentence starts speaking.
3. Scenes resolve their animations from those cue frames (`atCue`, `atCueLinear`).

That makes picture and voice aligned by construction, not by hand-tuning.

### Commands

```bash
python video/build_narration.py     # needs GPU; ~4 min for 101 sentences
python video/build_srt.py
cd video/remotion && npx remotion render src/index.tsx Rantai ../out/rantai-demo.mp4
```

`build_narration.py` picks `cuda` when available. On CPU it takes hours instead
of minutes.

### Model

`Eempostor/F5-TTS-INDO-FINETUNE-V2` — a 132-hour Indonesian fine-tune, run at
`speed=1.16`. Reference clip `ref_prabowo` (formal oratorical register).
