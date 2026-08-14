import json
import time
import uuid
import urllib.request

ref2va_wf = {
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
            "steps": 30,
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
    "23": {
        "class_type": "VAEDecodeAudio",
        "inputs": {"samples": ["14", 0], "vae": ["24", 0]},
    },
    "91": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["10", 0],
            "audio": ["23", 0],
            "fps": 24.0,
            "bit_depth": 8,
        },
    },
    "92": {
        "class_type": "SaveVideo",
        "inputs": {
            "video": ["91", 0],
            "filename_prefix": "video/tigra_part1_v4_10s_ref2va_nonturbo",
            "format": "auto",
            "codec": "auto",
        },
    },
    "200": {
        "class_type": "LoadImage",
        "inputs": {"image": "mcp/tigra-scene-part1.png", "upload": "image"},
    },
    "202": {
        "class_type": "LoadImage",
        "inputs": {
            "image": "mcp/ref-male-sheet-style-matched.png",
            "upload": "image",
        },
    },
    "105": {
        "class_type": "MiniMaxH3ReferenceToVideo",
        "inputs": {
            "clip": ["13", 0],
            "vae": ["11", 0],
            "audio_vae": ["24", 0],
            "prompt": (
                "Cinematic 24fps medium-wide cabin shot. Keep the exact framing, camera distance, and composition of <Picture 1> for the entire clip. "
                "Do not zoom into genitals. Do not fill the frame with a penis close-up. Do not copy any character-sheet or anatomy-sheet layout. "
                "The camera slowly orbits a little to the right around Tigra, revealing more of the man behind her while staying a medium-wide shot of the table scene. "
                "<Picture 1> is the starting scene and the only composition reference. Tigra (female anthropomorphic tiger, orange fur, black stripes, white belly, short white hair) is bent over a wooden table. "
                "Her left leg stays raised high exactly as in <Picture 1>, do not lower her leg. A coffee mug sits on the table. "
                "Behind her a muscular human male performs deep anal sex using the penis already visible in <Picture 1>. "
                "<Picture 2> is identity reference only for the man's face, beard, muscular body, and skin tone. Do not copy <Picture 2> turnaround layout. "
                "Tigra looks bored and looks at the camera. She picks up the coffee mug with her right hand and drinks. "
                "While drinking she arches her lower back and shows her breasts to the camera. "
                "The man makes exactly 3 very strong deep thrusts. On every thrust Tigra winces in discomfort. "
                "Highly detailed textures, anatomically precise, natural body motion."
            ),
            "width": 1344,
            "height": 768,
            "length": 243,
            "ref_image_size": "match",
            "ref_image_0": ["200", 0],
            "ref_image_1": ["202", 0],
        },
    },
}

client_id = str(uuid.uuid4())
req_data = json.dumps({"prompt": ref2va_wf, "client_id": client_id}).encode("utf-8")
req = urllib.request.Request(
    "http://127.0.0.1:8188/prompt",
    data=req_data,
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(req) as response:
    resp_data = json.loads(response.read())
    print(f"Workflow submitted successfully! Prompt ID: {resp_data['prompt_id']}")
