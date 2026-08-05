import os
import shutil
from PIL import Image, ImageDraw

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = os.path.join(TIGRA, "Tigra_Trash_2026")
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_slop"
os.makedirs(TRASH, exist_ok=True)


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


def load_names(path):
    d = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            idx, name = line.split(" ", 1)
            d[int(idx)] = name
    return d


def pick(names, indices):
    return [names[i] for i in indices if i in names]


worst = load_names(os.path.join(OUT, "grid_worst_names.txt"))
mush = load_names(os.path.join(OUT, "grid_mush_names.txt"))
mid = load_names(os.path.join(OUT, "grid_midbad_names.txt"))
rand = load_names(os.path.join(OUT, "grid_random_names.txt"))

# Visually confirmed bad
to_trash = set()
to_trash.update(pick(worst, [16, 17, 18, 20, 21]))  # slop + sketch sheets
to_trash.update(pick(mush, [22, 24, 28, 30, 31, 36, 40, 43, 44, 47]))
to_trash.update(pick(mid, [1, 3, 4, 5, 7, 8, 27, 29, 40, 41, 46]))
to_trash.update(pick(rand, [8, 16, 23, 24, 36, 39, 45]))

# Extra known glitch names if present
extra = [
    "tigra-wnw-test_07254_.png",
    "tigra-wnw-test_07253_.png",
    "tigra-wnw-test_07252_.png",
    "tigra-wnw-test_07255_.png",
    "tigra-wnw-test_07256_.png",
]
to_trash.update(extra)

moved = []
missing = []
for f in sorted(to_trash):
    src = os.path.join(TIGRA, f)
    if os.path.exists(src):
        shutil.move(src, unique_dst(TRASH, f))
        moved.append(f)
    else:
        missing.append(f)

print("Moved this pass:", len(moved))
for f in moved:
    print(" ", f)
print("Already gone / missing:", len(missing))

# Build more QC grids for show/circus/strip/hq2 series
series_keys = ("show", "circus", "strip", "hq2", "hq3", "hq4", "v2-p05", "v2r3")
remaining = [
    f
    for f in os.listdir(TIGRA)
    if os.path.isfile(os.path.join(TIGRA, f)) and f.lower().endswith(".png")
]
focus = [f for f in sorted(remaining) if any(k in f.lower() for k in series_keys)]
print("Focus series count:", len(focus))

# grids of focus in chunks of 48
thumb = 95
cols = 8
for gi in range(0, min(len(focus), 192), 48):
    chunk = focus[gi : gi + 48]
    rows = (len(chunk) + cols - 1) // cols
    grid = Image.new("RGB", (cols * thumb, rows * thumb), (10, 10, 10))
    draw = ImageDraw.Draw(grid)
    name = f"focus_{gi // 48:02d}"
    with open(os.path.join(OUT, f"{name}_names.txt"), "w", encoding="utf-8") as fh:
        for i, f in enumerate(chunk):
            im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
            im.thumbnail((thumb - 4, thumb - 4))
            x = (i % cols) * thumb
            y = (i // cols) * thumb
            grid.paste(im, (x + (thumb - im.width) // 2, y + (thumb - im.height) // 2))
            draw.text((x + 2, y + 2), str(i), fill=(255, 255, 0))
            fh.write(f"{i:02d} {f}\n")
    grid.save(os.path.join(OUT, f"{name}.png"))
    print("grid", name, len(chunk))

print("Tigra left:", len([f for f in os.listdir(TIGRA) if os.path.isfile(os.path.join(TIGRA, f)) and f.endswith('.png')]))
print("Tigra_Trash:", len(os.listdir(TRASH)))
