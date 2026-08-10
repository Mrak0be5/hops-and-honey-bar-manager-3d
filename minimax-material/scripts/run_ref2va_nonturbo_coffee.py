import json
import urllib.request
import urllib.parse
import time
import uuid

# Define the full non-turbo workflow for Ref2VA
api_wf = {
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
        "steps": 25,  # Non-turbo standard steps
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
        "filename_prefix": "video/tigra_coffee_anal_ref2va_nonturbo",
        "format": "auto",
        "codec": "auto"
      }
    },
    "200": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "mcp/tigra-table-anal-new.png",
        "upload": "image"
      }
    },
    "201": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "mcp/ref-penis-sheet-2.png",
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
            "Cinematic 24fps shot. The camera orbits to the right and slowly pushes in towards Tigra's anus. "
            "<Picture 1> is the starting scene of Tigra (female anthropomorphic tiger, orange fur, black stripes, white belly, short white hair) bent over a wooden table. "
            "Behind her, a muscular human male is performing deep anal sex. <Picture 2> is the exact visual reference for his huge, thick, detailed penis (use this precise anatomy). "
            "Tigra looks bored and completely ignores the sex. She looks directly at the camera the entire time. "
            "She picks up a coffee mug from the table and drinks coffee from it. "
            "However, with every single thrust of the penis inside her, she winces in discomfort. "
            "At the end, he pulls the penis completely out of her anus, revealing a gaping hole (rosebud). "
            "Highly detailed textures, realistic lighting, anatomically precise."
        ),
        "width": 1344,
        "height": 768,
        "length": 362,
        "ref_image_size": "match",
        "ref_image_0": ["200", 0],
        "ref_image_1": ["201", 0]
      }
    }
}

# Submit to ComfyUI
client_id = str(uuid.uuid4())
req_data = json.dumps({"prompt": api_wf, "client_id": client_id}).encode("utf-8")
req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=req_data, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as response:
        resp_data = json.loads(response.read())
        prompt_id = resp_data["prompt_id"]
        print(f"Workflow submitted successfully! Prompt ID: {prompt_id}")
        
        # Wait for completion
        print("Waiting for generation to complete (non-turbo 25 steps, 15s)...")
        while True:
            hist_req = urllib.request.Request(f"http://127.0.0.1:8188/history/{prompt_id}")
            try:
                with urllib.request.urlopen(hist_req) as hist_resp:
                    hist_data = json.loads(hist_resp.read())
                    if prompt_id in hist_data:
                        print("\nGeneration completed!")
                        outputs = hist_data[prompt_id].get("outputs", {})
                        for node_id, node_output in outputs.items():
                            if "images" in node_output:
                                for img in node_output["images"]:
                                    print(f"Output saved as: {img['filename']} in {img.get('subfolder', '')}")
                        break
            except Exception as e:
                pass
            
            queue_req = urllib.request.Request("http://127.0.0.1:8188/queue")
            try:
                with urllib.request.urlopen(queue_req) as q_resp:
                    q_data = json.loads(q_resp.read())
                    pending = len(q_data.get("queue_running", [])) + len(q_data.get("queue_pending", []))
                    print(f"\rQueue status: {pending} items", end="")
            except:
                pass
                
            time.sleep(5)
            
except Exception as e:
    print(f"Error submitting workflow: {e}")
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
