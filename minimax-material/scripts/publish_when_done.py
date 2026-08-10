import os
import time
import subprocess

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_table_anal_fl2va_nonturbo_00001_.mp4"
gallery_dir = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery"

print(f"Waiting for {video_path} to be generated...")

while not os.path.exists(video_path):
    time.sleep(10)

print(f"Found video! Adding to gallery...")

# Wait an extra 5 seconds to ensure file is completely written
time.sleep(5)

# Run the publish script
os.chdir(gallery_dir)
cmd = [
    "python", 
    "scripts/publish-add.py", 
    "--image", video_path, 
    "--title", "Table Anal Hole (FL2VA Non-Turbo 5s)", 
    "--category", "video", 
    "--push-only"
]

try:
    subprocess.run(cmd, check=True)
    print("Successfully added to gallery and pushed to GitHub pages!")
except subprocess.CalledProcessError as e:
    print(f"Error publishing: {e}")
