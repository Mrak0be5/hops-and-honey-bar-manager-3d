import os
import time
import subprocess

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part2_10s_fl2va_nonturbo_00001_.mp4"
gallery_dir = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery"

print(f"Waiting for {video_path} to be generated...")

while not os.path.exists(video_path):
    time.sleep(15)

print(f"Found video! Waiting 15s for file flush...")
time.sleep(15)

os.chdir(gallery_dir)
cmd = [
    "python", 
    "scripts/publish-add.py", 
    "--image", video_path, 
    "--title", "Part 2: Deep Hold & Pullout (FL2VA 10s)", 
    "--category", "video", 
    "--push"
]

try:
    subprocess.run(cmd, check=True)
    print("Successfully added to gallery and pushed to GitHub pages!")
except subprocess.CalledProcessError as e:
    print(f"Error publishing: {e}")
