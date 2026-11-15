# Video build

Deliverables live in `video/out/`:

| File | What it is |
|---|---|
| `rantai-demo.mp4` | 1920×1080, 30 fps, H.264 + AAC, 6:27, `+faststart` |
| `rantai-demo.srt` | Indonesian subtitles, 65 cues |
| `rantai-thumbnail-youtube.png` | 1280×720 listing thumbnail |

Upload the MP4 to YouTube, then paste the URL into the submission form.

## Files

```
narration-final.json   the script: 13 scenes, each a list of {cue, text}
build_narration.py     F5-TTS per chunk -> measures each -> timing.json + cues.json
build_srt.py           cues.json -> frame-accurate SRT
build_deck.py          docs/rantai-slides.pptx  (from deck.json)
build_html_deck.py     docs/rantai-slides.html  (public slide link)
build_thumbnail.py     the YouTube thumbnail
remotion/              the composition; every element is bound to a cue
```

`timing.json` and `cues.json` are committed because the composition imports them.

## Why sentence-level synthesis

Visuals used to be timed to *scene* duration, so all motion landed in the first
three seconds and the rest of each scene sat still. Now:

1. Each chunk is synthesised separately, so its exact duration is measurable.
2. `cues.json` maps every named cue to the frame that chunk starts speaking.
3. Scenes resolve animation from those cue frames.

Picture and voice align by construction, not by hand-tuning.

## Commands

```bash
python video/build_narration.py    # needs the F5 model + a CUDA GPU
python video/build_srt.py
cd video/remotion && npx remotion render src/index.tsx Rantai ../out/rantai-demo.mp4 --concurrency=8
```

## Model and voice settings

`Eempostor/F5-TTS-INDO-FINETUNE-V2`, a 132-hour Indonesian fine-tune.

- reference `ref_windah.wav` — chosen by measurement, not taste: its pitch range
  is 5.5 st against 3.0 st for the formal reference, which is why the formal one
  sounded flat and sad.
- `cfg_strength=2.0`, `speed=0.88` → 143 wpm articulation.
- Reference must stay unprocessed. Denoising it before synthesis breaks the
  `ref_text`/`ref_audio` alignment and the model leaks the reference sentence
  into the narration.
- Denoising is applied to the *output* instead (`afftdn`), in a separate ffmpeg
  pass. `afftdn` chained with `anlmdn` aborts mid-stream on this ffmpeg build.

The model itself is not committed; it is ~1.35 GB.
