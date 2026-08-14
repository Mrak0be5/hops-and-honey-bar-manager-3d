import os
import subprocess
import time

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_wan30_bbc_switch_ref2va_nonturbo_15s_v3_noaudio_00001_.mp4"
gallery_dir = r"C:\Users\hebp\galleries\tigress-thread-gallery"
prompt_file = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\minimax-material\prompts\wan30-bbc-switch-minimax-15s-v3.txt"
frames = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\minimax-material\frames\wan30-bbc-switch"

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
    "MiniMax Ref2VA 15s — bbc-switch v3 (balls-deep disgust, BBC 2x shallow wince)",
    "--category",
    "video",
    "--model",
    "MiniMax-H3 Ref2VA Non-Turbo",
    "--note",
    "15s. Bearded balls-deep hard + disgusted look-back, pull-out, frightened at BBC, 2x dark penis shallow thrusts, wince every stroke.",
    "--prompt-file",
    prompt_file,
    "--ref",
    f"Picture 1 pose/env|{frames}\\02-pose-env.jpg",
    "--ref",
    f"Picture 2 identity|{frames}\\01-identity.jpg",
    "--ref",
    f"Picture 3 man|{frames}\\03-man.jpg",
    "--ref",
    f"Picture 4 penis bearded|{frames}\\04-penis-side.png",
    "--service",
    "Local ComfyUI MiniMax-H3 (this PC)",
    "--service-url",
    "pc-video.html",
    "--push",
]
subprocess.run(cmd, check=True)
print("Published.")
