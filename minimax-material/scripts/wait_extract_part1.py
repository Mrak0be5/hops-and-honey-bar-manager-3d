import os
import time
import cv2
import json
import urllib.request
import argparse

video_path = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output\video\tigra_part1_10s_fl2va_nonturbo_00001_.mp4"
last_frame_path = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\minimax-material\outputs\tigra_transition_frame.jpg"

print("Waiting for video to finish generating...")
while not os.path.exists(video_path):
    time.sleep(15)

print("Video found! Waiting 15s for file flush...")
time.sleep(15)

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
