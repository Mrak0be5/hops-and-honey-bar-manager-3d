import os
import subprocess
import time

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_wan30_bbc_switch_ref2va_nonturbo_00001_.mp4"
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
    "MiniMax Ref2VA 10s — Wan bbc-switch (pull-out walk R, BBC enters)",
    "--category",
    "video",
    "--model",
    "MiniMax-H3 Ref2VA Non-Turbo",
    "--note",
    "Adapted from Wan 3.0 bbc-switch c6e51f58. 3 refs: scene composition + Tigra identity + man identity. No penis collage. Static cam, pull-out walk right, gape, black man enters.",
    "--prompt-file",
    r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\minimax-material\prompts\wan30-bbc-switch-minimax.txt",
    "--push",
]
subprocess.run(cmd, check=True)
print("Published.")
