import json
import urllib.request
import time
import os

workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_ref2va_turbo_q4_api.json"
with open(workflow_path, "r", encoding="utf-8") as f:
    api_wf = json.load(f)["prompt"]

# 1. Update image nodes
api_wf["200"]["inputs"]["image"] = "mcp/tigra-table-anal-new.png"

# Add second image node for the penis
api_wf["201"] = {
    "class_type": "LoadImage",
    "inputs": {"image": "mcp/ref-penis-sheet.png", "upload": "image"}
}

prompt_text = (
    "Cinematic 24fps close-up shot. The camera slowly pushes in. "
    "<Picture 1> is the starting scene of Tigra (female anthropomorphic tiger, orange fur, black stripes, white belly, white short hair) bent over a wooden table inside a cabin at night. A cup is on the table. "
    "Behind her, a muscular human male is performing deep anal sex. "
    "<Picture 2> is the exact visual reference for his huge, thick, detailed penis (use this precise anatomy). "
    "He performs 3 slow, deep, forceful thrusts over 10 seconds. With every single thrust of the penis inside her, Tigra winces in discomfort. "
    "At the end, he slowly pulls the penis completely out of her anus. "
    "When the penis is completely removed, her anus remains stretched open, showing a visible gaping hole (rosebud). "
    "Highly detailed textures, realistic lighting, anatomically precise."
)

# 2. Update Ref2VA node
api_wf["105"]["inputs"]["prompt"] = prompt_text
api_wf["105"]["inputs"]["width"] = 1344
api_wf["105"]["inputs"]["height"] = 768
api_wf["105"]["inputs"]["length"] = 243  # ~10s
api_wf["105"]["inputs"]["ref_image_0"] = ["200", 0]  # Scene
api_wf["105"]["inputs"]["ref_image_1"] = ["201", 0]  # Penis
api_wf["105"]["inputs"]["ref_image_size"] = "match"

# Remove nested ref_images if it exists
if "ref_images" in api_wf["105"]["inputs"]:
    del api_wf["105"]["inputs"]["ref_images"]

# 3. Turbo settings
api_wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
api_wf["9"]["inputs"]["steps"] = 4
api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_table_anal_ref2va_turbo"

# 4. Submit
req = urllib.request.Request(
    "http://127.0.0.1:8188/prompt",
    data=json.dumps({"prompt": api_wf}).encode("utf-8")
)
resp = urllib.request.urlopen(req)
prompt_info = json.loads(resp.read())
prompt_id = prompt_info["prompt_id"]

print(f"Workflow submitted successfully! Prompt ID: {prompt_id}")
print("Waiting for generation to complete (Turbo 4 steps)...")

# 5. Poll
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
