import os
import json
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
TIGRA = os.path.join(SRC, "Tigra_2026")
VINNA = os.path.join(SRC, "Vinna_2026")

os.makedirs(TIGRA, exist_ok=True)
os.makedirs(VINNA, exist_ok=True)

def get_meta_text(path):
    try:
        with Image.open(path) as img:
            return str(img.info).lower()
    except Exception:
        return ""

def classify(path, filename):
    name = filename.lower()
    meta = get_meta_text(path)

    # Strong filename signals (tigra-wnw mixed names need prompt check)
    name_tigra = any(k in name for k in ("tigra", "tiger", "tigress"))
    name_vinna = any(k in name for k in ("vinna", "winnie")) and "tigra" not in name

    has_tigra = any(
        k in meta
        for k in (
            "tigra",
            "tigress",
            "anthro tiger",
            "anthropomorphic tigress",
            "orange fur",
            "black stripes",
            "white bob",
        )
    )
    has_vinna = any(
        k in meta
        for k in (
            "vinna",
            "winnie",
            "wnw",
            "anthro bear",
            "bear woman",
            "honey-yellow",
            "golden-yellow",
        )
    )

    # luimi / other chars with wnw lora alone — not Vinna
    if "luimi" in meta and "anthro bear" not in meta and "bear woman" not in meta and "winnie" not in meta:
        has_vinna = False

    # Mixed prompts (tigra + bear in same image)
    if has_tigra and has_vinna:
        if "tigress" in meta or "tigra" in meta or "anthro tiger" in meta:
            if "anthro bear" in meta or "bear woman" in meta:
                # both characters — prefer filename, else skip
                if name_tigra and not name_vinna:
                    return "tigra", "mixed_filename_tigra"
                if name_vinna and not name_tigra:
                    return "vinna", "mixed_filename_vinna"
                return "skip", "both_characters"
            return "tigra", "mixed_prefer_tigra"
        if "anthro bear" in meta or "bear woman" in meta:
            return "vinna", "mixed_prefer_vinna"
        return "skip", "ambiguous_both"

    if has_tigra or name_tigra:
        return "tigra", "prompt" if has_tigra else "filename"
    if has_vinna or name_vinna:
        return "vinna", "prompt" if has_vinna else "filename"

    return "skip", "no_match"

files = [
    f
    for f in os.listdir(SRC)
    if os.path.isfile(os.path.join(SRC, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]

# First 100 by date (newest first = top of Explorer date sort)
first100 = sorted(
    files, key=lambda f: os.path.getmtime(os.path.join(SRC, f)), reverse=True
)[:100]

moved_tigra = []
moved_vinna = []
skipped = []
errors = []

for f in first100:
    src = os.path.join(SRC, f)
    try:
        label, reason = classify(src, f)
        if label == "tigra":
            dst = os.path.join(TIGRA, f)
            if os.path.exists(dst):
                base, ext = os.path.splitext(f)
                n = 1
                while os.path.exists(dst):
                    dst = os.path.join(TIGRA, f"{base}_dup{n}{ext}")
                    n += 1
            shutil.move(src, dst)  # MOVE, not copy
            moved_tigra.append((f, reason, os.path.basename(dst)))
        elif label == "vinna":
            dst = os.path.join(VINNA, f)
            if os.path.exists(dst):
                base, ext = os.path.splitext(f)
                n = 1
                while os.path.exists(dst):
                    dst = os.path.join(VINNA, f"{base}_dup{n}{ext}")
                    n += 1
            shutil.move(src, dst)  # MOVE, not copy
            moved_vinna.append((f, reason, os.path.basename(dst)))
        else:
            skipped.append((f, reason))
    except Exception as e:
        errors.append((f, str(e)))

print("=== MOVE REPORT: newest 100 by mtime ===")
print(f"Processed: {len(first100)}")
print(f"Moved to Tigra_2026: {len(moved_tigra)}")
for f, r, d in moved_tigra:
    print(f"  MOVE -> Tigra_2026/{d} [{r}]")
print(f"Moved to Vinna_2026: {len(moved_vinna)}")
for f, r, d in moved_vinna:
    print(f"  MOVE -> Vinna_2026/{d} [{r}]")
print(f"Skipped (left in Text2Img): {len(skipped)}")
for f, r in skipped:
    print(f"  KEEP {f} [{r}]")
if errors:
    print(f"Errors: {len(errors)}")
    for f, e in errors:
        print(f"  ERR {f}: {e}")

# Verify originals gone for moved files
print("\n=== VERIFY (source should be gone) ===")
still_present = []
for f, _, _ in moved_tigra + moved_vinna:
    if os.path.exists(os.path.join(SRC, f)):
        still_present.append(f)
if still_present:
    print("WARNING still in source:", still_present)
else:
    print("OK: all moved files removed from Text2Img root")
print(f"Tigra_2026 total files: {len(os.listdir(TIGRA))}")
print(f"Vinna_2026 total files: {len(os.listdir(VINNA))}")
