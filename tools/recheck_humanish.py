import os
import shutil
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_humanish"
os.makedirs(OUT, exist_ok=True)


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


def skin_vs_fur(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((160, 160))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # human skin tones
    skin = (
        (r > 90)
        & (g > 50)
        & (b > 40)
        & (r > g)
        & (g > b)
        & ((r - b) > 20)
        & ((r - g) < 80)
        & (b < 160)
    )
    # tiger orange fur with separation
    orange_fur = (r > 140) & (g > 60) & (g < 170) & (b < 110) & ((r - g) > 25)
    black = (r < 55) & (g < 55) & (b < 55)
    near = np.zeros_like(orange_fur)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near |= np.roll(np.roll(black, dy, 0), dx, 1)
    stripes = (orange_fur & near).mean()
    return float(skin.mean()), float(orange_fur.mean()), float(stripes)


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
rows = []
for f in files:
    try:
        skin, orange, stripes = skin_vs_fur(os.path.join(TIGRA, f))
    except Exception:
        continue
    # human-dominant, weak tiger fur/stripes
    humanish = skin > 0.18 and orange < 0.08 and stripes < 0.02
    rows.append((humanish, skin, orange, stripes, f))

suspects = [r for r in rows if r[0]]
suspects.sort(key=lambda x: -x[1])
print("humanish suspects:", len(suspects))
for h, skin, orange, stripes, f in suspects[:50]:
    print("  skin=%.3f o=%.3f st=%.3f %s" % (skin, orange, stripes, f))

# grid
lowest = suspects[:48]
if lowest:
    thumb = 100
    cols = 8
    grid = Image.new("RGB", (cols * thumb, ((len(lowest) + cols - 1) // cols) * thumb), (0, 0, 0))
    with open(os.path.join(OUT, "names.txt"), "w", encoding="utf-8") as fh:
        for i, (_, skin, orange, stripes, f) in enumerate(lowest):
            im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
            im.thumbnail((thumb - 2, thumb - 2))
            grid.paste(im, ((i % cols) * thumb + 1, (i // cols) * thumb + 1))
            fh.write("%02d %s\n" % (i, f))
    grid.save(os.path.join(OUT, "humanish_grid.png"))
    print("grid", os.path.join(OUT, "humanish_grid.png"))

# Move clear humanish to trash (not Tigra, not Vinna yellow bear)
moved = 0
for _, skin, orange, stripes, f in suspects:
    # stricter for auto-move
    if skin > 0.22 and orange < 0.06 and stripes < 0.015:
        shutil.move(os.path.join(TIGRA, f), unique_dst(TRASH, f))
        moved += 1
print("moved to trash", moved)
print("Tigra left", len([f for f in os.listdir(TIGRA) if f.lower().endswith('.png')]))
