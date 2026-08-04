import os, json
from PIL import Image
import numpy as np

folder = r'C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img'

files = [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f)) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]

def inspect_file(filename):
    path = os.path.join(folder, filename)
    info = {"filename": filename, "path": path}
    try:
        with Image.open(path) as img:
            info["size"] = img.size
            info["format"] = img.format
            meta_str = str(img.info)
            
            # Check prompt text
            meta_lower = meta_str.lower()
            is_tigra_prompt = "tigra" in meta_lower or "tiger" in meta_lower or "tigress" in meta_lower
            is_vinna_prompt = "vinna" in meta_lower or "winnie" in meta_lower or "wnw" in meta_lower or "bear" in meta_lower
            
            info["prompt_tigra"] = is_tigra_prompt
            info["prompt_vinna"] = is_vinna_prompt
            
            # Simple visual heuristic: dominant colors or features if needed
            img_rgb = img.convert("RGB")
            arr = np.array(img_rgb)
            # check if orange/tiger-like vs yellow bear
            # average RGB
            avg_color = arr.mean(axis=(0,1))
            info["avg_color"] = [round(x, 1) for k, x in zip("RGB", avg_color)]
            
    except Exception as e:
        info["error"] = str(e)
    return info

print("=== ALPHABETICAL FIRST 30 ===")
by_name = sorted(files)[:30]
for i, f in enumerate(by_name, 1):
    res = inspect_file(f)
    print(f"{i:2d}. {f}: TigraPrompt={res.get('prompt_tigra')}, VinnaPrompt={res.get('prompt_vinna')}, Size={res.get('size')}")

print("\n=== NEWEST FIRST 30 (mtime desc) ===")
by_mtime_desc = sorted(files, key=lambda f: os.path.getmtime(os.path.join(folder, f)), reverse=True)[:30]
for i, f in enumerate(by_mtime_desc, 1):
    res = inspect_file(f)
    print(f"{i:2d}. {f}: TigraPrompt={res.get('prompt_tigra')}, VinnaPrompt={res.get('prompt_vinna')}, Size={res.get('size')}")
