from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "bar-icon-atlas-source.png"
OUTPUT = ROOT / "public" / "assets" / "ui"
NAMES = [
    "coins",
    "reputation",
    "customers",
    "time-speed",
    "move-speed",
    "order-speed",
    "prep-speed",
    "clean-speed",
    "assortment",
    "advertising",
    "cash",
    "upgrades",
    "pause",
    "play",
    "sound",
    "reset",
]


def main() -> None:
    atlas = Image.open(SOURCE).convert("RGB")
    if atlas.size != (1024, 1024):
        raise ValueError(f"Expected a 1024x1024 atlas, got {atlas.size}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(NAMES):
        column = index % 4
        row = index // 4
        tile = atlas.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
        tile = tile.resize((192, 192), Image.Resampling.LANCZOS)
        tile.save(OUTPUT / f"{name}.webp", "WEBP", quality=92, method=6)

    atlas.resize((512, 512), Image.Resampling.LANCZOS).save(
        OUTPUT / "icon-atlas-preview.webp", "WEBP", quality=88, method=6
    )


if __name__ == "__main__":
    main()
