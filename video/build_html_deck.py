"""Generate a self-contained 16:9 HTML deck from video/deck.json.

Why this exists: the submission form requires a publicly accessible link to the
slides, and I cannot upload to Google Slides or Canva. This single HTML file is
published as an artifact and serves the same content as the PPTX with keyboard
navigation, so a juror can read it in a browser without downloading anything.
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DECK = json.loads((ROOT / "video" / "deck.json").read_text(encoding="utf-8"))
OUT = ROOT / "docs" / "rantai-slides.html"

TONE = {"ok": ("#2c6f52", "#e6f4ee"), "no": ("#b83232", "#fdeceb"), "warn": ("#8a5810", "#fdf3e2")}
COLORS = {"accent": "#1866db", "orange": "#a9541f", "gold": "#7d5c0f", "faint": "#637286"}


def esc(t):
    return html.escape(str(t))


def img_src(path: str) -> str:
    """Inline as base64 so the file stays self-contained (artifacts get no relative assets)."""
    import base64

    p = ROOT / path
    if p.suffix.lower() == ".svg":
        alt = ROOT / "video" / "diagram-png" / (p.stem + ".png")
        if alt.exists():
            p = alt
    data = base64.b64encode(p.read_bytes()).decode()
    mime = "image/png" if p.suffix.lower() == ".png" else "image/svg+xml"
    return f"data:{mime};base64,{data}"


def brand():
    return """
    <header class="bar">
      <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9">
        <path d="M12 3l7.5 3v5.2c0 4.7-3.1 8.3-7.5 10.3-4.4-2-7.5-5.6-7.5-10.3V6L12 3z"/></svg></div>
      <div class="brandwrap">
        <div class="brand">RANTAI</div>
        <div class="brandsub">BERKAS BUKTI &amp; KOORDINASI INSIDEN</div>
      </div>
      <div class="meta"><div>Kartika Cyber Hackathon 2026</div><div>Kategori Penangkalan</div></div>
    </header>"""


def render(d: dict, idx: int, total: int) -> str:
    layout = d["layout"]

    if layout == "title":
        head = "".join(f'<div class="h1{" dim" if i > 1 else ""}">{esc(l)}</div>' for i, l in enumerate(d["headline"]))
        return f"""<section class="slide dark">{brand()}
          <div class="pad">
            <div class="eyebrow acc">{esc(d["eyebrow"])}</div>
            <div class="titleset">{head}</div>
            <p class="lede">{esc(d["lede"])}</p>
            <div class="rule"></div>
            <div class="mono link">{esc(DECK["live"])}</div>
            <div class="mono small">{esc(DECK["repo"])}</div>
          </div></section>"""

    if layout == "close":
        body = "".join(f'<div class="h2{" dim" if i else ""}">{esc(l)}</div>' for i, l in enumerate(d["headline"]))
        return f"""<section class="slide dark">{brand()}
          <div class="pad">
            <div class="eyebrow acc">{esc(d["eyebrow"])}</div>
            {body}
            <p class="lede">{esc(d["body"][0])}</p>
            <div class="mono link" style="margin-top:28px">{esc(DECK["live"])}</div>
            <div class="mono small">{esc(DECK["repo"])}</div>
            <div class="attr">{esc(d["attribution"])}</div>
          </div></section>"""

    if layout == "statement":
        heads = "".join(f'<div class="h2">{esc(l)}</div>' for l in d["headline"])
        items = "".join(f'<li>{esc(b)}</li>' for b in d.get("body", []))
        formula = f'<div class="formula mono">{esc(d["formula"])}</div>' if d.get("formula") else ""
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            {heads}<ul class="bullets">{items}</ul>{formula}
          </div></section>"""

    if layout == "flow":
        boxes = "".join(
            f'<div class="step{" hi" if i in (1,3) else ""}"><div class="n mono">0{i+1}</div><div class="st">{esc(s)}</div></div>'
            for i, s in enumerate(d["steps"])
        )
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="flow">{boxes}</div>
            <p class="note">Tidak ada langkah yang melewati pencatatan audit. Setiap mutasi tercatat pada rantai hash-linked.</p>
          </div></section>"""

    if layout == "shots":
        cells = "".join(
            f'<figure><img src="{img_src(im["path"])}" alt="{esc(im["caption"])}"><figcaption>{esc(im["caption"])}</figcaption></figure>'
            for im in d["images"]
        )
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="shots">{cells}</div>
            <p class="note">Semua tangkapan layar diambil dari prototipe yang berjalan. Data pelatihan sintetis.</p>
          </div></section>"""

    if layout == "diagram":
        items = "".join(f'<li>{esc(b)}</li>' for b in d.get("bullets", []))
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="twocol">
              <div><img class="diagram" src="{img_src(d["image"])}" alt="{esc(d["headline"][0])}">
                <p class="cap">{esc(d["caption"])}</p></div>
              <ul class="bullets sm">{items}</ul>
            </div>
          </div></section>"""

    if layout == "scores":
        rows = "".join(
            f'<div class="scorerow"><div class="sclab">{esc(r["pair"])}'
            f'<span class="basis">{esc(r["band"])} · {esc(r["basis"])}</span></div>'
            f'<div class="track"><div class="fill" style="width:{r["score"]}%;background:{COLORS[r["color"]]}"></div></div>'
            f'<div class="scval mono" style="color:{COLORS[r["color"]]}">{r["score"]}</div></div>'
            for r in d["rows"]
        )
        items = "".join(f'<li>{esc(b)}</li>' for b in d.get("bullets", []))
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="formula mono">{esc(d["formula"])}</div>
            {rows}<ul class="bullets sm">{items}</ul>
          </div></section>"""

    if layout == "ladder":
        steps = "".join(
            f'<div class="lad" style="background:{TONE[s["tone"]][1]};border-color:{TONE[s["tone"]][0]}">'
            f'<div class="ladn mono" style="background:{TONE[s["tone"]][0]}">{esc(s["n"])}</div>'
            f'<div>{esc(s["text"])}</div></div>'
            for s in d["steps"]
        )
        items = "".join(f'<li>{esc(b)}</li>' for b in d.get("bullets", []))
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="twocol"><div>{steps}</div><ul class="bullets sm">{items}</ul></div>
          </div></section>"""

    if layout == "proof":
        mets = "".join(
            f'<div class="metric{" hi" if i == 0 else ""}"><div class="mlab mono">{esc(m["label"]).upper()}</div>'
            f'<div class="mval">{esc(m["value"])}</div><div class="mnote">{esc(m["note"])}</div></div>'
            for i, m in enumerate(d["metrics"])
        )
        items = "".join(f'<li>{esc(b)}</li>' for b in d.get("bullets", []))
        return f"""<section class="slide">{brand()}
          <div class="pad">
            <div class="eyebrow">{esc(d["eyebrow"])}</div>
            <div class="h2">{esc(d["headline"][0])}</div>
            <div class="metrics">{mets}</div><ul class="bullets sm">{items}</ul>
          </div></section>"""

    return f'<section class="slide">{brand()}<div class="pad"><div class="h2">{esc(d["headline"][0])}</div></div></section>'


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#202a36;--ink2:#354152;--muted:#55647a;--faint:#637286;--rule:#e1e5ea;--accent:#1866db;
--navy:#2c3644;--sunk:#f7f9fc;--wash:#e8f0fe}
html,body{height:100%;background:#10161d;font-family:Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.deck{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scroll-behavior:smooth}
.slide{position:relative;width:100vw;height:100vh;background:#fff;scroll-snap-align:start;overflow:hidden}
.slide.dark{background:#222b36;color:#fff}
.bar{position:absolute;top:0;left:0;right:0;height:clamp(44px,5.1vh,64px);background:var(--navy);display:flex;align-items:center;
padding:0 clamp(16px,3.2vw,52px);gap:12px;z-index:3}
.mark{width:clamp(26px,2.5vw,34px);height:clamp(26px,2.5vw,34px);border-radius:9px;background:var(--accent);display:grid;place-items:center;flex:none}
.mark svg{width:60%;height:60%}
.brand{font-size:clamp(13px,1.45vw,20px);font-weight:800;letter-spacing:.16em;color:#fff;line-height:1.1}
.brandsub{font-family:"IBM Plex Mono",monospace;font-size:clamp(5.5px,.62vw,8px);color:#aab6c5;letter-spacing:.11em}
.meta{margin-left:auto;text-align:right;font-size:clamp(7px,.8vw,11px);color:#aab6c5;line-height:1.5}
.pad{position:absolute;top:clamp(64px,9vh,104px);left:clamp(16px,3.4vw,56px);right:clamp(16px,3.4vw,56px);bottom:clamp(20px,4vh,48px);display:flex;flex-direction:column}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:clamp(7px,.86vw,11px);letter-spacing:.16em;color:var(--faint);font-weight:600;margin-bottom:clamp(8px,1.4vh,18px)}
.eyebrow.acc{color:#6fa4f0}
.h1{font-size:clamp(24px,4.2vw,58px);font-weight:800;line-height:1.12;letter-spacing:-.02em}
.h1.dim{color:#8fa2ba}
.h2{font-size:clamp(18px,2.5vw,35px);font-weight:800;line-height:1.2;letter-spacing:-.02em;margin-bottom:clamp(10px,1.8vh,20px)}
.h2.dim{color:#8fa2ba}
.titleset{margin-bottom:clamp(12px,2.4vh,26px)}
.lede{font-size:clamp(10px,1.15vw,17px);color:#9fb0ca;line-height:1.6;max-width:60ch}
.rule{width:64px;height:4px;background:var(--accent);margin:clamp(14px,2.6vh,30px) 0}
.mono{font-family:"IBM Plex Mono",monospace}
.link{font-size:clamp(10px,1.1vw,15px);color:#6fa4f0;margin-bottom:4px}
.small{font-size:clamp(7px,.8vw,11px);color:#8fa2ba}
.attr{margin-top:auto;font-size:clamp(6.5px,.72vw,10px);color:#7d90ad;line-height:1.6;border-top:1px solid #3c4a5d;padding-top:10px;max-width:74ch}
.bullets{list-style:none;display:flex;flex-direction:column;gap:clamp(7px,1.5vh,15px)}
.bullets li{position:relative;padding-left:20px;font-size:clamp(10px,1.15vw,16px);color:var(--ink2);line-height:1.55}
.bullets li::before{content:"";position:absolute;left:0;top:.5em;width:7px;height:7px;border-radius:2px;background:var(--accent)}
.bullets.sm li{font-size:clamp(8.5px,.95vw,13px)}
.formula{background:var(--sunk);border:1px solid var(--rule);padding:10px 14px;font-size:clamp(8px,.92vw,13px);margin-bottom:clamp(10px,1.6vh,18px);display:inline-block}
.flow{display:flex;gap:clamp(5px,.9vw,14px);margin-bottom:clamp(12px,2.6vh,30px)}
.step{flex:1;border:1.25px solid var(--rule);background:#fff;padding:clamp(8px,1.3vh,16px) clamp(6px,.75vw,12px);min-height:clamp(56px,11vh,110px)}
.step.hi{background:var(--wash);border-color:var(--accent)}
.step .n{font-size:clamp(6.5px,.68vw,9px);color:var(--accent);font-weight:600;margin-bottom:6px}
.step .st{font-size:clamp(7px,.8vw,12.5px);font-weight:700;line-height:1.3}
.note{margin-top:auto;font-size:clamp(8px,.92vw,13px);color:var(--muted)}
.shots{display:flex;gap:clamp(6px,1vw,16px);flex:1;min-height:0;margin-bottom:clamp(8px,1.6vh,18px)}
.shots figure{flex:1;min-width:0;display:flex;flex-direction:column}
.shots img{width:100%;flex:1;min-height:0;object-fit:contain;object-position:top center;border:1px solid var(--rule);background:var(--sunk)}
.shots figcaption{margin-top:8px;font-size:clamp(7px,.85vw,12px);font-weight:700;color:var(--ink2)}
.twocol{display:grid;grid-template-columns:1.35fr 1fr;gap:clamp(12px,2.2vw,36px);flex:1;min-height:0;align-items:start}
.diagram{width:100%;object-fit:contain;border:1px solid var(--rule);background:#fff}
.cap{margin-top:8px;font-size:clamp(7px,.8vw,11px);color:var(--muted);line-height:1.45}
.scorerow{display:grid;grid-template-columns:minmax(140px,2.4fr) 3fr 48px;align-items:center;gap:12px;margin-bottom:clamp(8px,1.5vh,16px)}
.sclab{font-size:clamp(8px,.92vw,13px);font-weight:700}
.basis{display:block;font-weight:400;font-size:clamp(6.5px,.72vw,10px);color:var(--muted);margin-top:2px}
.track{height:clamp(7px,1vh,12px);background:var(--sunk);border-radius:2px;overflow:hidden}
.fill{height:100%}
.scval{text-align:right;font-size:clamp(11px,1.3vw,19px);font-weight:600}
.lad{display:flex;align-items:center;gap:10px;border:1px solid;padding:clamp(6px,1vh,11px) 10px;margin-bottom:clamp(5px,.9vh,9px);font-size:clamp(7.5px,.88vw,12px);line-height:1.4}
.ladn{width:clamp(16px,1.6vw,24px);height:clamp(16px,1.6vw,24px);display:grid;place-items:center;color:#fff;font-weight:600;font-size:clamp(7px,.78vw,10px);flex:none}
.metrics{display:flex;gap:clamp(6px,1vw,14px);margin-bottom:clamp(10px,2vh,22px)}
.metric{flex:1;border:1px solid var(--rule);padding:clamp(7px,1.2vh,14px) clamp(7px,.8vw,13px)}
.metric.hi{background:var(--wash);border-color:var(--accent)}
.mlab{font-size:clamp(5.5px,.6vw,8px);color:var(--muted);margin-bottom:5px}
.mval{font-size:clamp(15px,2vw,30px);font-weight:800;letter-spacing:-.02em}
.mnote{font-size:clamp(6px,.66vw,9px);color:var(--muted);margin-top:4px;line-height:1.35}
.hud{position:fixed;right:14px;bottom:12px;z-index:9;display:flex;gap:8px;align-items:center;
font-family:"IBM Plex Mono",monospace;font-size:11px;color:#8fa2ba;background:rgba(16,22,29,.82);padding:6px 10px;border-radius:6px}
.hud button{background:none;border:1px solid #3c4a5d;color:#c8d2df;width:22px;height:22px;border-radius:4px;cursor:pointer;line-height:1}
.hud button:hover{border-color:var(--accent);color:#fff}
@media (max-width:860px){.twocol{grid-template-columns:1fr}.flow{flex-wrap:wrap}.step{flex:1 1 28%}.scorerow{grid-template-columns:1fr 2fr 34px}}
"""

JS = """
const deck=document.querySelector('.deck');const slides=[...document.querySelectorAll('.slide')];
let idx=0;const label=document.getElementById('pos');
const set=i=>{idx=Math.max(0,Math.min(slides.length-1,i));slides[idx].scrollIntoView({behavior:'smooth'});label.textContent=(idx+1)+' / '+slides.length};
document.getElementById('prev').onclick=()=>set(idx-1);document.getElementById('next').onclick=()=>set(idx+1);
addEventListener('keydown',e=>{
 if(['ArrowDown','ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();set(idx+1)}
 if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();set(idx-1)}
 if(e.key==='Home'){e.preventDefault();set(0)}if(e.key==='End'){e.preventDefault();set(slides.length-1)}});
new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){idx=slides.indexOf(en.target);label.textContent=(idx+1)+' / '+slides.length}})},{threshold:.55}).observe||0;
slides.forEach(s=>new IntersectionObserver(es=>{es.forEach(en=>{if(en.intersectionRatio>.55&&en.isIntersecting){idx=slides.indexOf(en.target);label.textContent=(idx+1)+' / '+slides.length}})},{threshold:.55}).observe(s));
const fromHash=()=>{const m=location.hash.match(/^#(\\d+)$/);if(m){const n=parseInt(m[1],10)-1;if(n>=0&&n<slides.length){slides[n].scrollIntoView({behavior:'auto'});idx=n;label.textContent=(idx+1)+' / '+slides.length}}};
addEventListener('hashchange',fromHash);addEventListener('load',fromHash);fromHash();
"""


def main():
    total = len(DECK["slides"])
    body = "\n".join(render(d, i, total) for i, d in enumerate(DECK["slides"], 1))
    doc = f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RANTAI — Slide Penjelasan · Kartika Cyber Hackathon 2026</title>
<style>{CSS}</style></head>
<body>
<div class="deck">{body}</div>
<div class="hud"><button id="prev" aria-label="Sebelumnya">‹</button><span id="pos">1 / {total}</span><button id="next" aria-label="Berikutnya">›</button></div>
<script>{JS}</script>
</body></html>"""
    OUT.write_text(doc, encoding="utf-8")
    print(f"wrote {OUT}  ({OUT.stat().st_size/1024:.0f} KB, {total} slides)")


if __name__ == "__main__":
    main()
