import os
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
TIGRA = os.path.join(SRC, "Tigra_2026")
VINNA = os.path.join(SRC, "Vinna_2026")
KROLL = os.path.join(SRC, "Kroll_2026")

for d in (TIGRA, VINNA, KROLL):
    os.makedirs(d, exist_ok=True)

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
    name_kroll = "kroll" in name or (
        "rabbit" in name and "kroll" in name
    ) or name.startswith("kroll")

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
    has_kroll = any(
        k in meta
        for k in (
            "kroll",
            "anthro rabbit",
            "anthropomorphic rabbit",
            "bunny girl",
            "rabbit girl",
            "ginger hair",
            "long ginger",
            "reddish-brown hair",
            "cotton-tail",
            "cottontail",
        )
    )

    # Refine Kroll: need rabbit/kroll signal, not just "ginger hair" alone
    if has_kroll and "kroll" not in meta and "rabbit" not in meta and "bunny" not in meta:
        # ginger alone is weak — only if filename says kroll
        if not name_kroll:
            has_kroll = False

    # Stronger rabbit markers with character context
    if not has_kroll:
        rabbitish = ("rabbit" in meta or "bunny" in meta) and any(
            k in meta for k in ("ginger", "tan fur", "brown fur", "amber eyes", "kroll")
        )
        if rabbitish or name_kroll:
            has_kroll = True

    if "luimi" in meta and "anthro bear" not in meta and "bear woman" not in meta and "winnie" not in meta:
        has_vinna = False

    hits = []
    if has_tigra or name_tigra:
        hits.append("tigra")
    if has_vinna or name_vinna:
        hits.append("vinna")
    if has_kroll or name_kroll:
        hits.append("kroll")

    # Filename wins for kroll-* series
    if name_kroll and "tigra" not in name and "vinna" not in name and "winnie" not in name:
        return "kroll", "filename"

    if len(hits) == 1:
        return hits[0], "prompt"

    if len(hits) > 1:
        # Prefer explicit name in filename
        if name_kroll:
            return "kroll", "filename_over_mixed"
        if name_tigra and "vinna" not in hits:
            return "tigra", "filename_over_mixed"
        if name_vinna:
            return "vinna", "filename_over_mixed"
        # Prefer explicit character tokens in prompt
        if "kroll" in meta:
            return "kroll", "prompt_kroll"
        if "tigra" in meta or "tigress" in meta:
            return "tigra", "prompt_tigra"
        if "vinna" in meta or ("winnie" in meta and "bear" in meta):
            return "vinna", "prompt_vinna"
        return "skip", f"ambiguous:{','.join(hits)}"

    return "skip", "no_match"

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

DEST = {"tigra": TIGRA, "vinna": VINNA, "kroll": KROLL}

files = [
    f
    for f in os.listdir(SRC)
    if os.path.isfile(os.path.join(SRC, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
batch = sorted(files, key=lambda f: os.path.getmtime(os.path.join(SRC, f)), reverse=True)[:500]

counts = {"tigra": 0, "vinna": 0, "kroll": 0, "skip": 0}
skip_samples = []
errors = []

for f in batch:
    src = os.path.join(SRC, f)
    try:
        label, reason = classify(src, f)
        if label in DEST:
            shutil.move(src, unique_dst(DEST[label], f))
            counts[label] += 1
        else:
            counts["skip"] += 1
            if len(skip_samples) < 30:
                skip_samples.append((f, reason))
    except Exception as e:
        errors.append((f, str(e)))

print("=== MOVE REPORT: next 500 newest ===")
print(f"Processed: {len(batch)}")
print(f"MOVE Tigra_2026: {counts['tigra']}")
print(f"MOVE Vinna_2026: {counts['vinna']}")
print(f"MOVE Kroll_2026: {counts['kroll']}")
print(f"Skipped: {counts['skip']}")
for f, r in skip_samples:
    print(f"  KEEP {f} [{r}]")
if errors:
    print("Errors:", errors)
print(f"\nTotals: Tigra={len(os.listdir(TIGRA))} Vinna={len(os.listdir(VINNA))} Kroll={len(os.listdir(KROLL))}")
