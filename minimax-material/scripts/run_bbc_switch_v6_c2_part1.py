import json
import time
import uuid
import urllib.request
from pathlib import Path

PROMPT = Path(__file__).resolve().parents[1].joinpath(
    "prompts", "wan30-bbc-switch-minimax-v6-c2-part1.txt"
).read_text(encoding="utf-8").strip()

base = json.loads(
    Path(
        r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"
    ).read_text(encoding="utf-8")
)
wf = base["prompt"] if "prompt" in base else base
wf["200"]["inputs"]["image"] = "mcp/v6-c1-last.jpg"
wf["104"]["inputs"]["prompt"] = PROMPT
wf["104"]["inputs"]["width"] = 1344
wf["104"]["inputs"]["height"] = 768
wf["104"]["inputs"]["length"] = 243
wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
wf["9"]["inputs"]["steps"] = 50
wf["91"]["inputs"].pop("audio", None)
wf.pop("23", None)
wf["92"]["inputs"]["filename_prefix"] = "video/tigra_bbc_switch_v6_c2_part1_10s"
wf["93"] = {
    "class_type": "VHS_VideoCombine",
    "inputs": {
        "images": ["10", 0],
        "frame_rate": 24.0,
        "loop_count": 0,
        "filename_prefix": "video/tigra_bbc_switch_v6_c2_part1_10s_vhs",
        "format": "video/h264-mp4",
        "pingpong": False,
        "save_output": True,
        "pix_fmt": "yuv420p",
        "crf": 19,
        "save_metadata": True,
        "trim_to_audio": False,
    },
}

client_id = str(uuid.uuid4())
req = urllib.request.Request(
    "http://127.0.0.1:8188/prompt",
    data=json.dumps({"prompt": wf, "client_id": client_id}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=60) as response:
    resp = json.loads(response.read())
    print("prompt_id", resp["prompt_id"])
    print("client_id", client_id)
