import os
import re
import json
import shutil
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"

for d in (KROLL, VINNA, TRASH):
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


def fur_stats(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((128, 128))
        arr = np.asarray(img, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    orange = ((r > 140) & (g > 60) & (g < 180) & (b < 120) & (r > g) & (r > b * 1.2)).mean()
    yellow = ((r > 160) & (g > 140) & (b < 120) & (np.abs(r - g) < 50)).mean()
    black = ((r < 50) & (g < 50) & (b < 50)).mean()
    tan = ((r > 120) & (r < 200) & (g > 80) & (g < 160) & (b < 110) & (r > g)).mean()
    return float(orange), float(yellow), float(black), float(tan)


moved = {"kroll": 0, "vinna": 0, "trash": 0, "keep": 0}
reasons = {}
samples = {"vinna": [], "kroll": [], "trash": []}

files = [
    f
    for f in os.listdir(TIGRA)
    if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print("scanning", len(files))

for i, f in enumerate(files, 1):
    src = os.path.join(TIGRA, f)
    t = extract_text(src)
    rabbit = bool(re.search(r"\b(rabbit|bunny|kroll|cottontail)\b", t))
    tiger = bool(re.search(r"(tigra|tigress|anthro[_ -]?tiger|(?<![a-z])tiger(?![a-z]))", t))
    bear = bool(
        re.search(
            r"bear\.safetensors|\banthro bear\b|\bbear woman\b|\bvinna\b|\bwinna\b|\bwinnie\b",
            t,
        )
    )

    dest = None
    reason = None

    if rabbit and tiger:
        dest, reason = "trash", "rabbit_and_tiger_meta"
    elif rabbit and not tiger:
        dest, reason = "kroll", "rabbit_meta"
    elif bear and not tiger:
        dest, reason = "vinna", "bear_meta"
    elif bear and tiger:
        dest, reason = "trash", "both_meta"
    elif tiger:
        try:
            orange, yellow, black, tan = fur_stats(src)
        except Exception:
            orange = yellow = black = tan = 0.0
        # Strong honey-yellow, weak orange → Vinna mis-tagged with tiger lora
        if yellow > 0.12 and orange < 0.08 and black < 0.05:
            dest, reason = "vinna", "color_yellow_bear"
        else:
            dest, reason = "tigra", "tiger_ok"
    else:
        dest, reason = "trash", "no_tiger_meta"

    reasons[reason] = reasons.get(reason, 0) + 1
    if dest == "tigra":
        moved["keep"] += 1
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[dest]
        shutil.move(src, unique_dst(folder, f))
        moved[dest] += 1
        if len(samples[dest]) < 10:
            samples[dest].append((f, reason))

    if i % 400 == 0 or i == len(files):
        print(
            "  %d/%d keep=%d V=%d K=%d Tr=%d"
            % (i, len(files), moved["keep"], moved["vinna"], moved["kroll"], moved["trash"])
        )

print("MOVED", moved)
print("REASONS")
for r, c in sorted(reasons.items(), key=lambda x: -x[1]):
    print("  %5d %s" % (c, r))
for label in ("vinna", "kroll", "trash"):
    print(label.upper(), "samples:")
    for f, r in samples[label]:
        print("  ", f, r)

print(
    "Totals T=%d V=%d K=%d Tr=%d"
    % (
        len(os.listdir(TIGRA)),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
