import os
import json
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
TIGRA = os.path.join(SRC, "Tigra_2026")
VINNA = os.path.join(SRC, "Vinna_2026")

os.makedirs(TIGRA, exist_ok=True)
os.makedirs(VINNA, exist_ok=True)

def classify(path):
    name = os.path.basename(path).lower()
    try:
        with Image.open(path) as img:
            meta = str(img.info).lower()
    except Exception as e:
        return "skip", f"read_error: {e}"

    # Filename hints
    if "tigra" in name or "tiger" in name or "tigress" in name:
        return "tigra", "filename"
    if "vinna" in name or "winnie" in name or "wnw" in name:
        # careful: tigra-wnw mixed names — check prompt too
        pass

    has_tigra = any(k in meta for k in ("tigra", "tigress", "anthro tiger", "anthropomorphic tigress", "black stripes"))
    has_vinna = any(k in meta for k in ("vinna", "winnie", "wnw", "anthro bear", "bear woman", "blonde hair"))

    # Mixed / both
    if has_tigra and has_vinna:
        # Prefer stronger signal
        if "tigress" in meta or "tigra" in meta or "anthro tiger" in meta:
            if "anthro bear" in meta or "bear woman" in meta:
                # both characters mentioned — skip auto
                return "skip", "both_characters_in_prompt"
            return "tigra", "prompt"
        if "anthro bear" in meta or "bear woman" in meta or "winnie" in meta:
            return "vinna", "prompt"
        return "skip", "ambiguous_both"

    if has_tigra:
        return "tigra", "prompt"
    if has_vinna:
        return "vinna", "prompt"

    return "skip", "no_match"

files = [
    f for f in os.listdir(SRC)
    if os.path.isfile(os.path.join(SRC, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
first30 = sorted(files)[:30]

moved_tigra = []
moved_vinna = []
skipped = []

for f in first30:
    src = os.path.join(SRC, f)
    label, reason = classify(src)
    if label == "tigra":
        dst = os.path.join(TIGRA, f)
        if not os.path.exists(dst):
            shutil.move(src, dst)
        moved_tigra.append((f, reason))
    elif label == "vinna":
        dst = os.path.join(VINNA, f)
        if not os.path.exists(dst):
            shutil.move(src, dst)
        moved_vinna.append((f, reason))
    else:
        skipped.append((f, reason))

print("=== REPORT: first 30 (alphabetical) ===")
print(f"Tigra_2026: {len(moved_tigra)}")
for f, r in moved_tigra:
    print(f"  -> {f} [{r}]")
print(f"Vinna_2026: {len(moved_vinna)}")
for f, r in moved_vinna:
    print(f"  -> {f} [{r}]")
print(f"Skipped: {len(skipped)}")
for f, r in skipped:
    print(f"  -- {f} [{r}]")
print(f"\nFolders:")
print(f"  {TIGRA}")
print(f"  {VINNA}")
