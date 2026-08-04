import os
import re
import json
import random
import shutil
from PIL import Image, ImageDraw, ImageFont
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_recheck"
os.makedirs(OUT, exist_ok=True)

for d in (VINNA, KROLL, TRASH):
    os.makedirs(d, exist_ok=True)


def extract_all(path):
    texts, loras = [], []
    try:
        with Image.open(path) as img:
            info = img.info
    except Exception as e:
        return "", [], f"err:{e}"
    raw = info.get("prompt") or info.get("parameters") or ""
    blob = ""
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except Exception:
            blob = raw.lower()
            data = None
    else:
        data = raw
    if isinstance(data, dict):
        stack = [data]
        while stack:
            n = stack.pop()
            if isinstance(n, dict):
                for k, v in n.items():
                    if k == "lora_name" and isinstance(v, str):
                        loras.append(v.lower())
                    if k in ("text", "prompt", "string") and isinstance(v, str) and len(v) > 3:
                        texts.append(v.lower())
                    elif isinstance(v, (dict, list)):
                        stack.append(v)
            elif isinstance(n, list):
                stack.extend(n)
        blob = "\n".join(texts + loras)
    return blob, loras, "\n".join(texts)


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


def visual_features(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((160, 160))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    yellow = ((r > 155) & (g > 145) & (b < 130) & (np.abs(r - g) < 45)).mean()
    orange = ((r > 145) & (g > 70) & (g < 165) & (b < 115) & ((r - g) > 25)).mean()
    dark = ((r < 55) & (g < 55) & (b < 55)).mean()
    warm = (r > 110) & (g > 55) & (b < 140) & (r > b)
    darkm = (r < 65) & (g < 65) & (b < 65)
    near = np.zeros_like(warm)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near |= np.roll(np.roll(darkm, dy, 0), dx, 1)
    stripe = (warm & near).mean()
    # white muzzle / cream belly (both chars can have) 
    cream = ((r > 200) & (g > 190) & (b > 170)).mean()
    return {
        "yellow": float(yellow),
        "orange": float(orange),
        "stripe": float(stripe),
        "dark": float(dark),
        "cream": float(cream),
        "warm": float(warm.mean()),
    }


def make_grid(file_list, name, thumb=110, cols=8):
    if not file_list:
        return None
    rows = (len(file_list) + cols - 1) // cols
    grid = Image.new("RGB", (cols * thumb, rows * thumb + 18), (20, 20, 20))
    draw = ImageDraw.Draw(grid)
    names_path = os.path.join(OUT, f"{name}_names.txt")
    with open(names_path, "w", encoding="utf-8") as fh:
        for i, f in enumerate(file_list):
            im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
            im.thumbnail((thumb - 4, thumb - 4))
            x = (i % cols) * thumb
            y = (i // cols) * thumb
            grid.paste(im, (x + (thumb - im.width) // 2, y + (thumb - im.height) // 2))
            draw.text((x + 2, y + 2), str(i), fill=(255, 255, 0))
            fh.write(f"{i:02d} {f}\n")
    path = os.path.join(OUT, f"{name}.png")
    grid.save(path)
    return path


files = [
    f
    for f in os.listdir(TIGRA)
    if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print("Scanning", len(files))

# Score all
rows = []
for i, f in enumerate(files, 1):
    p = os.path.join(TIGRA, f)
    blob, loras, texts = extract_all(p)
    try:
        feat = visual_features(p)
    except Exception:
        feat = {"yellow": 0, "orange": 0, "stripe": 0, "dark": 0, "cream": 0, "warm": 0}

    has_tiger_text = bool(re.search(r"\b(tigra|tigress|tiger)\b", texts))
    has_bear_text = bool(
        re.search(r"\b(vinna|winna|winnie|anthro bear|bear woman|bear girl|female bear)\b", texts)
    )
    has_bear_lora = any("bear" in l for l in loras) or "bear.safetensors" in blob
    has_tiger_lora = any("tiger" in l for l in loras)
    has_wnw = any("wnw" in l or "winnie" in l for l in loras) or "wnw" in blob
    has_rabbit = bool(re.search(r"\b(rabbit|bunny|kroll)\b", blob))

    # Visual bear-ish: yellow-dominant, weak stripes
    visual_bear = feat["yellow"] > 0.06 and feat["yellow"] >= feat["orange"] * 0.85 and feat["stripe"] < 0.035
    # Visual unclear: almost no warm fur / no stripes / washed out
    visual_unclear = feat["warm"] < 0.08 and feat["stripe"] < 0.02

    rows.append(
        {
            "f": f,
            "feat": feat,
            "tiger_text": has_tiger_text,
            "bear_text": has_bear_text,
            "bear_lora": has_bear_lora,
            "tiger_lora": has_tiger_lora,
            "wnw": has_wnw,
            "rabbit": has_rabbit,
            "visual_bear": visual_bear,
            "visual_unclear": visual_unclear,
            "loras": loras,
        }
    )
    if i % 400 == 0:
        print("  scored", i)

# Classify
moved = {"vinna": 0, "kroll": 0, "trash": 0, "keep": 0}
move_log = []

for r in rows:
    f = r["f"]
    dest, reason = "tigra", "ok"

    if r["bear_text"] and not r["tiger_text"]:
        dest, reason = "vinna", "bear_text"
    elif r["bear_text"] and r["tiger_text"]:
        dest, reason = "trash", "both_texts"
    elif r["bear_lora"] and not r["tiger_text"]:
        dest, reason = "vinna", "bear_lora"
    elif r["rabbit"] and not r["tiger_text"]:
        dest, reason = "kroll", "rabbit"
    elif r["rabbit"] and r["tiger_text"]:
        dest, reason = "trash", "rabbit_tiger"
    elif r["visual_bear"]:
        # yellow unstriped despite tiger tags → Vinna (looks like bear)
        dest, reason = "vinna", "visual_bear"
    elif r["visual_unclear"]:
        dest, reason = "trash", "visual_unclear"
    elif not r["tiger_text"] and not r["tiger_lora"]:
        dest, reason = "trash", "no_tiger_signal"
    else:
        dest, reason = "tigra", "ok"

    if dest == "tigra":
        moved["keep"] += 1
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[dest]
        shutil.move(os.path.join(TIGRA, f), unique_dst(folder, f))
        moved[dest] += 1
        move_log.append((dest, reason, f))

print("MOVED", moved)
print("Move samples:")
for row in move_log[:40]:
    print(" ", row)

# Rebuild file list for grids from KEPT
kept = [
    f
    for f in os.listdir(TIGRA)
    if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print("Kept now", len(kept))

random.seed(123)
wnw = [f for f in kept if "wnw" in f.lower()]
jan = [f for f in kept if "8jan" in f.lower()]
other = [f for f in kept if f not in wnw and f not in jan]

grids = []
if wnw:
    grids.append(make_grid(sorted(wnw)[:: max(1, len(wnw) // 48)][:48], "grid_wnw"))
if jan:
    # three slices of 8jan
    step = max(1, len(jan) // 48)
    grids.append(make_grid(sorted(jan)[0 : 48 * step : step][:48], "grid_jan_a"))
    grids.append(make_grid(sorted(jan)[len(jan) // 3 : len(jan) // 3 + 48 * step : step][:48], "grid_jan_b"))
    grids.append(make_grid(sorted(jan)[2 * len(jan) // 3 : 2 * len(jan) // 3 + 48 * step : step][:48], "grid_jan_c"))
if other:
    grids.append(make_grid(sorted(other)[:48], "grid_other"))

print("Grids:", grids)
print(
    "Totals T=%d V=%d K=%d Tr=%d"
    % (
        len(kept),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
