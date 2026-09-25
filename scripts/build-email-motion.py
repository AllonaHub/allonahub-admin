"""Build compact email-safe motion variants from the approved Allona smoke artwork."""

from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageEnhance, ImageFont


OUTPUT = Path(__file__).resolve().parents[1] / "images" / "email"
SOURCE = OUTPUT / "allonahub-smoke-source.png"
SIZE = (600, 200)
FRAMES = 12


def font(size):
    for path in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def frame(base, index, variant):
    width, height = base.size
    drift = round(9 * math.sin(index * 2 * math.pi / FRAMES))
    crop = base.crop((max(0, drift + 10), 0, width - max(0, 10 - drift), height))
    image = crop.resize(SIZE, Image.Resampling.LANCZOS).convert("RGB")
    image = ImageEnhance.Brightness(image).enhance(0.90 + 0.08 * math.sin(index * 2 * math.pi / FRAMES))
    if variant == "welcome":
        draw = ImageDraw.Draw(image)
        title = "AllonaHub ekosistemine hoş geldin"
        text_font = font(26)
        box = draw.textbbox((0, 0), title, font=text_font)
        x = (SIZE[0] - (box[2] - box[0])) // 2
        y = (SIZE[1] - (box[3] - box[1])) // 2 - 5
        draw.text((x, y), title, font=text_font, fill="#ffffff", stroke_width=2, stroke_fill="#063b62")
    elif variant == "security":
        image = ImageEnhance.Color(image).enhance(0.78)
    return image.quantize(colors=64, method=Image.Quantize.MEDIANCUT)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    base = Image.open(SOURCE).convert("RGB")
    for variant in ("welcome", "security", "notification"):
        frames = [frame(base, index, variant) for index in range(FRAMES)]
        frames[0].save(OUTPUT / f"allonahub-{variant}.gif", save_all=True, append_images=frames[1:], duration=160, loop=0, optimize=True, disposal=2)


if __name__ == "__main__":
    main()
