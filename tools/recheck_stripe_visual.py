import os
import shutil
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_lowstripe"
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


def analyze(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((192, 192))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # tiger orange fur mask
    orange = (r > 130) & (g > 55) & (g < 175) & (b < 120) & ((r - g) > 15)
    # honey yellow (bear-like)
    yellow = (r > 150) & (g > 140) & (b < 135) & (np.abs(r - g) < 50)
    # black ink
    black = (r < 50) & (g < 50) & (b < 50)

    # stripe score: among orange pixels, local contrast with neighbors
    gray = 0.3 * r + 0.59 * g + 0.11 * b
    # Laplacian-ish
    lap = np.abs(gray - np.roll(gray, 1, 0)) + np.abs(gray - np.roll(gray, 1, 1))
    stripe_orange = float(lap[orange].mean()) if orange.any() else 0.0
    # black pixels adjacent to orange
    near_black = np.zeros_like(orange)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            near_black |= np.roll(np.roll(black, dy, 0), dx, 1)
    stripe_contact = float((orange & near_black).mean())
    # combined
    score = stripe_contact * 10 + stripe_orange / 30.0
    return {
        "score": float(score),
        "orange": float(orange.mean()),
        "yellow": float(yellow.mean()),
        "black": float(black.mean()),
        "stripe_contact": float(stripe_contact),
        "stripe_orange": float(stripe_orange),
    }


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("analyzing", len(files))
rows = []
for i, f in enumerate(files, 1):
    try:
        s = analyze(os.path.join(TIGRA, f))
    except Exception as e:
        s = {"score": -1, "orange": 0, "yellow": 0, "black": 0, "stripe_contact": 0, "stripe_orange": 0}
    rows.append((f, s))
    if i % 400 == 0:
        print(" ", i)

rows.sort(key=lambda x: x[1]["score"])
print("\nLOWEST stripe scores (most suspicious):")
for f, s in rows[:40]:
    print(
        "  s=%.3f o=%.3f y=%.3f sc=%.3f %s"
        % (s["score"], s["orange"], s["yellow"], s["stripe_contact"], f)
    )

# Build grid of lowest 48
thumb = 100
cols = 8
lowest = rows[:48]
grid = Image.new("RGB", (cols * thumb, ((len(lowest) + cols - 1) // cols) * thumb), (0, 0, 0))
with open(os.path.join(OUT, "low_names.txt"), "w", encoding="utf-8") as fh:
    for i, (f, s) in enumerate(lowest):
        im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
        im.thumbnail((thumb - 2, thumb - 2))
        x = (i % cols) * thumb
        y = (i // cols) * thumb
        grid.paste(im, (x + 1, y + 1))
        fh.write("%02d s=%.3f y=%.3f o=%.3f %s\n" % (i, s["score"], s["yellow"], s["orange"], f))
grid.save(os.path.join(OUT, "low_stripe_grid.png"))
print("grid saved", os.path.join(OUT, "low_stripe_grid.png"))

# Auto-move: very low stripe + high yellow => Vinna; very low stripe + low orange => Trash
moved = {"vinna": 0, "trash": 0}
log = []
for f, s in rows:
    dest = None
    if s["score"] < 0.15 and s["yellow"] > 0.08 and s["orange"] < 0.10:
        dest = "vinna"
    elif s["score"] < 0.08 and s["orange"] < 0.05:
        dest = "trash"
    elif s["score"] < 0 and s["score"] != 0:
        dest = "trash"
    if dest:
        folder = VINNA if dest == "vinna" else TRASH
        shutil.move(os.path.join(TIGRA, f), unique_dst(folder, f))
        moved[dest] += 1
        log.append((dest, f, s["score"], s["yellow"], s["orange"]))

print("AUTO MOVED", moved)
for x in log[:30]:
    print(x)
print("Tigra left", len([f for f in os.listdir(TIGRA) if f.lower().endswith('.png')]))
