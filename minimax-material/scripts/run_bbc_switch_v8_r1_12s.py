import json
import time
import uuid
import urllib.request
from pathlib import Path

PROMPT = Path(__file__).resolve().parents[1].joinpath(
    "prompts", "wan30-bbc-switch-minimax-v8-r1-12s.txt"
).read_text(encoding="utf-8").strip()

wf = {
    "6": {
        "class_type": "UNETLoader",
        "inputs": {
            "unet_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
            "weight_dtype": "default",
        },
    },
    "13": {
        "class_type": "CLIPLoader",
        "inputs": {
            "clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
            "type": "minimax",
            "device": "default",
        },
    },
    "11": {
        "class_type": "VAELoader",
        "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"},
    },
    "24": {
        "class_type": "VAELoader",
        "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"},
    },
    "15": {
        "class_type": "RandomNoise",
        "inputs": {"noise_seed": int(time.time() * 1000) % 1000000000},
    },
    "17": {
        "class_type": "KSamplerSelect",
        "inputs": {"sampler_name": "res_multistep"},
    },
    "9": {
        "class_type": "BasicScheduler",
        "inputs": {
            "scheduler": "simple",
            "steps": 50,
            "denoise": 1.0,
            "model": ["6", 0],
        },
    },
    "16": {
        "class_type": "BasicGuider",
        "inputs": {"model": ["6", 0], "conditioning": ["105", 0]},
    },
    "14": {
        "class_type": "SamplerCustomAdvanced",
        "inputs": {
            "noise": ["15", 0],
            "guider": ["16", 0],
            "sampler": ["17", 0],
            "sigmas": ["9", 0],
            "latent_image": ["105", 1],
        },
    },
    "10": {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["14", 0], "vae": ["11", 0]},
    },
    "91": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["10", 0],
            "fps": 24.0,
            "bit_depth": 8,
        },
    },
    "92": {
        "class_type": "SaveVideo",
        "inputs": {
            "video": ["91", 0],
            "filename_prefix": "video/tigra_bbc_switch_v8_r1_12s",
            "format": "auto",
            "codec": "auto",
        },
    },
    "93": {
        "class_type": "VHS_VideoCombine",
        "inputs": {
            "images": ["10", 0],
            "frame_rate": 24.0,
            "loop_count": 0,
            "filename_prefix": "video/tigra_bbc_switch_v8_r1_12s_vhs",
            "format": "video/h264-mp4",
            "pingpong": False,
            "save_output": True,
            "pix_fmt": "yuv420p",
            "crf": 19,
            "save_metadata": True,
            "trim_to_audio": False,
        },
    },
    "200": {
        "class_type": "LoadImage",
        "inputs": {"image": "mcp/02-pose-env.jpg", "upload": "image"},
    },
    "201": {
        "class_type": "LoadImage",
        "inputs": {"image": "mcp/01-identity.jpg", "upload": "image"},
    },
    "202": {
        "class_type": "LoadImage",
        "inputs": {"image": "mcp/03-man.jpg", "upload": "image"},
    },
    "203": {
        "class_type": "LoadImage",
        "inputs": {"image": "mcp/04-penis-side.png", "upload": "image"},
    },
    "105": {
        "class_type": "MiniMaxH3ReferenceToVideo",
        "inputs": {
            "clip": ["13", 0],
            "vae": ["11", 0],
            "audio_vae": ["24", 0],
            "prompt": PROMPT,
            "width": 1024,
            "height": 576,
            "length": 294,
            "ref_image_size": "match",
            "ref_image_0": ["200", 0],
            "ref_image_1": ["201", 0],
            "ref_image_2": ["202", 0],
            "ref_image_3": ["203", 0],
        },
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
