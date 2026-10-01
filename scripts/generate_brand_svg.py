"""One-time vector tracing of the owner's PAM artwork (requires Pillow and vtracer).

Usage: python scripts/generate_brand_svg.py LOGO_PNG SWATCH_PNG OUTPUT_DIR
The generated SVGs contain paths only, with transparent backgrounds and no PNG data.
"""

from pathlib import Path
import sys

from PIL import Image
import vtracer


NAVY = (0, 35, 91)
YELLOW = (255, 209, 102)
RED = (163, 22, 33)
WHITE = (255, 255, 255)


def distance(left, right):
    return sum((a - b) ** 2 for a, b in zip(left, right))


def trace(image, box, background, foreground, destination):
    image = image.crop(box).convert("RGB")
    palette = [background, *foreground]
    pixels = []
    for pixel in image.get_flattened_data():
        match = min(palette, key=lambda color: distance(pixel, color))
        pixels.append((*match, 0 if match == background else 255))
    svg = vtracer.convert_pixels_to_svg(
        pixels, image.size, colormode="color", hierarchical="cutout",
        mode="spline", filter_speckle=5, color_precision=8,
        layer_difference=16, length_threshold=4.0, path_precision=3,
    )
    width, height = image.size
    svg = svg.replace(f'width="{width}" height="{height}"', f'viewBox="0 0 {width} {height}"', 1)
    destination.write_text(svg, encoding="utf-8")
    print(f"{destination.name}: {destination.stat().st_size} bytes")


def main():
    logo_path, swatch_path, output_path = map(Path, sys.argv[1:4])
    output_path.mkdir(parents=True, exist_ok=True)
    logo = Image.open(logo_path)
    swatch = Image.open(swatch_path)
    trace(logo, (0, 0, logo.width, logo.height), WHITE, [NAVY, YELLOW, RED], output_path / "pam-symbol-white.svg")
    # Each swatch row is cropped inside its framing/border; the crop retains
    # the exact relative geometry of the provided lockup and caption.
    rows = [
        ("white", (20, 25, 655, 151), WHITE, [NAVY, YELLOW, RED]),
        ("navy", (20, 189, 655, 317), NAVY, [WHITE]),
        ("yellow", (20, 361, 655, 490), YELLOW, [NAVY]),
        ("red", (20, 538, 655, 666), RED, [WHITE]),
    ]
    for name, box, background, foreground in rows:
        trace(swatch, box, background, foreground, output_path / f"pam-lockup-{name}.svg")
        if name != "white":
            symbol_box = (box[0], box[1], 244, box[3])
            trace(swatch, symbol_box, background, foreground, output_path / f"pam-symbol-{name}.svg")


if __name__ == "__main__":
    main()
