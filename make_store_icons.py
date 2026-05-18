"""Generate Claude RTL Fix icon set at all the sizes browser stores want.

Store requirements:
- CWS: 128x128 main icon, plus 440x280 small promo tile
- AMO: any reasonable square (uses the manifest icons)
- Edge: 300x300 logo, plus optional promo tiles

We generate clean square icons at every size that any store asks for, plus
a 1024x1024 master in case anything is needed at higher resolution.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path("/home/claude/claude-rtl-fix/icons-stores")
OUT.mkdir(exist_ok=True)

BG = (204, 120, 92, 255)   # warm terra (Claude-ish orange)
FG = (255, 255, 255, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def make_square_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded square background — radius scales with size
    radius = max(2, size // 6)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=BG)

    # Aleph at ~72% of icon height
    font_size = int(size * 0.72)
    font = ImageFont.truetype(FONT_PATH, font_size)
    glyph = "א"

    bbox = draw.textbbox((0, 0), glyph, font=font)
    glyph_w = bbox[2] - bbox[0]
    glyph_h = bbox[3] - bbox[1]
    x = (size - glyph_w) // 2 - bbox[0]
    y = (size - glyph_h) // 2 - bbox[1]
    draw.text((x, y), glyph, font=font, fill=FG)
    return img

def make_promo_tile(width: int, height: int) -> Image.Image:
    """Wide promotional tile — icon on left, name+tagline on right."""
    img = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(img)

    # Icon on the left side — use a smaller fraction of height to leave more
    # horizontal room for text
    icon_size = int(height * 0.55)
    icon_left = int(width * 0.05)
    icon_top = (height - icon_size) // 2
    icon = make_square_icon(icon_size)
    img.paste(icon, (icon_left, icon_top), icon)

    # Text starts after the icon with a comfortable gap
    text_x = icon_left + icon_size + int(width * 0.04)
    text_max_width = width - text_x - int(width * 0.04)

    # Pick a name font size that fits the available width
    name = "Claude RTL Fix"
    name_size = int(height * 0.17)
    name_font = ImageFont.truetype(FONT_PATH, name_size)
    while True:
        bbox = draw.textbbox((0, 0), name, font=name_font)
        if bbox[2] - bbox[0] <= text_max_width or name_size <= 8:
            break
        name_size -= 2
        name_font = ImageFont.truetype(FONT_PATH, name_size)

    tag = "Hebrew · Arabic · עברית · العربية"
    tag_size = int(name_size * 0.5)
    tag_font = ImageFont.truetype(FONT_PATH, tag_size)
    while True:
        bbox = draw.textbbox((0, 0), tag, font=tag_font)
        if bbox[2] - bbox[0] <= text_max_width or tag_size <= 6:
            break
        tag_size -= 1
        tag_font = ImageFont.truetype(FONT_PATH, tag_size)

    name_bbox = draw.textbbox((0, 0), name, font=name_font)
    tag_bbox = draw.textbbox((0, 0), tag, font=tag_font)
    gap = int(height * 0.04)
    total_h = (name_bbox[3] - name_bbox[1]) + gap + (tag_bbox[3] - tag_bbox[1])
    y_start = (height - total_h) // 2 - name_bbox[1]

    draw.text((text_x, y_start), name, font=name_font, fill=FG)
    draw.text(
        (text_x, y_start + (name_bbox[3] - name_bbox[1]) + gap - tag_bbox[1] + name_bbox[1]),
        tag,
        font=tag_font,
        fill=(255, 255, 255, 220),
    )

    return img

# Square icons at every size any store wants
for s in (16, 32, 48, 96, 128, 256, 300, 512, 1024):
    make_square_icon(s).save(OUT / f"icon-{s}.png")
    print(f"icon-{s}.png  ok")

# CWS small promo tile
make_promo_tile(440, 280).save(OUT / "promo-440x280.png")
print("promo-440x280.png  ok")

# CWS marquee (optional but nice)
make_promo_tile(1400, 560).save(OUT / "promo-1400x560.png")
print("promo-1400x560.png  ok")
