import json
import time
import uuid
import urllib.request

PROMPT = (
    "Cinematic 24fps 16:9 medium-wide cabin shot, 10 seconds, explicit adult animation, continuous single take, no hard cuts. "
    "Keep the exact framing, camera distance, and composition of <Picture 1> for the entire clip. "
    "STATIC locked-off medium-wide side shot. No dolly, no zoom, no orbit, no genital close-up. "
    "Do not fill the frame with a penis. Do not copy any character-sheet, T-pose, or anatomy-sheet layout. "
    "<Picture 1> is the starting scene and the only composition reference: wooden cabin night interior, wooden table, fruit bowl, coffee cup, raised-leg mating-press pose, anal penetration already visible. "
    "<Picture 2> is tiger woman identity ONLY: white bob hair, orange-black stripes, white underbelly, face, body proportions. Do not copy the T-pose sheet layout. "
    "<Picture 3> is the first man identity ONLY: muscular bearded nude man, face, hair, body. Do not copy the turnaround sheet layout. "
    "Action timeline, strict order: "
    "0-3s: the bearded man from <Picture 3> is anally fucking the tiger woman from behind in the <Picture 1> pose; clear anal penetration; her left leg stays raised. "
    "3-5s: he stops, pulls his penis fully out of her anus, and walks away to the RIGHT exiting off-screen; her anal hole is left visibly stretched open and gaped empty. "
    "5-7s: from the RIGHT edge of frame, a different nude BLACK man enters, dark skin, muscular, short hair, NOT the bearded man from <Picture 3>; he has an enormous thick dark erect penis; he lines up and inserts that huge cock deep into her already stretched anus. "
    "7-10s: she winces and wrinkles her face in pain and discomfort from the size; he continues thrusting anally with deep frictions. "
    "Keep tiger identity locked from <Picture 2>, pose and set from <Picture 1>, first man from <Picture 3> only for the opening. "
    "Same 2D illustration style as the references. Soft cabin lighting. No text, no watermark, no identity morph of the tigress, no extra limbs, no jump cuts. "
    "Highly detailed textures, anatomically precise, natural body motion."
)

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
            "filename_prefix": "video/tigra_wan30_bbc_switch_ref2va_nonturbo",
            "format": "auto",
            "codec": "auto",
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
    "105": {
        "class_type": "MiniMaxH3ReferenceToVideo",
        "inputs": {
            "clip": ["13", 0],
            "vae": ["11", 0],
            "audio_vae": ["24", 0],
            "prompt": PROMPT,
            "width": 1344,
            "height": 768,
            "length": 243,
            "ref_image_size": "match",
            "ref_image_0": ["200", 0],
            "ref_image_1": ["201", 0],
            "ref_image_2": ["202", 0],
        },
    },
}

client_id = str(uuid.uuid4())
req_data = json.dumps(
    {"prompt": wf, "client_id": client_id, "front": True}
).encode("utf-8")
req = urllib.request.Request(
    "http://127.0.0.1:8188/prompt",
    data=req_data,
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(req) as response:
    resp_data = json.loads(response.read())
    print(f"Workflow submitted successfully! Prompt ID: {resp_data['prompt_id']}")
    print(f"client_id={client_id}")
