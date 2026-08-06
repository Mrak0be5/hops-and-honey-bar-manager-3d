"""Run 10s MiniMax H3 I2V handstand from solo white-bg first frame via local ComfyUI."""

from __future__ import annotations

import json
import shutil
import time
import urllib.error
import urllib.request
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
DOCS = Path(r"C:\Users\hebp\OneDrive\Документы\Sorter\civitai-model-recovery")
SOURCE_WORKFLOW = DOCS / "MiniMax_H3_I2V_workflow_saved_20260805.json"
COMFY_INPUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input")
COMFY_VIDEO_OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video")
WS = Path(r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d")
FRAMES = WS / "minimax-material" / "frames"
DESKTOP_REF = Path(r"C:\Users\hebp\OneDrive\Desktop\tiger-character-ref.png")
LOCAL_OUT = WS / "minimax-material" / "output"

# 10s @ 24fps on MiniMax H3 grid 17k+5 -> length 243 (~10.125s)
FRAME_COUNT = 243
INPUT_NAME = "tigra_handstand_first_frame.png"
FILENAME_PREFIX = "video/tigra_handstand_straddle_10s"

PROMPT = (
    "Single continuous shot, exactly one adult anthropomorphic female tigress character "
    "on a seamless pure white background. "
    "0-3 seconds: the character shifts her weight forward, places both hands on the floor, "
    "and smoothly lifts into a controlled handstand. "
    "3-6 seconds: she stabilizes in a straight vertical handstand, arms locked, body balanced, "
    "striped tiger tail moving naturally for balance. "
    "6-10 seconds: while maintaining the handstand, she slowly opens both legs into a wide "
    "symmetrical straddle split and holds the pose. "
    "Static full-body camera, the entire character remains visible, smooth realistic motion, "
    "stable identity and anatomy matching the first frame exactly, orange fur with black stripes, "
    "platinum bob hair, green eyes, nude athletic body. "
    "No cuts, no extra characters, no duplicated limbs, no camera movement, no text, no props."
)


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
    preferred = [
        FRAMES / "first-frame-standing-white.png",
        FRAMES / "first-frame-standing-1x1.png",
        FRAMES / "first-frame-source.png",
        DESKTOP_REF,
    ]
    for path in preferred:
        if path.exists():
            return path
    raise FileNotFoundError(
        "No first-frame found. Expected files under minimax-material/frames or desktop tiger-character-ref.png"
    )


def main() -> None:
    print("ComfyUI check...")
    stats = request_json(f"{COMFY}/system_stats")
    print(
        json.dumps(
            {
                "comfyui": stats.get("system", {}).get("comfyui_version"),
                "device": (stats.get("devices") or [{}])[0].get("name"),
            },
            ensure_ascii=False,
        )
    )

    src = pick_first_frame()
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    LOCAL_OUT.mkdir(parents=True, exist_ok=True)
    dest = COMFY_INPUT / INPUT_NAME
    shutil.copy2(src, dest)
    print(json.dumps({"first_frame_src": str(src), "copied_to": str(dest)}, ensure_ascii=False))

    raw = json.loads(SOURCE_WORKFLOW.read_text(encoding="utf-8-sig"))
    prompt = deepcopy(raw.get("prompt", raw))

    # Remove previous SDXL-generated first-frame branch if present.
    for node_id in ("4", "5", "29:0", "29:1", "29:2", "9:0", "9:1"):
        prompt.pop(node_id, None)

    prompt["200"] = {
        "class_type": "LoadImage",
        "inputs": {"image": INPUT_NAME},
    }
    if "104" not in prompt:
        raise RuntimeError("Workflow missing MiniMaxH3ImageToVideo node 104")
    prompt["104"]["inputs"].update(
        {
            "first_frame": ["200", 0],
            "prompt": PROMPT,
            "length": FRAME_COUNT,
        }
    )
    # Prefer portrait if the node already has width/height; keep existing if set.
    inputs_104 = prompt["104"]["inputs"]
    # 9:16-ish for handstand headroom if defaults are landscape
    if "width" in inputs_104 and "height" in inputs_104:
        # Keep model-valid sizes; only swap to portrait when landscape was default
        w, h = int(inputs_104["width"]), int(inputs_104["height"])
        if w > h:
            inputs_104["width"], inputs_104["height"] = 768, 1344

    if "15" in prompt and "inputs" in prompt["15"]:
        prompt["15"]["inputs"]["noise_seed"] = int(time.time_ns() % (2**63 - 1))
    if "92" in prompt and "inputs" in prompt["92"]:
        prompt["92"]["inputs"]["filename_prefix"] = FILENAME_PREFIX

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    saved_prompt = DOCS / f"MiniMax_H3_tigra_handstand_api_{stamp}.json"
    saved_prompt.write_text(json.dumps(prompt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "workflow_saved": str(saved_prompt),
                "length": FRAME_COUNT,
                "size": [inputs_104.get("width"), inputs_104.get("height")],
            },
            ensure_ascii=False,
        )
    )

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
    print(json.dumps({"prompt_id": prompt_id}, ensure_ascii=False))

    while True:
        history = request_json(f"{COMFY}/history/{prompt_id}")
        if prompt_id in history:
            item = history[prompt_id]
            status = item.get("status", {})
            if status.get("completed") or status.get("status_str") in {"success", "error"}:
                out_path = LOCAL_OUT / f"run_{stamp}_history.json"
                out_path.write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
                print(json.dumps({"status": status, "history_saved": str(out_path)}, ensure_ascii=False))
                outputs = item.get("outputs", {})
                for node_id, node_out in outputs.items():
                    for key in ("images", "gifs", "videos"):
                        for entry in node_out.get(key, []) or []:
                            print(json.dumps({"node": node_id, "output": entry}, ensure_ascii=False))
                if status.get("status_str") == "error" or status.get("status_str") == "error":
                    raise RuntimeError("ComfyUI execution_error — see history json")
                # Copy newest matching video if present
                if COMFY_VIDEO_OUT.exists():
                    vids = sorted(
                        COMFY_VIDEO_OUT.glob("tigra_handstand_straddle_10s*"),
                        key=lambda p: p.stat().st_mtime,
                        reverse=True,
                    )
                    if vids:
                        target = LOCAL_OUT / vids[0].name
                        shutil.copy2(vids[0], target)
                        print(json.dumps({"copied_video": str(target)}, ensure_ascii=False))
                break
        time.sleep(5)


if __name__ == "__main__":
    main()
