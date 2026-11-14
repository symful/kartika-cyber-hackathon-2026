from pptx import Presentation

p = Presentation("docs/rantai-slides.pptx")
print("slides:", len(p.slides))
for i, s in enumerate(p.slides, 1):
    texts = [
        sh.text_frame.text.split("\n")[0][:60]
        for sh in s.shapes
        if sh.has_text_frame and sh.text_frame.text.strip()
    ]
    pics = sum(1 for sh in s.shapes if sh.shape_type == 13)
    notes = ""
    if s.has_notes_slide:
        notes = s.notes_slide.notes_text_frame.text[:50]
    print(f"{i:2d}  shapes={len(s.shapes):2d} pics={pics}  {texts[:2]}")
    if notes:
        print(f"     notes: {notes}...")
