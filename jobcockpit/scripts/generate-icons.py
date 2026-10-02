"""Erzeugt alle App-Icons aus apps/mobile/assets/brand/logo-source.png.

Aufruf (aus jobcockpit/): python3 scripts/generate-icons.py   (benötigt Pillow)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets"
SRC = ROOT / "brand" / "logo-source.png"

# Bereich innerhalb des Navy-Quadrats ohne die cremefarbenen Ecken des Mockups
ICON_CROP = (171, 163, 1079, 1071)
# Dokument + Goldring
ARTWORK_CROP = (186, 236, 1070, 940)
NAVY_TOP = (36, 66, 104)
NAVY_BOTTOM = (11, 24, 43)


def is_navy(p):
    r, g, b = p[:3]
    return b > r + 14 and r < 95 and g < 110


def gradient(size):
    """Diagonaler Navy-Verlauf wie im Logo (oben links hell, unten rechts dunkel)."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOTTOM))
    return img


def is_background(p):
    """Navy-Fläche oder dunkler Schatten – nicht Papier (hell) und nicht Gold."""
    r, g, b = p[:3]
    goldish = r > 90 and r - b > 35
    return not goldish and (is_navy(p) or max(r, g, b) < 70)


def extract_artwork(src):
    """Stellt Dokument + Ring frei: Flood-Fill vom Rand über Navy/Schatten.

    Die dunkle Schrift auf dem Dokument bleibt erhalten, weil sie vom Papier
    umschlossen und damit nicht mit dem Rand verbunden ist.
    """
    art = src.crop(ARTWORK_CROP).convert("RGBA")
    w, h = art.size
    apx = art.load()
    bg = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if bg[i] or not is_background(apx[x, y]):
            continue
        bg[i] = 1
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    mask = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in bg))
    mask = mask.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    art.putalpha(mask)
    return art


def place(art, canvas_size, width_ratio, bg=None):
    w = round(canvas_size * width_ratio)
    h = round(art.height * w / art.width)
    scaled = art.resize((w, h), Image.LANCZOS)
    canvas = bg.copy().convert("RGBA") if bg else Image.new("RGBA", (canvas_size, canvas_size))
    canvas.alpha_composite(scaled, ((canvas_size - w) // 2, (canvas_size - h) // 2))
    return canvas


def main():
    src = Image.open(SRC).convert("RGB")

    # iOS / Store-Icon: Originalgestaltung, randlos, ohne Transparenz
    icon = src.crop(ICON_CROP).resize((1024, 1024), Image.LANCZOS)
    icon.save(ROOT / "icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(ROOT / "favicon.png")

    art = extract_artwork(src)

    # Android Adaptive Icon: Motiv innerhalb der Safe-Zone (Kreis mit 66 % Durchmesser)
    gradient(1024).save(ROOT / "android-icon-background.png")
    place(art, 1024, 0.54).save(ROOT / "android-icon-foreground.png")

    # Monochrom (Android 13+ Themed Icons): weiße Silhouette, Text ausgespart
    fg = place(art, 1024, 0.54)
    alpha = fg.getchannel("A")
    lum = fg.convert("L")
    text_holes = lum.point(lambda v: 255 if v > 90 else 0)
    mono_alpha = ImageChops.multiply(alpha, text_holes)
    mono = Image.new("RGBA", fg.size, (255, 255, 255, 0))
    mono.putalpha(mono_alpha)
    mono.save(ROOT / "android-icon-monochrome.png")

    # Splash: Motiv transparent, Hintergrundfarbe kommt aus app.json
    place(art, 1024, 0.9).save(ROOT / "splash-icon.png")

    # Vorschau zur Kontrolle (nicht im Bundle verwendet)
    preview = Image.new("RGB", (1024 * 3 + 80, 1024 + 40), (247, 243, 236))
    preview.paste(icon, (20, 20))
    adaptive = gradient(1024).convert("RGBA")
    adaptive.alpha_composite(Image.open(ROOT / "android-icon-foreground.png"))
    circle = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(circle).ellipse((176, 176, 848, 848), fill=255)
    zoomed = adaptive.crop((176, 176, 848, 848)).resize((1024, 1024), Image.LANCZOS)
    cmask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(cmask).ellipse((0, 0, 1023, 1023), fill=255)
    preview.paste(zoomed.convert("RGB"), (1064, 20), cmask)
    mono_bg = Image.new("RGBA", (1024, 1024), (60, 60, 60, 255))
    mono_bg.alpha_composite(mono)
    preview.paste(mono_bg.convert("RGB"), (2108, 20))
    preview.save(ROOT / "brand" / "icon-preview.png")


if __name__ == "__main__":
    main()
