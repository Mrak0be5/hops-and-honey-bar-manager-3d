import os
import re
import json
import shutil
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_final_humans"
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


def active_positive(path):
    with Image.open(path) as img:
        raw = img.info.get("prompt")
        params = img.info.get("parameters")
    if isinstance(params, str) and params and not raw:
        return params.split("Negative prompt:")[0].lower()
    if not raw:
        return ""
    try:
        prompt = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return str(raw).lower()
    texts = []
    for node in prompt.values():
        if not isinstance(node, dict):
            continue
        if "Sampler" not in node.get("class_type", ""):
            continue
        ref = node.get("inputs", {}).get("positive")
        if not (isinstance(ref, list) and ref):
            continue
        seen = set()
        stack = [str(ref[0])]
        while stack:
            cur = stack.pop()
            if cur in seen or cur not in prompt:
                continue
            seen.add(cur)
            inp = prompt[cur].get("inputs", {})
            if isinstance(inp.get("text"), str):
                texts.append(inp["text"])
            for v in inp.values():
                if isinstance(v, list) and v and isinstance(v[0], (str, int)):
                    stack.append(str(v[0]))
    if not texts:
        # fallback CLIP positive-titled only
        for node in prompt.values():
            if not isinstance(node, dict):
                continue
            title = ((node.get("_meta") or {}).get("title") or "").lower()
            if "negative" in title:
                continue
            t = node.get("inputs", {}).get("text")
            if isinstance(t, str) and ("positive" in title or "CLIPTextEncode" in node.get("class_type", "")):
                if "negative" not in title:
                    texts.append(t)
    return "\n".join(texts).lower()


def fur_score(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((160, 160))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    orange = ((r > 145) & (g > 65) & (g < 165) & (b < 110) & ((r - g) > 25)).mean()
    # white tiger: high luminance + black stripes nearby
    light = ((r > 180) & (g > 180) & (b > 180)).mean()
    black = (r < 50) & (g < 50) & (b < 50)
    near = np.zeros_like(black)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near |= np.roll(np.roll(black, dy, 0), dx, 1)
    omask = (r > 145) & (g > 65) & (g < 165) & (b < 110) & ((r - g) > 25)
    wmask = (r > 170) & (g > 170) & (b > 170)
    stripe_o = (omask & near).mean()
    stripe_w = (wmask & near).mean()
    # skin without orange
    skin = (
        (r > 105) & (g > 65) & (b > 50) & (r > g) & ((r - b) > 35) & ((r - g) < 55) & (b < 140) & ((r - g) < 40)
    ).mean()
    return float(orange), float(stripe_o + stripe_w), float(skin), float(light)


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("Tigra count", len(files))

moved_no_word = 0
moved_human = 0
no_word = []
human_cands = []

for i, f in enumerate(files, 1):
    path = os.path.join(TIGRA, f)
    try:
        pos = active_positive(path)
        orange, stripes, skin, light = fur_score(path)
    except Exception:
        shutil.move(path, unique_dst(TRASH, f))
        moved_no_word += 1
        continue

    has_tiger = bool(re.search(r"\b(tigra|tigress|tigers?)\b", pos))

    if not has_tiger:
        shutil.move(path, unique_dst(TRASH, f))
        moved_no_word += 1
        no_word.append(f)
        continue

    # Human girl: high skin, almost no fur stripes/orange. Conservative thresholds.
    if skin > 0.28 and orange < 0.05 and stripes < 0.008:
        human_cands.append((f, skin, orange, stripes, pos[:70]))
        shutil.move(path, unique_dst(TRASH, f))
        moved_human += 1

    if i % 400 == 0:
        print("progress", i)

print("removed NO tiger word:", moved_no_word, no_word)
print("removed visual human (strict):", moved_human)
for row in human_cands[:20]:
    print(" ", row)

# Make verification grid of a random remaining sample + list counts
left = [f for f in os.listdir(TIGRA) if f.lower().endswith(".png")]
print("Tigra left", len(left))
print("Trash", len(os.listdir(TRASH)))

# grid of remaining highest-skin for QC (should hopefully still be tigers)
scored = []
for f in left:
    try:
        orange, stripes, skin, light = fur_score(os.path.join(TIGRA, f))
        scored.append((skin, orange, stripes, f))
    except Exception:
        pass
scored.sort(reverse=True)
sample = scored[:40]
thumb = 100
cols = 8
grid = Image.new("RGB", (cols * thumb, ((len(sample) + cols - 1) // cols) * thumb), (0, 0, 0))
with open(os.path.join(OUT, "high_skin_remaining.txt"), "w", encoding="utf-8") as fh:
    for idx, (skin, orange, stripes, f) in enumerate(sample):
        im = Image.open(os.path.join(TIGRA, f)).convert("RGB")
        im.thumbnail((thumb - 2, thumb - 2))
        grid.paste(im, ((idx % cols) * thumb + 1, (idx // cols) * thumb + 1))
        fh.write("%02d skin=%.2f o=%.2f st=%.3f %s\n" % (idx, skin, orange, stripes, f))
grid.save(os.path.join(OUT, "high_skin_remaining.png"))
print("QC grid", os.path.join(OUT, "high_skin_remaining.png"))
