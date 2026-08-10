import json
import urllib.request
import time
import uuid
import os

workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"

try:
    with open(workflow_path, "r", encoding="utf-8") as f:
        api_wf = json.load(f)
        if "prompt" in api_wf:
            api_wf = api_wf["prompt"]
except FileNotFoundError:
    print(f"Error: Workflow file not found at {workflow_path}")
    exit(1)

# Configure the workflow
api_wf["200"]["inputs"]["image"] = "mcp/tigra-scene-part1.png"

prompt_text = (
    "Cinematic 24fps shot. The camera slowly orbits to the right. "
    "Tigra (female anthropomorphic tiger, orange fur, black stripes, white hair) is bent over a wooden table. "
    "She has a bored, displeased facial expression, looking around out of boredom. "
    "Then she picks up the coffee mug from the table and drinks from it. She looks directly at the camera the entire time. "
    "Behind her, a muscular human male is performing deep anal sex. He makes exactly 4 slow, deep, forceful thrusts over the duration. "
    "With every single thrust of his penis penetrating her, Tigra winces in discomfort. "
    "Highly detailed textures, anatomically precise, natural body motion."
)

api_wf["104"]["inputs"]["prompt"] = prompt_text
api_wf["104"]["inputs"]["width"] = 1344
api_wf["104"]["inputs"]["height"] = 768
api_wf["104"]["inputs"]["length"] = 243  # ~10s (24fps)

api_wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
api_wf["9"]["inputs"]["steps"] = 25
api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_part1_10s_fl2va_nonturbo"

client_id = str(uuid.uuid4())
req_data = json.dumps({"prompt": api_wf, "client_id": client_id}).encode("utf-8")
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
