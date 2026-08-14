import os
import time
import cv2

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part2_10s_fl2va_nonturbo_00001_.mp4"
last_frame_path = r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery\images\tigra_transition_frame_2.jpg"

print("Waiting for video 2 to finish generating...")
while not os.path.exists(video_path):
    time.sleep(15)

print("Video 2 found! Waiting 20s for file flush...")
time.sleep(20)

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
if total_frames > 0:
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(last_frame_path, frame)
        print(f"Extraction SUCCESS! Saved to {last_frame_path}")
    else:
        print("Failed to read last frame.")
else:
    print("Video has 0 frames.")
cap.release()

# publish to gallery
import subprocess
os.chdir(r"C:\Users\hebp\OneDrive\Desktop\tigress-thread-gallery")
subprocess.run([
    "python", "scripts/publish-add.py",
    "--image", last_frame_path,
    "--title", "Transition Frame 2->3 (Needs Black Man Edit)",
    "--category", "scene",
    "--push"
])
print("Transition frame published to gallery!")
