import os
import subprocess
import time

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part1_v4_10s_ref2va_nonturbo_00001_.mp4"
gallery_dir = r"C:\Users\hebp\galleries\tigress-thread-gallery"

print(f"Waiting for {video_path} ...")
while not os.path.exists(video_path):
    time.sleep(20)

print("Found video, waiting for flush...")
time.sleep(15)

os.chdir(gallery_dir)
cmd = [
    "python",
    "scripts/publish-add.py",
    video_path,
    "--title",
    "Part 1: Bored Coffee (Ref2VA V4 10s)",
    "--category",
    "video",
    "--model",
    "MiniMax-H3 Ref2VA Non-Turbo",
    "--note",
    "2 refs: scene framing + male identity sheet. No penis collage. Orbit right, raised leg, 3 thrusts, coffee, arched back.",
    "--push",
]
subprocess.run(cmd, check=True)
print("Published.")
