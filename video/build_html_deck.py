"""Generate a self-contained 16:9 HTML deck from video/deck.json.

Layout approach: every slide is a fixed 16:9 stage whose font size is derived
from the stage width (``1em = 1% of stage width``). All internal sizes are in
``em``, so the composition stays proportional at any window size — the same
geometry the PPTX uses. The previous version mixed ``vw`` and ``vh`` units, which
let content collapse into the top third and leave large dead areas.

Why this exists: the submission form needs a public link to the slides and I
cannot upload to Google Slides or Canva.
"""
from __future__ import annotations

import base64
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


def data_uri(path: str) -> str:
    """Inline as base64 so the published artifact needs no relative assets."""
    p = ROOT / path
    if p.suffix.lower() == ".svg":
        alt = p.parent / ".png-cache" / (p.stem + ".png")
        if alt.exists():
            p = alt
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}.get(
        p.suffix.lower(), "image/png"
    )
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"


def brand() -> str:
    return """
      <header class="bar">
        <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
          <path d="M12 3l7.5 3v5.2c0 4.7-3.1 8.3-7.5 10.3-4.4-2-7.5-5.6-7.5-10.3V6L12 3z"/></svg></div>
        <div>
          <div class="brand">RANTAI</div>
          <div class="brandsub">BERKAS BUKTI &amp; KOORDINASI INSIDEN</div>
        </div>
        <div class="meta"><div>Kartika Cyber Hackathon 2026</div><div>Kategori Penangkalan</div></div>
      </header>"""


def footer(i: int, total: int) -> str:
    return f"""
      <div class="foot">
        <span>rantai.careday17.workers.dev · data pelatihan sintetis</span>
        <span class="mono">{i} / {total}</span>
      </div>"""


def mini_chain() -> str:
    rows = [("100", "#b83232", "kuat"), ("58", "#1866db", "sedang"),
            ("28", "#7d5c0f", "lemah"), ("0", "#637286", "tidak ada")]
    cells = "".join(
        f'<div class="mini" style="border-color:{c};color:{c}">{v}<span>{lbl}</span></div>'
        for v, c, lbl in rows
    )
    return f'<div class="minis">{cells}</div><div class="viz-cap">SKOR KORELASI · DATA DEMO</div>'


def render(d: dict, i: int, total: int) -> str:
    layout = d["layout"]

    if layout == "title":
        head = "".join(
            f'<div class="t-line{" dim" if k > 1 else ""}">{esc(l)}</div>'
            for k, l in enumerate(d["headline"])
        )
        return f"""{brand()}
        <div class="pad title-grid">
          <div>
            <div class="eyebrow acc">{esc(d["eyebrow"])}</div>
            <div class="t-set">{head}</div>
            <p class="lede">{esc(d["lede"])}</p>
            <div class="rule"></div>
            <div class="mono link">{esc(DECK["live"])}</div>
            <div class="mono tiny">{esc(DECK["repo"])}</div>
          </div>
          <div class="title-viz">{mini_chain()}</div>
        </div>"""

    if layout == "close":
        hl = d["headline"]
        head = f'{esc(hl[0])} <span class="dim">{esc(hl[1])}</span>' if len(hl) > 1 else esc(hl[0])
        return f"""{brand()}
        <div class="pad close-grid">
          <div>
            <div class="eyebrow acc">{esc(d["eyebrow"])}</div>
            <div class="c-head">{head}</div>
            <p class="lede">{esc(d["body"][0])}</p>
            <div class="linkblock">
              <div class="mono link">{esc(DECK["live"])}</div>
              <div class="mono tiny">{esc(DECK["repo"])}</div>
            </div>
          </div>
          <div class="close-viz">
            <div class="stat"><b>24</b><span>pemeriksaan keamanan, seluruhnya lulus</span></div>
            <div class="stat"><b>1.000</b><span>precision &amp; recall benchmark</span></div>
            <div class="stat"><b>0.000</b><span>false positive rate</span></div>
          </div>
        </div>
        <div class="attr">{esc(d["attribution"])}</div>"""

    if layout == "statement":
        heads = "".join(f'<div>{esc(l)}</div>' for l in d["headline"])
        items = "".join(
            f'<li><span class="dot"></span><span>{esc(b)}</span></li>' for b in d.get("body", [])
        )
        formula = f'<div class="formula mono">{esc(d["formula"])}</div>' if d.get("formula") else ""
        extra = ""
        if d.get("bullets"):
            extra = '<ul class="bullets sm">' + "".join(f"<li>{esc(b)}</li>" for b in d["bullets"]) + "</ul>"
        panels = ""
        if d.get("panels"):
            cells = "".join(
                f'<div class="panel" style="border-color:{TONE[p["tone"]][0]}">'
                f'<div class="panel-t mono" style="color:{TONE[p["tone"]][0]}">{esc(p["title"])}</div>'
                + "".join(f"<div class=\"panel-i\">{esc(x)}</div>" for x in p["items"])
                + "</div>"
                for p in d["panels"]
            )
            panels = f'<div class="panels">{cells}</div>'
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="stmt-body"><div class="stmt-head">{heads}</div><ul class="bullets">{items}</ul>{formula}{extra}{panels}</div>
          {footer(i, total)}
        </div>"""

    if layout == "flow":
        notes = d.get("stepNotes", [""] * len(d["steps"]))
        boxes = "".join(
            f'<div class="step{" hi" if k in (1, 3) else ""}"><div class="n mono">0{k+1}</div>'
            f'<div class="st">{esc(s)}</div><div class="sd">{esc(notes[k] if k < len(notes) else "")}</div></div>'
            for k, s in enumerate(d["steps"])
        )
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="flow">{boxes}</div>
          <p class="note">Tidak ada langkah yang melewati pencatatan audit. Setiap mutasi tercatat pada rantai hash-linked.</p>
          {footer(i, total)}
        </div>"""

    if layout == "shots":
        cells = "".join(
            f'<figure><div class="shotbox"><img src="{data_uri(im["path"])}" alt="{esc(im["caption"])}"></div>'
            f'<figcaption>{esc(im["caption"])}</figcaption></figure>'
            for im in d["images"]
        )
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="shots">{cells}</div>
          <p class="note">Semua tangkapan layar diambil dari prototipe yang berjalan, bukan mockup. Data pelatihan sintetis.</p>
          {footer(i, total)}
        </div>"""

    if layout == "diagram":
        items = "".join(f"<li>{esc(b)}</li>" for b in d.get("bullets", []))
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="twocol">
            <div class="figcol">
              <div class="figbox"><img src="{data_uri(d["image"])}" alt="{esc(d["headline"][0])}"></div>
              <p class="cap">{esc(d["caption"])}</p>
            </div>
            <ul class="bullets">{items}</ul>
          </div>
          {footer(i, total)}
        </div>"""

    if layout == "scores":
        rows = "".join(
            f'<div class="scorerow"><div class="sclab">{esc(r["pair"])}'
            f'<span class="basis">{esc(r["band"])} · {esc(r["basis"])}</span></div>'
            f'<div class="track"><div class="fill" style="width:{r["score"]}%;background:{COLORS[r["color"]]}"></div></div>'
            f'<div class="scval mono" style="color:{COLORS[r["color"]]}">{r["score"]}</div></div>'
            for r in d["rows"]
        )
        items = "".join(f"<li>{esc(b)}</li>" for b in d.get("bullets", []))
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="formula mono">{esc(d["formula"])}</div>
          <div class="scoreblock">{rows}</div>
          <ul class="bullets sm">{items}</ul>
          {footer(i, total)}
        </div>"""

    if layout == "ladder":
        steps = "".join(
            f'<div class="lad" style="background:{TONE[s["tone"]][1]};border-color:{TONE[s["tone"]][0]}">'
            f'<div class="ladn mono" style="background:{TONE[s["tone"]][0]}">{esc(s["n"])}</div>'
            f"<div>{esc(s['text'])}</div></div>"
            for s in d["steps"]
        )
        items = "".join(f"<li>{esc(b)}</li>" for b in d.get("bullets", []))
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="twocol ladder-grid"><div>{steps}</div><ul class="bullets">{items}</ul></div>
          {footer(i, total)}
        </div>"""

    if layout == "proof":
        mets = "".join(
            f'<div class="metric{" hi" if k == 0 else ""}"><div class="mlab mono">{esc(m["label"]).upper()}</div>'
            f'<div class="mval">{esc(m["value"])}</div><div class="mnote">{esc(m["note"])}</div></div>'
            for k, m in enumerate(d["metrics"])
        )
        items = "".join(f"<li>{esc(b)}</li>" for b in d.get("bullets", []))
        return f"""{brand()}
        <div class="pad">
          <div class="eyebrow">{esc(d["eyebrow"])}</div>
          <div class="h2">{esc(d["headline"][0])}</div>
          <div class="metrics">{mets}</div>
          <div class="proofsplit">
            <ul class="bullets">{items}</ul>
            <div class="verify-card">
              <div class="vc-title mono">VERIFIKASI RANTAI</div>
              <div class="vc-ok">TERVERIFIKASI</div>
              <div class="vc-sub">27 entri diperiksa · 1 checkpoint valid</div>
              <div class="vc-bar"><span></span></div>
            </div>
          </div>
          {footer(i, total)}
        </div>"""

    return f'{brand()}<div class="pad"><div class="h2">{esc(d["headline"][0])}</div></div>'


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#202a36;--ink2:#354152;--muted:#55647a;--faint:#637286;--rule:#e1e5ea;--rule2:#cfd6df;
--accent:#1866db;--navy:#2c3644;--sunk:#f7f9fc;--wash:#e8f0fe;--signal:#b83232;--verify:#2c6f52}
html,body{height:100%;background:#0c1117;color:var(--ink);
font-family:Archivo,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.deck{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory}
.slide{position:relative;width:100vw;height:100vh;scroll-snap-align:start;
display:grid;place-items:center;overflow:hidden;background:#0c1117}
/* Fixed 16:9 stage. 1em == 1% of stage width, so everything scales as one unit. */
.stage{position:relative;width:min(100vw,calc(100vh*16/9));height:min(100vh,calc(100vw*9/16));
background:#fff;font-size:calc(min(100vw,calc(100vh*16/9))/100);overflow:hidden;
box-shadow:0 26px 70px -36px rgba(0,0,0,.85)}
.slide.dark .stage{background:#222b36;color:#fff}
.bar{position:absolute;top:0;left:0;right:0;height:5.2em;background:var(--navy);display:flex;
align-items:center;padding:0 4.2em;gap:1.1em;z-index:3}
.mark{width:3em;height:3em;border-radius:.9em;background:var(--accent);display:grid;place-items:center;flex:none}
.mark svg{width:62%;height:62%}
.brand{font-size:1.7em;font-weight:800;letter-spacing:.16em;color:#fff;line-height:1.05}
.brandsub{font-family:"IBM Plex Mono",monospace;font-size:.66em;color:#aab6c5;letter-spacing:.11em;margin-top:.3em}
.meta{margin-left:auto;text-align:right;font-size:.84em;color:#aab6c5;line-height:1.5}
.pad{position:absolute;top:7.6em;left:4.2em;right:4.2em;bottom:4.8em;display:flex;flex-direction:column;
padding-bottom:2.6em}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.88em;letter-spacing:.16em;color:var(--faint);
font-weight:600;margin-bottom:1.15em}
.eyebrow.acc{color:#6fa4f0}
.h2{font-size:2.5em;font-weight:800;line-height:1.16;letter-spacing:-.022em;margin-bottom:1.4em;color:var(--ink)}
.t-set{margin:.3em 0 1.3em}
.t-line{font-size:4em;font-weight:800;line-height:1.1;letter-spacing:-.028em}
.t-line.dim{color:#8fa2ba}
.lede{font-size:1.1em;color:#9fb0ca;line-height:1.62;max-width:50ch}
.rule{width:6em;height:.42em;background:var(--accent);margin:2.1em 0 1.5em}
.mono{font-family:"IBM Plex Mono",monospace}
.link{font-size:1.12em;color:#6fa4f0}
.tiny{font-size:.84em;color:#8fa2ba;margin-top:.45em}
/* title */
.title-grid{display:grid;grid-template-columns:1.3fr .7fr;gap:3.6em;align-items:center}
.title-viz{display:flex;flex-direction:column;gap:1em}
.minis{display:flex;flex-direction:column;gap:.85em}
.mini{display:flex;align-items:baseline;gap:.7em;border-left:.32em solid;background:rgba(255,255,255,.045);
padding:.62em 1.05em;border-radius:.28em;font-family:"IBM Plex Mono",monospace;
font-size:2em;font-weight:600;line-height:1}
.mini span{font-family:Archivo,sans-serif;font-size:.33em;font-weight:400;color:#8fa2ba;letter-spacing:.05em}
.viz-cap{font-family:"IBM Plex Mono",monospace;font-size:.7em;color:#6f819e;letter-spacing:.1em;margin-top:.4em}
/* close */
.close-grid{display:grid;grid-template-columns:1.32fr .68fr;gap:3.6em;align-items:center}
.c-head{font-size:3.2em;font-weight:800;line-height:1.14;letter-spacing:-.028em;margin-bottom:.5em;
color:#fff}
.c-head .dim{color:#8fa2ba}
.linkblock{margin-top:2.4em}
.close-viz{display:flex;flex-direction:column;gap:1.05em}
.stat{border-left:.28em solid var(--accent);padding:.62em 0 .62em 1em;background:rgba(255,255,255,.035)}
.stat b{display:block;font-family:"IBM Plex Mono",monospace;font-size:2.1em;color:#fff;line-height:1}
.stat span{font-size:.8em;color:#9fb0ca;margin-top:.42em;display:block;line-height:1.4}
.attr{position:absolute;left:4.2em;right:4.2em;bottom:2em;font-size:.72em;color:#7d90ad;
line-height:1.6;border-top:1px solid #3c4a5d;padding-top:.85em}
/* statement: fixed top offset so every statement slide shares one baseline */
.stmt-body{display:flex;flex-direction:column;justify-content:flex-start;flex:1;gap:1.6em;padding-top:2.2em}
.stmt-head{font-size:2.5em;font-weight:800;line-height:1.16;letter-spacing:-.022em;color:var(--ink)}
.bullets{list-style:none;display:flex;flex-direction:column;gap:1.1em}
.bullets li{display:flex;gap:.85em;font-size:1.22em;color:var(--ink2);line-height:1.55;align-items:flex-start}
.bullets li .dot{width:.44em;height:.44em;border-radius:.1em;background:var(--accent);margin-top:.6em;flex:none}
.bullets.sm li{font-size:1em;display:flex;gap:.8em}
.bullets.sm li::before{content:"";width:.4em;height:.4em;border-radius:.1em;background:var(--accent);
margin-top:.62em;flex:none}
.formula{background:var(--sunk);border:1px solid var(--rule);padding:.82em 1.15em;font-size:1em;
margin:1.5em 0 0;display:inline-block;align-self:flex-start;color:var(--ink)}
/* three-column status panels */
.panels{display:grid;grid-template-columns:repeat(3,1fr);gap:1.3em;margin-top:.6em}
.panel{border:.1em solid;border-left-width:.3em;background:#fff;padding:1.1em 1.2em}
.panel-t{font-size:.74em;letter-spacing:.1em;margin-bottom:.8em;font-weight:600}
.panel-i{font-size:.95em;color:var(--ink2);line-height:1.5;padding-left:1em;position:relative;margin-bottom:.45em}
.panel-i::before{content:"";position:absolute;left:0;top:.55em;width:.36em;height:.36em;
border-radius:.08em;background:var(--rule2)}
/* flow */
.flow{display:flex;gap:1em;margin-bottom:2.2em;flex:1 1 auto;align-items:stretch;max-height:26em}
.step{flex:1;border:.12em solid var(--rule2);background:#fff;padding:1.5em 1.1em;
display:flex;flex-direction:column;gap:.9em;justify-content:flex-start}
.step.hi{background:var(--wash);border-color:var(--accent)}
.step .n{font-size:.9em;color:var(--accent);font-weight:600}
.step .st{font-size:1.12em;font-weight:700;line-height:1.36}
.step .sd{font-size:.84em;color:var(--muted);line-height:1.5;margin-top:auto}
.note{margin-top:auto;font-size:1em;color:var(--muted);line-height:1.5}
/* shots: identical frames regardless of source aspect ratio */
.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5em;flex:1;min-height:0;margin-bottom:1.2em}
.shots figure{display:flex;flex-direction:column;min-width:0;min-height:0}
.shotbox{flex:1;min-height:0;border:1px solid var(--rule2);background:var(--sunk);overflow:hidden;
display:grid;place-items:start center}
.shotbox img{width:100%;height:auto;display:block}
.shots figcaption{margin-top:.75em;font-size:.98em;font-weight:700;color:var(--ink2);flex:none}
/* diagram */
.twocol{display:grid;grid-template-columns:1.45fr 1fr;gap:2.6em;flex:1;min-height:0;align-items:center}
.ladder-grid{grid-template-columns:1.25fr .75fr;align-items:center}
.figcol{display:flex;flex-direction:column;min-height:0;height:100%;justify-content:center}
.figbox{background:#fff;border:1px solid var(--rule);display:grid;place-items:center;
overflow:hidden;padding:.9em;flex:1;min-height:0}
.figbox img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.cap{margin-top:.75em;font-size:.82em;color:var(--muted);line-height:1.45;flex:none}
/* scores */
.scoreblock{display:flex;flex-direction:column;gap:1.3em;margin:.3em 0 1.8em}
.scorerow{display:grid;grid-template-columns:minmax(18em,2.6fr) 3.4fr 2.8em;
align-items:center;gap:1.2em}
.sclab{font-size:1em;font-weight:700}
.basis{display:block;font-weight:400;font-size:.76em;color:var(--muted);margin-top:.22em}
.track{height:.85em;background:var(--sunk);border-radius:.15em;overflow:hidden}
.fill{height:100%;border-radius:.15em}
.scval{text-align:right;font-size:1.45em;font-weight:600}
/* ladder */
.lad{display:flex;align-items:center;gap:.9em;border:.1em solid;padding:.8em 1em;
margin-bottom:.65em;font-size:.96em;line-height:1.4}
.ladn{width:1.85em;height:1.85em;display:grid;place-items:center;color:#fff;
font-weight:600;font-size:.78em;flex:none;border-radius:.15em}
/* proof */
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1.25em;margin-bottom:2em}
.metric{border:1px solid var(--rule2);padding:1.05em .95em;background:#fff}
.metric.hi{background:var(--wash);border-color:var(--accent)}
.mlab{font-size:.7em;color:var(--muted);letter-spacing:.06em;margin-bottom:.55em}
.mval{font-size:2.4em;font-weight:800;letter-spacing:-.02em;line-height:1}
.mnote{font-size:.72em;color:var(--muted);margin-top:.55em;line-height:1.4}
.proofsplit{display:grid;grid-template-columns:1.45fr 1fr;gap:2.6em;align-items:start;
flex:0 0 auto;margin-top:.4em}
.verify-card{border:1px solid var(--rule2);border-left:.3em solid var(--verify);
background:#fff;padding:1.2em 1.3em}
.vc-title{font-size:.72em;color:var(--muted);letter-spacing:.1em;margin-bottom:.65em}
.vc-ok{font-size:1.45em;font-weight:800;color:var(--verify);letter-spacing:-.01em}
.vc-sub{font-size:.8em;color:var(--muted);margin-top:.45em}
.vc-bar{margin-top:.9em;height:.4em;background:#eef2f7;border-radius:99em;overflow:hidden}
.vc-bar span{display:block;width:100%;height:100%;background:var(--verify)}
/* foot + hud */
.foot{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;
font-family:"IBM Plex Mono",monospace;font-size:.72em;color:var(--faint);
border-top:1px solid var(--rule);padding-top:.85em}
.hud{position:fixed;right:1.6em;bottom:1.4em;z-index:9;display:flex;gap:.7em;align-items:center;
font-family:"IBM Plex Mono",monospace;font-size:12px;color:#8fa2ba;
background:rgba(12,17,23,.88);padding:.5em .8em;border-radius:.4em}
.hud button{background:none;border:1px solid #3c4a5d;color:#c8d2df;width:24px;height:24px;
border-radius:.25em;cursor:pointer;line-height:1;font-size:14px}
.hud button:hover{border-color:var(--accent);color:#fff}
"""

JS = r"""
const slides=[...document.querySelectorAll('.slide')];
let idx=0;const label=document.getElementById('pos');
const go=i=>{idx=Math.max(0,Math.min(slides.length-1,i));
  slides[idx].scrollIntoView({behavior:'smooth',block:'start'});
  label.textContent=(idx+1)+' / '+slides.length};
document.getElementById('prev').onclick=()=>go(idx-1);
document.getElementById('next').onclick=()=>go(idx+1);
addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();go(idx+1)}
  if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(idx-1)}
  if(e.key==='Home'){e.preventDefault();go(0)}
  if(e.key==='End'){e.preventDefault();go(slides.length-1)}});
const obs=new IntersectionObserver(es=>{es.forEach(en=>{
  if(en.isIntersecting&&en.intersectionRatio>.55){
    idx=slides.indexOf(en.target);label.textContent=(idx+1)+' / '+slides.length}});
},{threshold:[.55]});
slides.forEach(s=>obs.observe(s));
const fromHash=()=>{const m=location.hash.match(/^#(\d+)$/);if(m){
  const n=parseInt(m[1],10)-1;
  if(n>=0&&n<slides.length){slides[n].scrollIntoView({behavior:'auto',block:'start'});
    idx=n;label.textContent=(idx+1)+' / '+slides.length}}};
addEventListener('hashchange',fromHash);addEventListener('load',fromHash);fromHash();
"""


def main():
    total = len(DECK["slides"])
    body = "\n".join(
        f'<section class="slide{" dark" if d["layout"] in ("title", "close") else ""}">'
        f'<div class="stage">{render(d, i, total)}</div></section>'
        for i, d in enumerate(DECK["slides"], 1)
    )
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
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB, {total} slides)")


if __name__ == "__main__":
    main()
