import json
import urllib.request
import time
import uuid

workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"

try:
    with open(workflow_path, "r", encoding="utf-8") as f:
        api_wf = json.load(f)
        if "prompt" in api_wf:
            api_wf = api_wf["prompt"]
except FileNotFoundError:
    print(f"Error: Workflow file not found at {workflow_path}")
    exit(1)

ref2va_wf = {
    "6": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
        "weight_dtype": "default"
      }
    },
    "13": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
        "type": "minimax",
        "device": "default"
      }
    },
    "11": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": "minimax_h3_video_vae_fp16.safetensors"
      }
    },
    "24": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": "minimax_h3_audio_vae_fp32.safetensors"
      }
    },
    "15": {
      "class_type": "RandomNoise",
      "inputs": {
        "noise_seed": int(time.time() * 1000) % 1000000000
      }
    },
    "17": {
      "class_type": "KSamplerSelect",
      "inputs": {
        "sampler_name": "res_multistep"
      }
    },
    "9": {
      "class_type": "BasicScheduler",
      "inputs": {
        "scheduler": "simple",
        "steps": 30,
        "denoise": 1.0,
        "model": ["6", 0]
      }
    },
    "16": {
      "class_type": "BasicGuider",
      "inputs": {
        "model": ["6", 0],
        "conditioning": ["105", 0]
      }
    },
    "14": {
      "class_type": "SamplerCustomAdvanced",
      "inputs": {
        "noise": ["15", 0],
        "guider": ["16", 0],
        "sampler": ["17", 0],
        "sigmas": ["9", 0],
        "latent_image": ["105", 1]
      }
    },
    "10": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["14", 0],
        "vae": ["11", 0]
      }
    },
    "23": {
      "class_type": "VAEDecodeAudio",
      "inputs": {
        "samples": ["14", 0],
        "vae": ["24", 0]
      }
    },
    "91": {
      "class_type": "CreateVideo",
      "inputs": {
        "images": ["10", 0],
        "audio": ["23", 0],
        "fps": 24.0,
        "bit_depth": 8
      }
    },
    "92": {
      "class_type": "SaveVideo",
      "inputs": {
        "video": ["91", 0],
        "filename_prefix": "video/tigra_part1_v3_10s_ref2va_nonturbo",
        "format": "auto",
        "codec": "auto"
      }
    },
    "200": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "mcp/tigra-scene-part1.png",  # Picture 1: Scene
        "upload": "image"
      }
    },
    "201": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "mcp/ref-penis-sheet-2.png",  # Picture 2: Penis
        "upload": "image"
      }
    },
    "202": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "mcp/ref-male-sheet-style-matched.png",  # Picture 3: Male Body
        "upload": "image"
      }
    },
    "105": {
      "class_type": "MiniMaxH3ReferenceToVideo",
      "inputs": {
        "clip": ["13", 0],
        "vae": ["11", 0],
        "audio_vae": ["24", 0],
        "prompt": (
            "Cinematic 24fps shot. The camera slowly orbits horizontally to the right, showing more of the man's penis. "
            "IMPORTANT: Tigra MUST keep her left leg raised high up exactly as in <Picture 1>, do not lower her leg! "
            "<Picture 1> is the starting scene. Tigra (female anthropomorphic tiger, orange fur, black stripes) is bent over a wooden table, her leg stays UP. "
            "Behind her, a muscular human male is performing deep, forceful anal sex. "
            "<Picture 2> is the precise visual reference for his huge, thick penis. "
            "<Picture 3> is the precise visual reference for the human male's body and skin tone. "
            "Tigra has a bored facial expression. She picks up the coffee mug with her right hand and drinks from it. "
            "While drinking, she arches her back down heavily, proudly showing off her bare breasts to the camera. She looks directly at the camera. "
            "The man makes exactly 3 very strong, deep, forceful thrusts over the duration. "
            "With every single hard thrust, Tigra visibly winces in pain. "
            "Highly detailed textures, anatomically precise, natural body motion."
        ),
        "width": 1344,
        "height": 768,
        "length": 243, # 10s
        "ref_image_size": "match",
        "ref_image_0": ["200", 0],
        "ref_image_1": ["201", 0],
        "ref_image_2": ["202", 0]
      }
    }
}

client_id = str(uuid.uuid4())
req_data = json.dumps({"prompt": ref2va_wf, "client_id": client_id}).encode("utf-8")
req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=req_data, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as response:
        resp_data = json.loads(response.read())
        prompt_id = resp_data["prompt_id"]
        print(f"Workflow submitted successfully! Prompt ID: {prompt_id}")
        
except Exception as e:
    print(f"Error submitting workflow: {e}")
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
    exit(1)
