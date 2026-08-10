import json
import urllib.request
import urllib.parse
import time
import uuid

# Load the Ref2VA Turbo workflow
workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_ref2va_turbo_q4_api.json"
with open(workflow_path, "r", encoding="utf-8") as f:
    api_wf = json.load(f)["prompt"]

# Input images
scene_image = "mcp/tigra-pool-anal-first.png"
penis_image = "mcp/ref-penis-new.png"

# Prompt
prompt_text = (
    "Cinematic 24fps close-up shot. "
    "The camera slowly orbits from left to right. "
    "<Picture 1> is the starting scene of Tigra (female anthropomorphic tiger with yellow fur, black stripes, white belly, white short hair) on all fours by a pool table. "
    "She has a bored expression and is picking up a pool ball lying on her left with her hand, examining it closely. "
    "Behind her, a human male is performing deep anal sex. "
    "<Picture 2> is the exact visual reference for his huge, thick, detailed penis. "
    "He performs 3 slow, deep, forceful thrusts over 10 seconds. "
    "With every single thrust of the penis inside her, Tigra winces in discomfort. "
    "At the end, he slowly pulls the penis completely out of her anus. "
    "When the penis is removed, her anus remains stretched open, showing a visible gaping hole (rosebud). "
    "Highly detailed textures, realistic lighting, anatomically precise."
)

# Apply parameters
api_wf["200"]["inputs"]["image"] = scene_image

# Add second image node for the penis
api_wf["201"] = {
    "class_type": "LoadImage",
    "inputs": {"image": penis_image, "upload": "image"}
}

# Update Ref2VA node
api_wf["105"]["inputs"]["prompt"] = prompt_text
api_wf["105"]["inputs"]["width"] = 1344
api_wf["105"]["inputs"]["height"] = 768
api_wf["105"]["inputs"]["length"] = 243  # ~10s
api_wf["105"]["inputs"]["ref_image_0"] = ["200", 0]  # Scene
api_wf["105"]["inputs"]["ref_image_1"] = ["201", 0]  # Penis reference
api_wf["105"]["inputs"]["ref_image_size"] = "match"
if "ref_images" in api_wf["105"]["inputs"]:
    del api_wf["105"]["inputs"]["ref_images"]

# Turbo settings
api_wf["15"]["inputs"]["noise_seed"] = 123987456
api_wf["9"]["inputs"]["steps"] = 4
api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_pool_anal_ref2va_hole_patched"

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
        print("Waiting for generation to complete (Turbo 4 steps)...")
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
