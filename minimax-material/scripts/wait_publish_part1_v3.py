import os
import time
import cv2
import subprocess

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part1_v3_10s_ref2va_nonturbo_00001_.mp4"
gallery_dir = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery"
last_frame_path = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery\images\tigra_transition_frame_v3.jpg"

print("Waiting for Part 1 (V3) video to finish generating...")
while not os.path.exists(video_path):
    time.sleep(15)

print("Video found! Extracting the last frame...")
time.sleep(20) # wait for flush

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
if total_frames > 0:
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(last_frame_path, frame)
        print("Last frame extracted successfully!")
        
        # Publish everything
        os.chdir(gallery_dir)
        subprocess.run([
            "python", "scripts/publish-add.py",
            "--image", video_path,
            "--title", "Part 1: Bored Coffee (Ref2VA V3 10s)",
            "--category", "video",
            "--push-only"
        ])
        subprocess.run([
            "python", "scripts/publish-add.py",
            "--image", last_frame_path,
            "--title", "Transition Frame 1->2 (V3)",
            "--category", "scene",
            "--push"
        ])
    else:
        print("Error extracting last frame!")
else:
    print("Video has 0 frames")
cap.release()
