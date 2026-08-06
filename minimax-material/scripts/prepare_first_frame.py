#!/usr/bin/env python3
"""Prepare MiniMax I2V first-frame from a solo Tigra PNG.

Rules (MiniMax-H3):
- first-frame must be ONE character on pure white (never a multi-panel sheet)
- 9:16 (1080x1920) with ~35-42% headroom above the head for handstand
- optional 1x1 square export

Usage:
  python3 prepare_first_frame.py [source.png]
  python3 prepare_first_frame.py frames/tigra_sheet_with_dilator.png --sheet
    # when --sheet: expects multi-panel; crops left/front panel only if
    # SOLO_CROP env not set — prefer dropping a solo standing PNG instead.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "frames"


def nonwhite_bbox(im: Image.Image, thr: int = 12):
    bg = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im.convert("RGB"), bg).convert("L")
    mask = diff.point(lambda p: 255 if p > thr else 0).filter(ImageFilter.MaxFilter(3))
    return mask.getbbox()


def purify_white(im: Image.Image, thr: int = 248) -> Image.Image:
    arr = np.array(im.convert("RGB"))
    near = (arr[:, :, 0] >= thr) & (arr[:, :, 1] >= thr) & (arr[:, :, 2] >= thr)
    arr[near] = [255, 255, 255]
    return Image.fromarray(arr)


def compose_916(
    char_im: Image.Image,
    out_w: int = 1080,
    out_h: int = 1920,
    headroom: float = 0.38,
    bottom_margin: float = 0.06,
    max_char_h_ratio: float = 0.52,
) -> Image.Image:
    char = purify_white(char_im)
    bbox = nonwhite_bbox(char)
    if not bbox:
        raise SystemExit("No character found on white background")
    l, t, r, b = bbox
    pad = 8
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(char.width, r + pad), min(char.height, b + pad)
    cropped = char.crop((l, t, r, b))
    cw, ch = cropped.size

    canvas = Image.new("RGB", (out_w, out_h), (255, 255, 255))
    target_h = int(out_h * max_char_h_ratio)
    target_w = int(cw * (target_h / ch))
    if target_w > int(out_w * 0.86):
        target_w = int(out_w * 0.86)
        target_h = int(ch * (target_w / cw))

    y2 = int(out_h * (1 - bottom_margin))
    y1 = y2 - target_h
    min_y1 = int(out_h * headroom)
    if y1 < min_y1:
        scale = (y2 - min_y1) / target_h
        target_h = int(target_h * scale)
        target_w = int(target_w * scale)
        y1 = y2 - target_h

    resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x1 = (out_w - target_w) // 2
    canvas.paste(resized, (x1, y1))

    shadow = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = out_w // 2
    sy = y2 - 4
    draw.ellipse(
        [cx - target_w * 0.22, sy - 10, cx + target_w * 0.22, sy + 14],
        fill=(0, 0, 0, 28),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB")


def compose_1x1(char_im: Image.Image, size: int = 2048, margin: float = 0.08) -> Image.Image:
    char = purify_white(char_im)
    bbox = nonwhite_bbox(char)
    if not bbox:
        raise SystemExit("No character found on white background")
    cropped = char.crop(bbox)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    cw, ch = cropped.size
    max_dim = int(size * (1 - 2 * margin))
    scale = min(max_dim / cw, max_dim / ch)
    nw, nh = int(cw * scale), int(ch * scale)
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def maybe_crop_front_from_sheet(sheet: Image.Image) -> Image.Image:
    """Heuristic: left third of a 3-view top sheet (Вид спереди)."""
    w, h = sheet.size
    # Prefer top row if aspect is wide (sheet-like)
    if w / h > 1.3:
        return sheet.crop((0, 0, w // 3, int(h * 0.55)))
    return sheet.crop((0, 0, w // 3, h))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "source",
        nargs="?",
        default=str(FRAMES / "first-frame-source.png"),
        help="Solo standing PNG (preferred) or sheet with --sheet",
    )
    ap.add_argument(
        "--sheet",
        action="store_true",
        help="Source is a multi-panel sheet; crop front panel only (lossy heuristic)",
    )
    ap.add_argument("--out-916", default=str(FRAMES / "first-frame-standing-white.png"))
    ap.add_argument("--out-1x1", default=str(FRAMES / "first-frame-standing-1x1.png"))
    args = ap.parse_args()

    src_path = Path(args.source)
    if not src_path.is_file():
        raise SystemExit(f"Missing source: {src_path}")

    im = Image.open(src_path).convert("RGB")
    if args.sheet:
        print(f"Cropping front panel from sheet {src_path} …")
        im = maybe_crop_front_from_sheet(im)
        crops = FRAMES / "crops"
        crops.mkdir(exist_ok=True)
        im.save(crops / "sheet-front-crop.png")

    frame = compose_916(im)
    Path(args.out_916).parent.mkdir(parents=True, exist_ok=True)
    frame.save(args.out_916, optimize=True)
    print(f"Wrote {args.out_916} {frame.size}")

    sq = compose_1x1(im if not args.sheet else Image.open(src_path).convert("RGB"))
    # For 1x1 prefer original solo; if sheet, use front crop
    if args.sheet:
        sq = compose_1x1(im)
    sq.save(args.out_1x1, optimize=True)
    print(f"Wrote {args.out_1x1} {sq.size}")


if __name__ == "__main__":
    main()
