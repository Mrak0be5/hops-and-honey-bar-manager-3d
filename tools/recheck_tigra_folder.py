import os
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
TIGRA = os.path.join(SRC, "Tigra_2026")
VINNA = os.path.join(SRC, "Vinna_2026")
KROLL = os.path.join(SRC, "Kroll_2026")
TRASH = os.path.join(SRC, "Trash_2026")

for d in (VINNA, KROLL, TRASH):
    os.makedirs(d, exist_ok=True)

def get_meta(path):
    try:
        with Image.open(path) as img:
            return str(img.info).lower()
    except Exception:
        return ""

def classify_strict(path, filename):
    """Return target folder key. Prefer keeping tigra only if clearly Tigra."""
    name = filename.lower()
    meta = get_meta(path)

    # Explicit character tokens
    has_tigra = any(
        k in meta
        for k in (
            "tigra",
            "tigress",
            "anthro tiger",
            "anthropomorphic tigress",
            "anthropomorphic tiger",
            "tiger girl",
            "orange fur, black stripes",
            "yellow fur, black stripes",
            "black stripes",
        )
    ) or any(k in name for k in ("tigra", "tigress"))

    # Stripe alone is weak if also bear/rabbit — need tiger context
    tigerish = (
        ("tiger" in meta or "tigress" in meta or "tigra" in meta)
        or ("black stripes" in meta and ("fur" in meta or "anthro" in meta))
    )
    if tigerish:
        has_tigra = True

    has_vinna = any(
        k in meta
        for k in (
            "vinna",
            "anthro bear",
            "bear woman",
            "anthropomorphic bear",
            "honey-yellow",
        )
    )
    # winnie/wnw only counts as Vinna if bear context OR no tiger
    if ("winnie" in meta or "wnw" in meta) and (
        "bear" in meta or "vinna" in meta or not tigerish
    ):
        # tigra-wnw tests: filename has tigra + wnw lora — keep as tigra if tiger present
        if tigerish or "tigra" in name or "tigress" in meta or "tiger" in meta:
            pass  # don't force vinna
        else:
            has_vinna = True
    if "winnie" in name or ("vinna" in name and "tigra" not in name):
        has_vinna = True

    has_kroll = "kroll" in meta or "kroll" in name
    if not has_kroll:
        if ("rabbit" in meta or "bunny" in meta) and any(
            k in meta for k in ("ginger", "tan fur", "brown fur", "amber eyes", "kroll")
        ):
            has_kroll = True

    if "luimi" in meta and not has_tigra and not has_vinna:
        return "trash"

    # Filename series overrides when clear
    if "kroll" in name and "tigra" not in name:
        return "kroll"
    if ("vinna" in name or (name.startswith("winnie") or "winnie-" in name)) and "tigra" not in name:
        return "vinna"

    # Pure cases
    if has_tigra and not has_vinna and not has_kroll:
        return "tigra"
    if has_vinna and not has_tigra and not has_kroll:
        return "vinna"
    if has_kroll and not has_tigra and not has_vinna:
        return "kroll"

    # Mixed: prefer explicit primary character
    if has_tigra and has_vinna:
        # Scene with both? filename decides; else if tigra in name keep tigra
        if "tigra" in name or "tigress" in meta or "anthro tiger" in meta:
            # Both on purpose — if bear is main subject without tiger, vinna
            if ("anthro bear" in meta or "bear woman" in meta) and "tiger" not in meta and "tigress" not in meta and "tigra" not in meta:
                return "vinna"
            return "tigra"
        if "anthro bear" in meta or "bear woman" in meta:
            return "vinna"
        return "tigra" if "tigra" in name else "trash"

    if has_tigra and has_kroll:
        if "kroll" in name and "tigra" not in name:
            return "kroll"
        if "tigra" in name or "tigress" in meta or "tiger" in meta:
            return "tigra"
        return "kroll" if "kroll" in meta else "trash"

    if has_vinna and has_kroll:
        if "kroll" in name:
            return "kroll"
        if "vinna" in name or "winnie" in name:
            return "vinna"
        return "trash"

    if has_tigra:
        return "tigra"
    if has_vinna:
        return "vinna"
    if has_kroll:
        return "kroll"

    # No clear character — not Tigra
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

DEST = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}

files = [
    f
    for f in os.listdir(TIGRA)
    if os.path.isfile(os.path.join(TIGRA, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print(f"Scanning Tigra_2026: {len(files)} files")

moved = {"vinna": 0, "kroll": 0, "trash": 0, "keep": 0}
samples = {"vinna": [], "kroll": [], "trash": []}
errors = []

for i, f in enumerate(files, 1):
    src = os.path.join(TIGRA, f)
    try:
        label = classify_strict(src, f)
        if label == "tigra":
            moved["keep"] += 1
        else:
            shutil.move(src, unique_dst(DEST[label], f))
            moved[label] += 1
            if len(samples[label]) < 15:
                samples[label].append(f)
    except Exception as e:
        errors.append((f, str(e)))
    if i % 500 == 0 or i == len(files):
        print(
            f"  {i}/{len(files)} | keep={moved['keep']} "
            f"->V={moved['vinna']} ->K={moved['kroll']} ->Tr={moved['trash']}"
        )

print("\n=== RECHECK REPORT ===")
print(f"Kept in Tigra_2026: {moved['keep']}")
print(f"Moved to Vinna_2026: {moved['vinna']}")
for f in samples["vinna"]:
    print(f"  V: {f}")
print(f"Moved to Kroll_2026: {moved['kroll']}")
for f in samples["kroll"]:
    print(f"  K: {f}")
print(f"Moved to Trash_2026: {moved['trash']}")
for f in samples["trash"]:
    print(f"  T: {f}")
if errors:
    print(f"Errors: {len(errors)}")
    for f, e in errors[:10]:
        print(f"  {f}: {e}")

print(
    f"\nFolder totals: Tigra={len(os.listdir(TIGRA))} "
    f"Vinna={len(os.listdir(VINNA))} "
    f"Kroll={len(os.listdir(KROLL))} "
    f"Trash={len(os.listdir(TRASH))}"
)
