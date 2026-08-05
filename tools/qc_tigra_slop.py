import os
import re
import json
import shutil
import random
from PIL import Image, ImageFilter, ImageStat, ImageDraw, ImageFont
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = os.path.join(TIGRA, "Tigra_Trash_2026")
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_slop"
os.makedirs(TRASH, exist_ok=True)
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


def quality_features(path):
    with Image.open(path) as img:
        img = img.convert("RGB")
        w, h = img.size
        small = img.resize((256, 256))
    a = np.asarray(small, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    gray = 0.299 * r + 0.587 * g + 0.114 * b

    # edge / chaos
    gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    edge = gx + gy
    edge_mean = float(edge.mean())
    edge_std = float(edge.std())

    # color clipping / overcook
    clip_hi = float(((r > 250) | (g > 250) | (b > 250)).mean())
    clip_lo = float(((r < 5) & (g < 5) & (b < 5)).mean())
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    sat_mean = float(sat.mean())

    # local variance (mush = very low OR insane high noise)
    # block variance
    blocks = gray.reshape(16, 16, 16, 16).mean(axis=(1, 3)) if False else None
    # simpler: std of gray
    gstd = float(gray.std())

    # chroma noise proxy: high frequency in color channels
    chroma = np.std([r, g, b], axis=0)
    chroma_edge = np.abs(np.diff(chroma, axis=1, prepend=chroma[:, :1])).mean()

    # asymmetry left-right (face inconsistency / melt often weird) - weak signal
    left = a[:, :128, :]
    right = np.flip(a[:, 128:, :], axis=1)
    asym = float(np.mean(np.abs(left - right)) / 255.0)

    # score higher = worse slop risk
    # overcooked: high sat + high clip + chaotic edges
    overcook = sat_mean / 80.0 + clip_hi * 3.0 + (edge_mean / 40.0)
    # mush: very low edge detail
    mush = 1.0 / (edge_mean + 1.0) * 20.0
    # noise: high chroma edge with moderate gray edge
    noise = float(chroma_edge) / 10.0

    score = overcook * 0.5 + mush * 0.3 + noise * 0.4 + asym * 0.5
    return {
        "score": float(score),
        "edge": edge_mean,
        "edge_std": edge_std,
        "sat": sat_mean,
        "clip_hi": clip_hi,
        "gstd": gstd,
        "chroma_edge": float(chroma_edge),
        "asym": asym,
        "w": w,
        "h": h,
    }


def make_grid(file_list, name, base_dir=TIGRA, thumb=100, cols=8):
    if not file_list:
        return None
    rows = (len(file_list) + cols - 1) // cols
    grid = Image.new("RGB", (cols * thumb, rows * thumb), (15, 15, 15))
    draw = ImageDraw.Draw(grid)
    names_path = os.path.join(OUT, f"{name}_names.txt")
    with open(names_path, "w", encoding="utf-8") as fh:
        for i, f in enumerate(file_list):
            p = os.path.join(base_dir, f)
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert("RGB")
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
    if os.path.isfile(os.path.join(TIGRA, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print("Scoring", len(files))

rows = []
for i, f in enumerate(files, 1):
    try:
        feat = quality_features(os.path.join(TIGRA, f))
    except Exception as e:
        feat = {"score": 999, "edge": 0, "sat": 0, "clip_hi": 0, "gstd": 0, "chroma_edge": 0, "asym": 0}
    rows.append((f, feat))
    if i % 400 == 0:
        print(" ", i)

rows_sorted = sorted(rows, key=lambda x: -x[1]["score"])
print("\nTOP worst heuristic scores:")
for f, feat in rows_sorted[:30]:
    print(
        "  %.3f edge=%.1f sat=%.1f clip=%.3f asym=%.3f %s"
        % (feat["score"], feat["edge"], feat["sat"], feat["clip_hi"], feat["asym"], f)
    )

# Also lowest edge (mush/abstract)
by_edge = sorted(rows, key=lambda x: x[1].get("edge", 0))
print("\nLOWEST edge (mush/abstract risk):")
for f, feat in by_edge[:20]:
    print("  edge=%.2f score=%.3f %s" % (feat["edge"], feat["score"], f))

# Save scores
with open(os.path.join(OUT, "scores.jsonl"), "w", encoding="utf-8") as fh:
    for f, feat in rows_sorted:
        fh.write(json.dumps({"file": f, **feat}, ensure_ascii=False) + "\n")

# Grids for visual QC
worst = [f for f, _ in rows_sorted[:48]]
mush = [f for f, _ in by_edge[:48]]
random.seed(99)
rand = random.sample([f for f, _ in rows], min(48, len(rows)))
# mid-bad
mid = [f for f, _ in rows_sorted[48:96]]

print("grids:")
print(make_grid(worst, "grid_worst"))
print(make_grid(mush, "grid_mush"))
print(make_grid(mid, "grid_midbad"))
print(make_grid(rand, "grid_random"))

# Auto-move clear technical failures only (very safe thresholds)
auto = []
for f, feat in rows:
    # abstract mush / failed gens
    if feat.get("edge", 99) < 4.0 and feat.get("gstd", 99) < 25:
        auto.append((f, "auto_mush_flat"))
    elif feat.get("clip_hi", 0) > 0.35 and feat.get("sat", 0) > 120:
        auto.append((f, "auto_overcooked"))
    elif feat.get("score", 0) > 8.0:
        auto.append((f, "auto_extreme_score"))

moved = 0
for f, reason in auto:
    src = os.path.join(TIGRA, f)
    if os.path.exists(src):
        shutil.move(src, unique_dst(TRASH, f))
        moved += 1
print(f"\nAUTO moved to Tigra_Trash_2026: {moved}")
for f, reason in auto[:20]:
    print(" ", reason, f)
print("Remaining in Tigra:", len([x for x in os.listdir(TIGRA) if os.path.isfile(os.path.join(TIGRA, x)) and x.lower().endswith('.png')]))
print("In Tigra_Trash:", len(os.listdir(TRASH)))
