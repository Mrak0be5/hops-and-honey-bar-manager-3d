import json
import urllib.request
wf = {
  "105": {
    "class_type": "MiniMaxH3ReferenceToVideo",
    "inputs": {
      "clip": ["13", 0],
      "vae": ["11", 0],
      "audio_vae": ["24", 0],
      "prompt": "test",
      "width": 1344,
      "height": 768,
      "length": 124,
      "ref_image_size": "match",
      "ref_image_0": ["200", 0]
    }
  },
  "200": {
    "class_type": "LoadImage",
    "inputs": {"image": "mcp/tigra-pool-anal-first.png", "upload": "image"}
  },
  "13": { "class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"} },
  "11": { "class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"} },
  "24": { "class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"} },
  "10": { "class_type": "VAEDecode", "inputs": {"samples": ["105", 1], "vae": ["11", 0]} },
  "92": { "class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": "test"} }
}
req = urllib.request.Request('http://127.0.0.1:8188/prompt', data=json.dumps({"prompt": wf}).encode('utf-8'))
try:
    resp = urllib.request.urlopen(req)
    print(resp.read())
except urllib.error.HTTPError as e:
    print("Error:", e.read())
