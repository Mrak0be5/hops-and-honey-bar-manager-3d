import os
import re
import json
import shutil
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_humans2"
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


def features(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((180, 180))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    # skin
    skin = (
        (r > 100)
        & (g > 60)
        & (b > 45)
        & (r > g)
        & (g > b * 0.85)
        & ((r - b) > 30)
        & ((r - g) < 65)
        & (b < 145)
    ).mean()
    # orange fur
    orange = ((r > 150) & (g > 70) & (g < 160) & (b < 105) & ((r - g) > 30)).mean()
    # yellow fur (tiger muzzle / bear)
    yellow = ((r > 160) & (g > 145) & (b < 125) & (np.abs(r - g) < 45)).mean()
    # black stripes
    black = ((r < 45) & (g < 45) & (b < 45))
    omask = (r > 150) & (g > 70) & (g < 160) & (b < 105) & ((r - g) > 30)
    near = np.zeros_like(black)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            near |= np.roll(np.roll(black, dy, 0), dx, 1)
    stripes = (omask & near).mean()
    # white fur patch
    whitefur = ((r > 210) & (g > 205) & (b > 195)).mean()
    return float(skin), float(orange), float(yellow), float(stripes), float(whitefur)


def active_pos(path):
    with Image.open(path) as img:
        raw = img.info.get("prompt")
    if not raw:
        return ""
    try:
        prompt = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return ""
    texts = []
    for node in prompt.values():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type", "")
        if "Sampler" not in ct:
            continue
        ref = node.get("inputs", {}).get("positive")
        if not (isinstance(ref, list) and ref):
            continue
        # walk
        seen = set()
        stack = [str(ref[0])]
        while stack:
            cur = stack.pop()
            if cur in seen or cur not in prompt:
                continue
            seen.add(cur)
            n = prompt[cur]
            inp = n.get("inputs", {})
            if isinstance(inp.get("text"), str):
                texts.append(inp["text"])
            for v in inp.values():
                if isinstance(v, list) and v and isinstance(v[0], (str, int)):
                    stack.append(str(v[0]))
    return "\n".join(texts).lower()


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("left", len(files))

suspects = []
for i, f in enumerate(files, 1):
    p = os.path.join(TIGRA, f)
    try:
        skin, orange, yellow, stripes, whitefur = features(p)
        pos = active_pos(p)
    except Exception:
        continue
    has_tiger_word = bool(re.search(r"\b(tigra|tigress|tiger)\b", pos))
    # Human girl heuristic: lots of skin, weak orange stripes
    human = skin > 0.16 and stripes < 0.012 and orange < 0.09
    # Stronger human
    human_strong = skin > 0.25 and stripes < 0.01 and orange < 0.08
    if human or human_strong:
        suspects.append((human_strong, skin, orange, stripes, has_tiger_word, f, pos[:80]))
    if i % 400 == 0:
        print("scanned", i, "suspects", len(suspects))

suspects.sort(key=lambda x: (-int(x[0]), -x[1]))
print("suspects total", len(suspects), "strong", sum(1 for s in suspects if s[0]))

# grid first 48
sample = suspects[:48]
if sample:
    thumb = 100
    cols = 8
    grid = Image.new("RGB", (cols * thumb, ((len(sample) + cols - 1) // cols) * thumb), (0, 0, 0))
    with open(os.path.join(OUT, "names.txt"), "w", encoding="utf-8") as fh:
        for idx, (strong, skin, orange, stripes, has_t, f, pos) in enumerate(sample):
            im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
            im.thumbnail((thumb - 2, thumb - 2))
            grid.paste(im, ((idx % cols) * thumb + 1, (idx // cols) * thumb + 1))
            fh.write(
                "%02d strong=%s skin=%.2f o=%.2f st=%.3f tigerWord=%s %s\n"
                % (idx, strong, skin, orange, stripes, has_t, f)
            )
    grid.save(os.path.join(OUT, "human_suspects.png"))
    print("grid", os.path.join(OUT, "human_suspects.png"))

# Move ALL human suspects to trash (user: regular girls don't belong in Tigra)
moved = 0
for strong, skin, orange, stripes, has_t, f, pos in suspects:
    src = os.path.join(TIGRA, f)
    if os.path.exists(src):
        shutil.move(src, unique_dst(TRASH, f))
        moved += 1

print("MOVED to trash (visual human):", moved)
print("Tigra left:", len([f for f in os.listdir(TIGRA) if f.lower().endswith('.png')]))
print("Trash total:", len(os.listdir(TRASH)))
