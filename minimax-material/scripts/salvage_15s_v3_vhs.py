import json
import uuid
import urllib.request

h = json.load(
    urllib.request.urlopen(
        "http://127.0.0.1:8188/history/f7efba91-df69-4899-9714-55a81e0d128a"
    )
)
wf = h["f7efba91-df69-4899-9714-55a81e0d128a"]["prompt"][2]
wf.pop("91", None)
wf.pop("92", None)
wf.pop("23", None)
wf["93"] = {
    "class_type": "VHS_VideoCombine",
    "inputs": {
        "images": ["14", 0],
        "vae": ["11", 0],
        "frame_rate": 24.0,
        "loop_count": 0,
        "filename_prefix": "video/tigra_wan30_bbc_switch_ref2va_nonturbo_15s_v3_vhs",
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
with urllib.request.urlopen(req) as response:
    resp = json.loads(response.read())
    print("prompt_id", resp["prompt_id"])
    print("seed", wf["15"]["inputs"]["noise_seed"])
    print("client_id", client_id)
