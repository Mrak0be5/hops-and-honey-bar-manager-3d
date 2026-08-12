#!/usr/bin/env python3
"""Generate Tigra-on-red-sofa via kie.ai Wan 2.7.

Default pipeline (I2V from first frame):
  1) Upload character sheet (+ optional front crop)
  2) Seedream 5 Pro i2i -> first frame (lying on red sofa, head hanging, mouth open)
  3) Wan 2.7 image-to-video from that first frame

Alt: MODE=r2v uses wan/2-7-r2v with reference images (no Seedream first frame).
Alt: MODE=i2v-only skips Seedream and uses FIRST_FRAME path / URL.

Requires: export KIE_API_KEY=...
Docs: https://docs.kie.ai/market/wan/2-7-image-to-video
      https://kie.ai/wan-2-7-video
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from kie_client import (  # noqa: E402
    create_task,
    download,
    poll_task,
    result_urls,
    upload_file,
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def make_first_frame(sheet_url: str, front_url: str | None, prompt: str, out: Path) -> str:
    image_urls = [sheet_url]
    if front_url:
        image_urls.append(front_url)
    task_id = create_task(
        "seedream/5-pro-image-to-image",
        {
            "prompt": prompt,
            "image_urls": image_urls,
            "aspect_ratio": os.environ.get("ASPECT_RATIO", "9:16"),
            "quality": os.environ.get("SEEDREAM_QUALITY", "high"),
            "output_format": "png",
            "nsfw_checker": False,
        },
    )
    data = poll_task(task_id, interval=5.0, timeout=900.0)
    urls = result_urls(data)
    if not urls:
        raise SystemExit(f"Seedream produced no URLs: {data}")
    download(urls[0], out)
    return urls[0]


def wan_i2v(first_frame_url: str, prompt: str, negative: str, out: Path) -> Path:
    duration = int(os.environ.get("DURATION", "5"))
    resolution = os.environ.get("RESOLUTION", "1080p")
    task_id = create_task(
        "wan/2-7-image-to-video",
        {
            "prompt": prompt,
            "negative_prompt": negative[:500],
            "first_frame_url": first_frame_url,
            "resolution": resolution,
            "duration": duration,
            "prompt_extend": os.environ.get("PROMPT_EXTEND", "false").lower()
            in ("1", "true", "yes"),
            "watermark": False,
            "nsfw_checker": False,
        },
    )
    data = poll_task(task_id, interval=10.0, timeout=1800.0)
    urls = result_urls(data)
    if not urls:
        raise SystemExit(f"Wan I2V produced no URLs: {data}")
    return download(urls[0], out)


def wan_r2v(
    refs: list[str],
    prompt: str,
    negative: str,
    out: Path,
    first_frame_url: str | None = None,
) -> Path:
    duration = int(os.environ.get("DURATION", "5"))
    resolution = os.environ.get("RESOLUTION", "1080p")
    aspect = os.environ.get("ASPECT_RATIO", "9:16")
    payload: dict = {
        "prompt": prompt,
        "negative_prompt": negative[:500],
        "reference_image": refs[:5],
        "resolution": resolution,
        "aspect_ratio": aspect,
        "duration": duration,
        "prompt_extend": True,
        "watermark": False,
        "nsfw_checker": False,
    }
    if first_frame_url:
        payload["first_frame"] = first_frame_url
    task_id = create_task("wan/2-7-r2v", payload)
    data = poll_task(task_id, interval=10.0, timeout=1800.0)
    urls = result_urls(data)
    if not urls:
        raise SystemExit(f"Wan R2V produced no URLs: {data}")
    return download(urls[0], out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--mode",
        choices=("i2v", "i2v-only", "r2v"),
        default=os.environ.get("MODE", "i2v"),
    )
    ap.add_argument(
        "--sheet",
        type=Path,
        default=ROOT / "frames" / "tigra_sheet_anatomy_best.png",
    )
    ap.add_argument(
        "--front",
        type=Path,
        default=ROOT / "frames" / "tigra-front-from-sheet.png",
    )
    ap.add_argument(
        "--first-frame",
        type=Path,
        default=None,
        help="Local first-frame PNG for i2v-only / optional r2v first_frame",
    )
    ap.add_argument(
        "--first-frame-url",
        default=os.environ.get("FIRST_FRAME_URL"),
        help="Already-hosted first frame URL",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=ROOT / "output" / "tigra-sofa-red-wan27.mp4",
    )
    args = ap.parse_args()

    ff_prompt = read_text(ROOT / "prompts" / "sofa-red-first-frame.txt")
    i2v_prompt = read_text(ROOT / "prompts" / "sofa-red-i2v.txt")
    negative = read_text(ROOT / "prompts" / "sofa-red-negative.txt")
    # For r2v, combine scene intent into one prompt
    r2v_prompt = ff_prompt + "\n\nSubtle idle motion: breathing, soft blinks, mouth stays wide open, gentle camera push-in, 5 seconds."

    sheet_url = None
    front_url = None
    if args.mode in ("i2v", "r2v"):
        sheet_url = upload_file(args.sheet, "wan-2-7/tigra-sheet")
        if args.front.is_file():
            front_url = upload_file(args.front, "wan-2-7/tigra-front")

    first_frame_url = args.first_frame_url
    first_frame_local = ROOT / "output" / "tigra-sofa-red-first-frame.png"

    if args.mode == "i2v":
        assert sheet_url
        first_frame_url = make_first_frame(
            sheet_url, front_url, ff_prompt, first_frame_local
        )
        wan_i2v(first_frame_url, i2v_prompt, negative, args.out)
    elif args.mode == "i2v-only":
        if not first_frame_url:
            src = args.first_frame or (ROOT / "frames" / "first-frame-standing-white.png")
            first_frame_url = upload_file(src, "wan-2-7/first-frame")
        wan_i2v(first_frame_url, i2v_prompt if args.first_frame or args.first_frame_url else ff_prompt + "\n\n" + i2v_prompt, negative, args.out)
    else:  # r2v
        refs = [u for u in (sheet_url, front_url) if u]
        if args.first_frame:
            first_frame_url = upload_file(args.first_frame, "wan-2-7/first-frame")
        wan_r2v(refs, r2v_prompt, negative, args.out, first_frame_url)

    print(args.out)


if __name__ == "__main__":
    main()
