import json
import urllib.request
import time
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

# Update inputs
# Note: minimax_h3_fl2va_q4_api.json uses node "200" for image and "104" for MiniMaxH3ImageToVideo
try:
    api_wf["200"]["inputs"]["image"] = "mcp/tigra-table-anal-new.png"
    
    prompt_text = (
        "Cinematic 24fps close-up shot. The camera slowly pushes in. "
        "A muscular human male is performing deep anal sex on Tigra (female anthropomorphic tiger, orange fur, black stripes, white belly). "
        "He performs 3 slow, forceful thrusts over the duration. With every thrust of his penis inside her, Tigra winces and moans in discomfort. "
        "At the end, he slowly pulls the penis completely out of her anus. "
        "When the penis is completely removed, her anus remains stretched open, showing a visible gaping hole (rosebud). "
        "Highly detailed textures, realistic lighting, anatomically precise, natural body motion."
    )
    
    api_wf["104"]["inputs"]["prompt"] = prompt_text
    api_wf["104"]["inputs"]["width"] = 1344
    api_wf["104"]["inputs"]["height"] = 768
    api_wf["104"]["inputs"]["length"] = 124  # 5s
    
    api_wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
    api_wf["9"]["inputs"]["steps"] = 25
    api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_table_anal_fl2va_nonturbo"
except KeyError as e:
    print(f"Error: Missing node or input in workflow structure: {e}")
    exit(1)

req = urllib.request.Request(
    "http://127.0.0.1:8188/prompt",
    data=json.dumps({"prompt": api_wf}).encode("utf-8")
)
resp = urllib.request.urlopen(req)
prompt_info = json.loads(resp.read())
prompt_id = prompt_info["prompt_id"]

print(f"Workflow submitted successfully! Prompt ID: {prompt_id}")
print("Waiting for generation to complete (FL2VA Non-Turbo 25 steps)...")

while True:
    time.sleep(2)
    req = urllib.request.Request("http://127.0.0.1:8188/queue")
    queue = json.loads(urllib.request.urlopen(req).read())
    
    total_in_queue = len(queue.get("queue_running", [])) + len(queue.get("queue_pending", []))
    if total_in_queue > 0:
        print(f"Queue status: {total_in_queue} items", end="\r")
    
    req_hist = urllib.request.Request(f"http://127.0.0.1:8188/history/{prompt_id}")
    try:
        hist_resp = urllib.request.urlopen(req_hist)
        history = json.loads(hist_resp.read())
        if prompt_id in history:
            print("\nGeneration completed!")
            outputs = history[prompt_id].get("outputs", {})
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img in node_output["images"]:
                        print(f"Output saved as: {img['filename']} in {img['subfolder']}")
            break
    except urllib.error.HTTPError:
        pass  # Still generating
