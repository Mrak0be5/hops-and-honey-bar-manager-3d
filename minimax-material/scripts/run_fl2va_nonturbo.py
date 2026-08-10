import json
import urllib.request
import urllib.parse
import time
import uuid

# Load the FL2VA non-turbo workflow
workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"
with open(workflow_path, "r", encoding="utf-8") as f:
    api_wf = json.load(f)["prompt"]

# Input image (first frame)
input_image_name = "mcp/tigra-pool-anal-first.png"

# Prompt
prompt_text = (
    "Cinematic 24fps shot. "
    "A female anthropomorphic tiger (Tigra) with yellow fur, black stripes, white belly, white short hair, big breasts, and blue eyes "
    "is on all fours next to a pool table. "
    "A human male is behind her, performing deep anal sex. He does 3 slow, deep thrusts over 10 seconds, and then slowly pulls his huge, detailed, thick penis completely out of her anus. "
    "Tigra has a bored expression, she picks up a pool ball lying on her left with her hand and examines it closely. "
    "With every thrust of the penis inside her, she winces in discomfort. "
    "The camera slowly orbits from left to right. High quality, detailed, realistic lighting."
)

# Apply parameters
api_wf["200"]["inputs"]["image"] = input_image_name
api_wf["104"]["inputs"]["prompt"] = prompt_text
api_wf["104"]["inputs"]["width"] = 1344
api_wf["104"]["inputs"]["height"] = 768
api_wf["104"]["inputs"]["length"] = 243  # ~10s (17k+5 -> 14*17+5 = 243)
api_wf["15"]["inputs"]["noise_seed"] = 987654321
api_wf["9"]["inputs"]["steps"] = 20  # Non-turbo standard steps
api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_pool_anal_fl2va_orbit_ball"

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
        print("Waiting for generation to complete (non-turbo 20 steps)...")
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
