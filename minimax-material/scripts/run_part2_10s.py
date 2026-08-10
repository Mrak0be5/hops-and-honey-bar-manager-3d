import os
import time
import cv2
import json
import urllib.request
import uuid
import subprocess

part1_video = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part1_10s_fl2va_nonturbo_00001_.mp4"
last_frame_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input\mcp\tigra-part1-last-frame.png"
workflow_path = r"C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\comfyui-video-mcp\workflows\minimax_h3_fl2va_q4_api.json"

print("Waiting for Part 1 video to finish generating...")
while not os.path.exists(part1_video):
    time.sleep(15)

print("Part 1 video found! Extracting the last frame...")
time.sleep(15)

cap = cv2.VideoCapture(part1_video)
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

print("Submitting the workflow for Part 2...")
try:
    with open(workflow_path, "r", encoding="utf-8") as f:
        api_wf = json.load(f)
        if "prompt" in api_wf:
            api_wf = api_wf["prompt"]
except FileNotFoundError:
    print(f"Error: Workflow file not found")
    exit(1)

api_wf["200"]["inputs"]["image"] = "mcp/tigra-part1-last-frame.png"

prompt_text = (
    "Cinematic 24fps shot. The scene continues seamlessly from <Picture 1>. "
    "Tigra is at the wooden table. The camera slowly pushes in towards her anus. "
    "Behind her, the muscular human male pushes his huge, thick penis as deeply as possible into her anus and holds it there for 3 seconds. "
    "Tigra's facial expression changes to intense disgust and revulsion. "
    "After the deep hold, the man slowly pulls his penis completely out of her anus. "
    "When the penis is removed, her anus remains stretched open, showing a visible gaping hole (rosebud). "
    "Highly detailed textures, anatomically precise, natural body motion."
)

api_wf["104"]["inputs"]["prompt"] = prompt_text
api_wf["104"]["inputs"]["width"] = 1344
api_wf["104"]["inputs"]["height"] = 768
api_wf["104"]["inputs"]["length"] = 243  # ~10s (24fps)

api_wf["15"]["inputs"]["noise_seed"] = int(time.time() * 1000) % 1000000000
api_wf["9"]["inputs"]["steps"] = 25
api_wf["92"]["inputs"]["filename_prefix"] = "video/tigra_part2_10s_fl2va_nonturbo"

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
    exit(1)
