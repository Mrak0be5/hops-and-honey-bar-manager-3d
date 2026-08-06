"""Queue 5s MiniMax H3 I2V (city blogger handstand) on local ComfyUI :8188.

Per local instruction (sulphur-ai / Stability Matrix):
- Start ComfyUI ONLY via Stability Matrix
- API: http://127.0.0.1:8188
- Optional public tunnel: C:\\cloudflare\\сomfyui_cloudflared_8188.bat

Cloud agents cannot reach 127.0.0.1 on your PC — run this on Windows
or point COMFY_URL at a live Cloudflare tunnel URL.
"""

from __future__ import annotations

import json
import os
import shutil
import time
import urllib.error
import urllib.request
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path

COMFY = os.environ.get("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
DOCS = Path(r"C:\Users\hebp\OneDrive\Документы\Sorter\civitai-model-recovery")
SOURCE_WORKFLOW = Path(
    os.environ.get(
        "MINIMAX_H3_WORKFLOW",
        str(DOCS / "MiniMax_H3_I2V_workflow_saved_20260805.json"),
    )
)
COMFY_INPUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input")
COMFY_VIDEO_OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video")
WS = Path(r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d")
if not WS.exists():
    WS = Path(__file__).resolve().parents[2]
FRAMES = WS / "minimax-material" / "frames"
PROMPTS = WS / "minimax-material" / "prompts"
DESKTOP_REF = Path(r"C:\Users\hebp\OneDrive\Desktop\tiger-character-ref.png")
LOCAL_OUT = WS / "minimax-material" / "output"

# ~5s @ 24fps (H3 length grid; adjust if your node expects different pacing)
FRAME_COUNT = int(os.environ.get("FRAME_COUNT", "121"))
INPUT_NAME = "tigra_city_blogger_first_frame_5s.png"
FILENAME_PREFIX = "video/tigra_city_blogger_handstand_5s"
PROMPT_FILE = PROMPTS / "handstand-city-blogger-5s.txt"


def load_prompt() -> str:
    if not PROMPT_FILE.exists():
        raise FileNotFoundError(PROMPT_FILE)
    return PROMPT_FILE.read_text(encoding="utf-8").strip()


def request_json(url: str, payload: dict | None = None, timeout: int = 60) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data else {},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def pick_first_frame() -> Path:
    for path in (
        FRAMES / "first-frame-standing-white.png",
        FRAMES / "first-frame-standing-1x1.png",
        FRAMES / "first-frame-source.png",
        DESKTOP_REF,
    ):
        if path.exists():
            return path
    raise FileNotFoundError("No first-frame under minimax-material/frames")


def main() -> None:
    prompt_text = load_prompt()
    print(json.dumps({"comfy": COMFY, "check": "system_stats"}, ensure_ascii=False))
    try:
        stats = request_json(f"{COMFY}/system_stats")
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"ComfyUI unreachable at {COMFY}: {exc}\n"
            "1) Start ComfyUI via Stability Matrix\n"
            "2) Or run C:\\cloudflare\\сomfyui_cloudflared_8188.bat and set COMFY_URL=<tunnel>\n"
            "3) Or use cloud mmx: ./minimax-material/scripts/generate_city_blogger_5s.sh"
        ) from exc

    print(
        json.dumps(
            {
                "comfyui": stats.get("system", {}).get("comfyui_version"),
                "device": (stats.get("devices") or [{}])[0].get("name"),
            },
            ensure_ascii=False,
        )
    )

    if not SOURCE_WORKFLOW.exists():
        raise SystemExit(f"Missing workflow JSON: {SOURCE_WORKFLOW}")

    src = pick_first_frame()
    # When COMFY is a remote tunnel, local Windows input copy may not apply;
    # still attempt local path when present.
    if COMFY_INPUT.exists():
        COMFY_INPUT.mkdir(parents=True, exist_ok=True)
        dest = COMFY_INPUT / INPUT_NAME
        shutil.copy2(src, dest)
        image_name = INPUT_NAME
        print(json.dumps({"copied_to": str(dest)}, ensure_ascii=False))
    else:
        image_name = INPUT_NAME
        print(
            json.dumps(
                {
                    "warn": "ComfyUI input folder not on this machine; ensure image is uploaded to Comfy input",
                    "local_frame": str(src),
                    "expected_input_name": INPUT_NAME,
                },
                ensure_ascii=False,
            )
        )

    LOCAL_OUT.mkdir(parents=True, exist_ok=True)
    raw = json.loads(SOURCE_WORKFLOW.read_text(encoding="utf-8-sig"))
    prompt = deepcopy(raw.get("prompt", raw))
    for node_id in ("4", "5", "29:0", "29:1", "29:2", "9:0", "9:1"):
        prompt.pop(node_id, None)

    prompt["200"] = {"class_type": "LoadImage", "inputs": {"image": image_name}}
    if "104" not in prompt:
        raise RuntimeError("Workflow missing MiniMaxH3ImageToVideo node 104")
    prompt["104"]["inputs"].update(
        {
            "first_frame": ["200", 0],
            "prompt": prompt_text,
            "length": FRAME_COUNT,
        }
    )
    inputs_104 = prompt["104"]["inputs"]
    if "width" in inputs_104 and "height" in inputs_104:
        w, h = int(inputs_104["width"]), int(inputs_104["height"])
        if w > h:
            inputs_104["width"], inputs_104["height"] = 768, 1344
    if "15" in prompt and "inputs" in prompt["15"]:
        prompt["15"]["inputs"]["noise_seed"] = int(time.time_ns() % (2**63 - 1))
    if "92" in prompt and "inputs" in prompt["92"]:
        prompt["92"]["inputs"]["filename_prefix"] = FILENAME_PREFIX

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    if DOCS.exists():
        saved = DOCS / f"MiniMax_H3_tigra_city_blogger_5s_api_{stamp}.json"
        saved.write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"workflow_saved": str(saved)}, ensure_ascii=False))
    local_saved = LOCAL_OUT / f"api_prompt_5s_{stamp}.json"
    local_saved.write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")

    try:
        queued = request_json(
            f"{COMFY}/prompt",
            {"prompt": prompt, "client_id": str(uuid.uuid4())},
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ComfyUI /prompt failed: {exc.code} {body}") from exc

    prompt_id = queued.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(json.dumps(queued, ensure_ascii=False))
    print(json.dumps({"prompt_id": prompt_id, "length": FRAME_COUNT}, ensure_ascii=False))

    while True:
        history = request_json(f"{COMFY}/history/{prompt_id}")
        if prompt_id in history:
            item = history[prompt_id]
            status = item.get("status", {})
            if status.get("completed") or status.get("status_str") in {"success", "error"}:
                hist_path = LOCAL_OUT / f"run_city_blogger_5s_{stamp}_history.json"
                hist_path.write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
                print(json.dumps({"status": status, "history_saved": str(hist_path)}, ensure_ascii=False))
                for node_id, node_out in (item.get("outputs") or {}).items():
                    for key in ("images", "gifs", "videos"):
                        for entry in node_out.get(key, []) or []:
                            print(json.dumps({"node": node_id, "output": entry}, ensure_ascii=False))
                if status.get("status_str") == "error":
                    raise RuntimeError("ComfyUI execution_error")
                if COMFY_VIDEO_OUT.exists():
                    vids = sorted(
                        COMFY_VIDEO_OUT.glob("tigra_city_blogger_handstand_5s*"),
                        key=lambda p: p.stat().st_mtime,
                        reverse=True,
                    )
                    if vids:
                        target = LOCAL_OUT / vids[0].name
                        shutil.copy2(vids[0], target)
                        print(json.dumps({"copied_video": str(target)}, ensure_ascii=False))
                break
        time.sleep(3)


if __name__ == "__main__":
    main()
