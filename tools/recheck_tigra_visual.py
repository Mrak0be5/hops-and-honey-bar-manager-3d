"""Visual stripe detector + re-sort remaining Tigra folder."""
import os
import re
import json
import shutil
from PIL import Image, ImageFilter, ImageOps
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
QC = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_stripes"
os.makedirs(QC, exist_ok=True)

for d in (VINNA, KROLL, TRASH):
    os.makedirs(d, exist_ok=True)


def extract_text(path):
    chunks = []
    with Image.open(path) as img:
        info = img.info
    for key in ("parameters", "prompt", "workflow"):
        raw = info.get(key)
        if not raw:
            continue
        if isinstance(raw, str):
            try:
                data = json.loads(raw)
            except Exception:
                chunks.append(raw)
                continue
        else:
            data = raw
        stack = [data]
        while stack:
            n = stack.pop()
            if isinstance(n, dict):
                for k, v in n.items():
                    if k in ("text", "prompt", "string", "lora_name") and isinstance(v, str):
                        chunks.append(v)
                    elif isinstance(v, (dict, list)):
                        stack.append(v)
            elif isinstance(n, list):
                stack.extend(n)
    return "\n".join(chunks).lower()


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


def stripe_score(path):
    """Higher = more tiger-like black stripes on warm fur."""
    with Image.open(path) as img:
        img = img.convert("RGB").resize((160, 160))
        arr = np.asarray(img, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    warm = (r > 100) & (g > 50) & (b < 140) & (r > b)
    if warm.sum() < 200:
        warm_ratio = warm.mean()
        # little warm fur — maybe not either character clearly
        return {
            "stripe": 0.0,
            "warm": float(warm_ratio),
            "yellow": float(((r > 150) & (g > 130) & (np.abs(r - g) < 55) & (b < 130)).mean()),
            "orange": float(((r > 140) & (g < 170) & (r > g + 20) & (b < 110)).mean()),
        }

    # edge energy inside warm regions
    gray = (0.3 * r + 0.59 * g + 0.11 * b)
    # simple sobel-ish
    gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edge = gx + gy
    # dark pixels adjacent to warm (stripe indicator)
    dark = (r < 70) & (g < 70) & (b < 70)
    # dilate warm roughly by shifting
    near_dark = np.zeros_like(warm)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near_dark |= np.roll(np.roll(dark, dy, 0), dx, 1)
    stripe_contact = (warm & near_dark).mean()
    edge_warm = edge[warm].mean() if warm.any() else 0.0

    yellow = ((r > 150) & (g > 130) & (np.abs(r - g) < 55) & (b < 130)).mean()
    orange = ((r > 140) & (g < 170) & (r > g + 20) & (b < 110)).mean()

    # combine
    score = float(stripe_contact * 8.0 + (edge_warm / 40.0) * 0.5)
    return {
        "stripe": score,
        "warm": float(warm.mean()),
        "yellow": float(yellow),
        "orange": float(orange),
        "edge_warm": float(edge_warm),
        "stripe_contact": float(stripe_contact),
    }


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("scoring", len(files))

rows = []
for i, f in enumerate(files, 1):
    p = os.path.join(TIGRA, f)
    try:
        s = stripe_score(p)
        t = extract_text(p)
    except Exception as e:
        s = {"stripe": 0, "warm": 0, "yellow": 0, "orange": 0}
        t = ""
    rows.append((f, s, t))
    if i % 400 == 0:
        print("  scored", i)

# Sort by stripe ascending = least tiger-like
rows_sorted = sorted(rows, key=lambda x: x[1]["stripe"])
print("\nLOWEST stripe (suspect non-tigra):")
for f, s, t in rows_sorted[:20]:
    print(
        "  stripe=%.3f y=%.3f o=%.3f warm=%.3f %s"
        % (s["stripe"], s["yellow"], s["orange"], s["warm"], f)
    )

print("\nHIGHEST stripe (likely tigra):")
for f, s, t in rows_sorted[-10:]:
    print(
        "  stripe=%.3f y=%.3f o=%.3f warm=%.3f %s"
        % (s["stripe"], s["yellow"], s["orange"], s["warm"], f)
    )

# Copy 12 lowest for visual
for i, (f, s, t) in enumerate(rows_sorted[:12]):
    shutil.copy2(os.path.join(TIGRA, f), os.path.join(QC, f"low_{i:02d}_s{s['stripe']:.3f}_{f}"))

# Decision thresholds after looking at distribution
stripes = [s["stripe"] for _, s, _ in rows]
print(
    "stripe percentiles:",
    np.percentile(stripes, [5, 10, 25, 50, 75, 90]),
)

# Heuristic moves:
# - low stripe + high yellow => Vinna
# - low stripe + not yellow + not orange => Trash
# - rabbit words => already handled mostly
moved = {"vinna": 0, "trash": 0, "kroll": 0, "keep": 0}
samples = []

for f, s, t in rows:
    rabbit = bool(re.search(r"\b(rabbit|bunny|kroll)\b", t))
    tiger = bool(re.search(r"(tigra|tigress|anthro[_ -]?tiger|(?<![a-z])tiger(?![a-z]))", t))
    bear_meta = "bear.safetensors" in t or bool(
        re.search(r"\b(anthro bear|bear woman|vinna|winna|winnie)\b", t)
    )

    dest = "tigra"
    reason = "keep"

    if bear_meta and not tiger:
        dest, reason = "vinna", "bear_meta"
    elif rabbit and tiger:
        dest, reason = "trash", "rabbit_tiger"
    elif rabbit and not tiger:
        dest, reason = "kroll", "rabbit"
    elif s["stripe"] < 0.08 and s["yellow"] > 0.10 and s["orange"] < 0.12:
        dest, reason = "vinna", "visual_yellow_lowstripe"
    elif s["stripe"] < 0.05 and s["warm"] < 0.15:
        dest, reason = "trash", "visual_unclear_cold"
    elif s["stripe"] < 0.06 and s["yellow"] > 0.08 and s["orange"] < s["yellow"]:
        dest, reason = "vinna", "visual_more_yellow_than_orange"
    elif not tiger:
        dest, reason = "trash", "no_tiger_meta"

    if dest == "tigra":
        moved["keep"] += 1
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[dest]
        shutil.move(os.path.join(TIGRA, f), unique_dst(folder, f))
        moved[dest] += 1
        if len(samples) < 25:
            samples.append((dest, reason, f, s["stripe"], s["yellow"], s["orange"]))

print("\nMOVED", moved)
for row in samples:
    print(" ", row)
print(
    "Totals T=%d V=%d K=%d Tr=%d"
    % (
        len(os.listdir(TIGRA)),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
print("QC samples in", QC)
