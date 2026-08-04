import os
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
DEST = {
    "tigra": os.path.join(SRC, "Tigra_2026"),
    "vinna": os.path.join(SRC, "Vinna_2026"),
    "kroll": os.path.join(SRC, "Kroll_2026"),
    "trash": os.path.join(SRC, "Trash_2026"),
}
for d in DEST.values():
    os.makedirs(d, exist_ok=True)

SKIP_DIRS = set(DEST.values()) | {
    os.path.join(SRC, x)
    for x in os.listdir(SRC)
    if os.path.isdir(os.path.join(SRC, x))
}

def get_meta(path):
    try:
        with Image.open(path) as img:
            return str(img.info).lower()
    except Exception:
        return ""

def classify(path, filename):
    name = filename.lower()
    meta = get_meta(path)

    name_tigra = any(k in name for k in ("tigra", "tiger", "tigress"))
    name_vinna = any(k in name for k in ("vinna", "winnie")) and "tigra" not in name
    name_kroll = "kroll" in name

    has_tigra = any(
        k in meta
        for k in (
            "tigra",
            "tigress",
            "anthro tiger",
            "anthropomorphic tigress",
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
    has_kroll = "kroll" in meta or (
        ("rabbit" in meta or "bunny" in meta)
        and any(k in meta for k in ("ginger", "tan fur", "brown fur", "amber eyes", "kroll"))
    )
    if has_kroll and "kroll" not in meta and "rabbit" not in meta and "bunny" not in meta and not name_kroll:
        has_kroll = False
    if "luimi" in meta and "anthro bear" not in meta and "bear woman" not in meta and "winnie" not in meta:
        has_vinna = False

    if name_kroll and "tigra" not in name and "vinna" not in name and "winnie" not in name:
        return "kroll"
    if name_tigra and (has_tigra or "tigra" in name):
        return "tigra"

    hits = []
    if has_tigra or name_tigra:
        hits.append("tigra")
    if has_vinna or name_vinna:
        hits.append("vinna")
    if has_kroll or name_kroll:
        hits.append("kroll")

    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        if name_kroll:
            return "kroll"
        if name_tigra:
            return "tigra"
        if name_vinna:
            return "vinna"
        if "kroll" in meta:
            return "kroll"
        if "tigra" in meta or "tigress" in meta:
            return "tigra"
        if "vinna" in meta or ("winnie" in meta and "bear" in meta):
            return "vinna"
        return "trash"
    return "trash"

def unique_dst(folder, f):
    dst = os.path.join(folder, f)
    if not os.path.exists(dst):
        return dst
    base, ext = os.path.splitext(f)
    n = 1
    while os.path.exists(dst):
        dst = os.path.join(folder, f"{base}_dup{n}{ext}")
        n += 1
    return dst

files = [
    f
    for f in os.listdir(SRC)
    if os.path.isfile(os.path.join(SRC, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]

print(f"Remaining images in root: {len(files)}")

counts = {"tigra": 0, "vinna": 0, "kroll": 0, "trash": 0}
errors = []
batch_size = 200

for i, f in enumerate(files, 1):
    src = os.path.join(SRC, f)
    try:
        label = classify(src, f)
        shutil.move(src, unique_dst(DEST[label], f))
        counts[label] += 1
    except Exception as e:
        errors.append((f, str(e)))
    if i % batch_size == 0 or i == len(files):
        print(f"  progress {i}/{len(files)} | T={counts['tigra']} V={counts['vinna']} K={counts['kroll']} Tr={counts['trash']}")

# leftover non-image files stay; count remaining images
left = [
    f
    for f in os.listdir(SRC)
    if os.path.isfile(os.path.join(SRC, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]

print("\n=== FINAL REPORT ===")
print(f"Processed this run: {len(files)}")
print(f"MOVE Tigra: {counts['tigra']}")
print(f"MOVE Vinna: {counts['vinna']}")
print(f"MOVE Kroll: {counts['kroll']}")
print(f"MOVE Trash: {counts['trash']}")
if errors:
    print(f"Errors: {len(errors)}")
    for f, e in errors[:20]:
        print(f"  {f}: {e}")
print(f"Images left in Text2Img root: {len(left)}")
print(
    f"Folder totals: Tigra={len(os.listdir(DEST['tigra']))} "
    f"Vinna={len(os.listdir(DEST['vinna']))} "
    f"Kroll={len(os.listdir(DEST['kroll']))} "
    f"Trash={len(os.listdir(DEST['trash']))}"
)
