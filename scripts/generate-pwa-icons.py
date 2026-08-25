from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"


def generate_icon(size: int) -> None:
    scale = 4
    canvas_size = size * scale
    image = Image.new("RGB", (canvas_size, canvas_size), "#1f5c4a")
    draw = ImageDraw.Draw(image)

    margin = int(canvas_size * 0.19)
    draw.rounded_rectangle(
        (0, 0, canvas_size - 1, canvas_size - 1),
        radius=int(canvas_size * 0.25),
        fill="#1f5c4a",
    )

    leaf = [
        (int(canvas_size * 0.29), int(canvas_size * 0.56)),
        (int(canvas_size * 0.37), int(canvas_size * 0.37)),
        (int(canvas_size * 0.69), int(canvas_size * 0.28)),
        (int(canvas_size * 0.71), int(canvas_size * 0.55)),
        (int(canvas_size * 0.56), int(canvas_size * 0.72)),
        (int(canvas_size * 0.34), int(canvas_size * 0.69)),
    ]
    draw.polygon(leaf, fill="#f4c86a")
    draw.line(
        (
            int(canvas_size * 0.32),
            int(canvas_size * 0.67),
            int(canvas_size * 0.68),
            int(canvas_size * 0.33),
        ),
        fill="#fffaf0",
        width=max(1, int(canvas_size * 0.055)),
        joint="curve",
    )

    image = image.resize((size, size), Image.Resampling.LANCZOS)
    image.save(PUBLIC_DIR / f"pwa-{size}x{size}.png", format="PNG", optimize=True)


if __name__ == "__main__":
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for icon_size in (192, 512):
        generate_icon(icon_size)
