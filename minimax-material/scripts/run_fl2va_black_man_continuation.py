import os
import time
import cv2
import json
import urllib.request
import uuid
import subprocess

coffee_video = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_coffee_anal_ref2va_nonturbo_00001_.mp4"
last_frame_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input\mcp\tigra-coffee-last-frame.png"
workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"
gallery_dir = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery"
new_video_prefix = "video/tigra_black_man_fl2va_nonturbo"
new_video_path = fr"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\{new_video_prefix}_00001_.mp4"

print("Extracting the last frame from the coffee video...")

cap = cv2.VideoCapture(coffee_video)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
ret, frame = cap.read()
if ret:
    cv2.imwrite(last_frame_path, frame)
    print("Last frame extracted successfully!")
else:
    print("Error extracting last frame!")
    exit(1)
cap.release()

print("Submitting the new workflow for the black man continuation...")
try:
    with open(workflow_path, "r", encoding="utf-8") as f:
        api_wf = json.load(f)
        if "prompt" in api_wf:
            api_wf = api_wf["prompt"]
except FileNotFoundError:
    print(f"Error: Workflow file not found at {workflow_path}")
    exit(1)

# Configure the workflow
api_wf["200"]["inputs"]["image"] = "mcp/tigra-coffee-last-frame.png"

prompt_text = (
    "Cinematic 24fps shot. The scene continues from <Picture 1>. "
    "Tigra (female anthropomorphic tiger, orange fur, black stripes) is at the wooden table. "
    "A muscular black man approaches her from behind and forcefully inserts his huge, thick penis into her anus. "
    "He begins to fuck her deep and hard. Tigra is clearly in pain and winces, but she endures it. "
    "Highly detailed textures, realistic lighting, anatomically precise, natural body motion."
)

api_wf["104"]["inputs"]["prompt"] = prompt_text
api_wf["104"]["inputs"]["width"] = 1344
api_wf["104"]["inputs"]["height"] = 768
api_wf["104"]["inputs"]["length"] = 362  # 15s

api_wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
api_wf["9"]["inputs"]["steps"] = 25
api_wf["92"]["inputs"]["filename_prefix"] = new_video_prefix

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
                        break
            except Exception:
                pass
            time.sleep(10)
            
except Exception as e:
    print(f"Error submitting workflow: {e}")
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
    exit(1)

print("Publishing the new video to the gallery...")
# wait a bit for file to finalize
time.sleep(5)
os.chdir(gallery_dir)
cmd = [
    "python", 
    "scripts/publish-add.py", 
    "--image", new_video_path, 
    "--title", "Black Man Continuation (FL2VA Non-Turbo 15s)", 
    "--category", "video", 
    "--push"
]

try:
    subprocess.run(cmd, check=True)
    print("Successfully added to gallery and pushed to GitHub pages!")
except subprocess.CalledProcessError as e:
    print(f"Error publishing: {e}")
