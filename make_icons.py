"""Generate Claude RTL Fix icon set.

Design: Hebrew aleph (א) in white on a Claude-brand-ish orange background,
with rounded corners. Aleph is the universally recognizable "this is about
Hebrew/RTL" glyph.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path("/home/claude/claude-rtl-fix/icons")
OUT.mkdir(exist_ok=True)

# Claude brand orange-ish
BG = (204, 120, 92, 255)  # warm terra
FG = (255, 255, 255, 255)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded square background. Radius scales with size.
    radius = max(2, size // 6)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=BG)

    # Aleph glyph, sized to ~70% of icon height
    font_size = int(size * 0.72)
    font = ImageFont.truetype(FONT_PATH, font_size)
    glyph = "א"

    # Center the glyph using its actual bbox
    bbox = draw.textbbox((0, 0), glyph, font=font)
    glyph_w = bbox[2] - bbox[0]
    glyph_h = bbox[3] - bbox[1]
    x = (size - glyph_w) // 2 - bbox[0]
    y = (size - glyph_h) // 2 - bbox[1]
    draw.text((x, y), glyph, font=font, fill=FG)

    return img

for s in (16, 32, 48, 128):
    icon = make_icon(s)
    icon.save(OUT / f"icon-{s}.png")
    print(f"icon-{s}.png  ok")
