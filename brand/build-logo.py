"""
Builds the وقت · من logo as pure vector paths (no font needed at runtime).

  python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
  .venv/bin/python brand/build-logo.py

Text is shaped with HarfBuzz (so Persian letters join correctly) from the
project's own Vazirmatn Bold (SIL OFL), then converted to outlines. The dot
between the two words is the idea of the mark: the moment (وقت) and the person
(من) meet at one point, drawn as a dot with a "ping" ring around it.

Outputs:
  apps/web/public/brand/*.svg          standalone logo files
  apps/web/src/components/logo-paths.ts  paths used by the <Logo> component
"""
import json
import pathlib

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / "apps/web/src/assets/fonts/Vazirmatn-Bold.ttf"
OUT_SVG = ROOT / "apps/web/public/brand"
OUT_TS = ROOT / "apps/web/src/components/logo-paths.ts"

INK = "#14202a"
INK_DARK = "#f1f5f9"
ACCENT = "#4338ca"
ACCENT_DARK = "#818cf8"

ttfont = TTFont(str(FONT))
glyphset = ttfont.getGlyphSet()
upem = ttfont["head"].unitsPerEm
blob = hb.Blob.from_file_path(str(FONT))
hbfont = hb.Font(hb.Face(blob))


def shape(text: str):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.direction = "rtl"
    buf.script = "Arab"
    buf.language = "fa"
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    return list(zip(buf.glyph_infos, buf.glyph_positions))


BOUNDS: list = []


def outline(text: str, x_origin: float):
    """Path for `text` whose left edge sits at x_origin (font units, y flipped)."""
    glyphs = shape(text)
    width = sum(p.x_advance for _, p in glyphs)
    pen = SVGPathPen(glyphset)
    bpen = BoundsPen(glyphset)
    # HarfBuzz returns RTL glyphs in visual (left-to-right) order already.
    x = 0
    for info, pos in glyphs:
        name = ttfont.getGlyphName(info.codepoint)
        matrix = (1, 0, 0, -1, x_origin + x + pos.x_offset, -pos.y_offset)
        glyphset[name].draw(TransformPen(pen, matrix))
        glyphset[name].draw(TransformPen(bpen, matrix))
        x += pos.x_advance
    BOUNDS.append(bpen.bounds)
    return pen.getCommands(), width


def bounds(path_text: str):
    from fontTools.pens.boundsPen import BoundsPen

    # Re-run to get bounds in the same transformed space.
    return None


# --- layout (font units; y is flipped so the baseline is y = 0) -------------
GAP = 130  # space between a word and the dot's ring
RING_R = 300
DOT_R = 165

_, mid_w = outline("من", 0)
_, wagt_w = outline("وقت", 0)
BOUNDS.clear()

# visual order, left -> right:  من  [dot]  وقت
x_mine = 0
dot_cx = x_mine + mid_w + GAP + RING_R
x_waqt = dot_cx + RING_R + GAP
mine_path, _ = outline("من", x_mine)
waqt_path, _ = outline("وقت", x_waqt)
total_w = x_waqt + wagt_w

# vertical placement of the dot: centred on the lower-case body of the letters
x_height = getattr(ttfont["OS/2"], "sxHeight", 0) or int(upem * 0.5)
dot_cy = -x_height * 0.5

# Tight artboard from the real outlines (+ the ring), with a little air.
xs0 = min(b[0] for b in BOUNDS)
xs1 = max(b[2] for b in BOUNDS)
ys0 = min(min(b[1] for b in BOUNDS), dot_cy - RING_R)
ys1 = max(max(b[3] for b in BOUNDS), dot_cy + RING_R)
pad = 90
min_x, max_x = xs0 - pad, xs1 + pad
min_y, max_y = ys0 - pad, ys1 + pad
vb_w, vb_h = max_x - min_x, max_y - min_y
viewbox = f"{min_x:.0f} {min_y:.0f} {vb_w:.0f} {vb_h:.0f}"

EMBOLDEN = 18  # tiny round stroke to take Bold towards ExtraBold


def wordmark_svg(ink: str, accent: str, bg: str | None = None):
    bg_rect = (
        f'<rect x="{min_x}" y="{min_y}" width="{vb_w:.0f}" height="{vb_h:.0f}" fill="{bg}"/>'
        if bg
        else ""
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="وقت من">
  <title>وقت من</title>
  {bg_rect}
  <g fill="{ink}" stroke="{ink}" stroke-width="{EMBOLDEN}" stroke-linejoin="round">
    <path d="{mine_path}"/>
    <path d="{waqt_path}"/>
  </g>
  <circle cx="{dot_cx:.0f}" cy="{dot_cy:.0f}" r="{RING_R}" fill="none" stroke="{accent}" stroke-width="58" opacity=".4"/>
  <circle cx="{dot_cx:.0f}" cy="{dot_cy:.0f}" r="{DOT_R}" fill="{accent}"/>
</svg>
"""


def mark_svg(bg: str, ring: str, dot: str, rx: int = 224):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="وقت من">
  <title>وقت من</title>
  <rect width="1024" height="1024" rx="{rx}" fill="{bg}"/>
  <circle cx="512" cy="512" r="300" fill="none" stroke="{ring}" stroke-width="56" opacity=".45"/>
  <circle cx="512" cy="512" r="150" fill="{dot}"/>
</svg>
"""


OUT_SVG.mkdir(parents=True, exist_ok=True)
(OUT_SVG / "logo-wordmark.svg").write_text(wordmark_svg(INK, ACCENT))
(OUT_SVG / "logo-wordmark-dark.svg").write_text(wordmark_svg(INK_DARK, ACCENT_DARK))
(OUT_SVG / "logo-mark.svg").write_text(mark_svg(ACCENT, "#ffffff", "#ffffff"))
(OUT_SVG / "logo-mark-maskable.svg").write_text(mark_svg(ACCENT, "#ffffff", "#ffffff", rx=0))

OUT_TS.write_text(
    "// GENERATED by brand/build-logo.py — do not edit by hand.\n"
    "export const LOGO = "
    + json.dumps(
        {
            "viewBox": viewbox,
            "mine": mine_path,
            "waqt": waqt_path,
            "dot": {"cx": round(dot_cx), "cy": round(dot_cy), "r": DOT_R, "ringR": RING_R},
            "embolden": EMBOLDEN,
        },
        ensure_ascii=False,
        indent=2,
    )
    + " as const;\n"
)
print("viewBox", viewbox, "| paths", len(mine_path), len(waqt_path))
