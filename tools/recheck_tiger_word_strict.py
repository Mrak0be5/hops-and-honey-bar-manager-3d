import os
import re
import json
import shutil
from collections import Counter
from PIL import Image
import numpy as np

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_no_tiger_text"
os.makedirs(OUT, exist_ok=True)

for d in (VINNA, KROLL, TRASH):
    os.makedirs(d, exist_ok=True)

TIGER_WORD = re.compile(r"\b(tigra|tigress|tigers?)\b", re.I)
BEAR_WORD = re.compile(
    r"\b(vinna|winna|winnie|anthro\s*bear|bear\s*woman|bear\s*girl|furry\s*bear|yellow\s*bear|blonde\s*bear)\b",
    re.I,
)
# plain "bear" as species token in prompt text
BEAR_PLAIN = re.compile(r"(?<![a-z])bear(?![a-z])", re.I)
KROLL_WORD = re.compile(r"\b(kroll|rabbit|bunny)\b", re.I)
HUMAN_HINT = re.compile(
    r"\b(1girl|woman|girl|female|human)\b",
    re.I,
)


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


def follow_text(prompt, start_id, depth=12):
    """Collect text strings reachable from a node id (conditioning chain)."""
    texts = []
    seen = set()
    stack = [str(start_id)]
    while stack and depth > 0:
        depth -= 1
        cur = stack.pop()
        if cur in seen or cur not in prompt:
            continue
        seen.add(cur)
        node = prompt[cur]
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs", {})
        t = inputs.get("text")
        if isinstance(t, str) and t.strip():
            texts.append(t)
        for v in inputs.values():
            if isinstance(v, list) and v and isinstance(v[0], (str, int)):
                stack.append(str(v[0]))
    return texts


def get_active_positive_text(path):
    """Strict: only text feeding sampler positive / labeled positive. NOT lora names. NOT workflow widgets."""
    with Image.open(path) as img:
        prompt_raw = img.info.get("prompt")
        params = img.info.get("parameters")
    if params and isinstance(params, str) and not prompt_raw:
        # A1111: first block before Negative
        pos = params.split("Negative prompt:")[0]
        return pos, "a1111"

    if not prompt_raw:
        return "", "empty"

    try:
        prompt = json.loads(prompt_raw) if isinstance(prompt_raw, str) else prompt_raw
    except Exception:
        return str(prompt_raw), "raw"

    if not isinstance(prompt, dict):
        return "", "bad"

    pos_texts = []

    # 1) From sampler positive links
    for nid, node in prompt.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type", "")
        if "Sampler" not in ct and ct not in ("KSampler", "KSamplerAdvanced", "SamplerCustom", "SamplerCustomAdvanced"):
            continue
        inputs = node.get("inputs", {})
        for key in ("positive", "pos"):
            ref = inputs.get(key)
            if isinstance(ref, list) and ref:
                pos_texts.extend(follow_text(prompt, ref[0]))

    # 2) Nodes explicitly titled Positive
    if not pos_texts:
        for nid, node in prompt.items():
            if not isinstance(node, dict):
                continue
            title = ((node.get("_meta") or {}).get("title") or "").lower()
            ct = node.get("class_type", "")
            inputs = node.get("inputs", {})
            t = inputs.get("text")
            if not isinstance(t, str):
                continue
            if "negative" in title:
                continue
            if "positive" in title or title.strip() in ("pos", "prompt"):
                pos_texts.append(t)

    # 3) Fallback: CLIPTextEncode texts that are NOT negative — but exclude if BOTH pos and neg exist and we can't tell
    if not pos_texts:
        clip_texts = []
        for nid, node in prompt.items():
            if not isinstance(node, dict):
                continue
            ct = node.get("class_type", "")
            title = ((node.get("_meta") or {}).get("title") or "").lower()
            if "CLIPTextEncode" not in ct and "TextEncode" not in ct:
                # also TextInput_ style
                if ct not in ("TextInput_", "CR Text", "StringConstant", "PrimitiveString"):
                    continue
            if "negative" in title:
                continue
            t = node.get("inputs", {}).get("text")
            if isinstance(t, str) and t.strip():
                clip_texts.append(t)
        pos_texts = clip_texts

    return "\n".join(pos_texts), "graph"


def visual_humanish(path):
    with Image.open(path) as img:
        img = img.convert("RGB").resize((160, 160))
        a = np.asarray(img, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    skin = (
        (r > 95) & (g > 55) & (b > 40) & (r > g) & (g >= b * 0.9) & ((r - b) > 25) & ((r - g) < 70) & (b < 150)
    ).mean()
    orange = ((r > 145) & (g > 65) & (g < 165) & (b < 110) & ((r - g) > 28)).mean()
    black = ((r < 50) & (g < 50) & (b < 50)).mean()
    near = np.zeros_like(a[:, :, 0], dtype=bool)
    omask = (r > 145) & (g > 65) & (g < 165) & (b < 110) & ((r - g) > 28)
    bmask = (r < 50) & (g < 50) & (b < 50)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near |= np.roll(np.roll(bmask, dy, 0), dx, 1)
    stripes = (omask & near).mean()
    return float(skin), float(orange), float(stripes)


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("Scanning", len(files))

stats = Counter()
moved = Counter()
no_tiger_examples = []
kept_examples = []
move_log = []

# Also collect for grid
to_trash_files = []

for i, f in enumerate(files, 1):
    path = os.path.join(TIGRA, f)
    try:
        pos, mode = get_active_positive_text(path)
    except Exception as e:
        pos, mode = "", f"err:{e}"

    pos_l = pos.lower()
    has_tiger = bool(TIGER_WORD.search(pos_l))
    has_bear = bool(BEAR_WORD.search(pos_l) or (BEAR_PLAIN.search(pos_l) and "fur" in pos_l))
    has_kroll = bool(KROLL_WORD.search(pos_l))

    # visual backup for humans without tiger word
    try:
        skin, orange, stripes = visual_humanish(path)
    except Exception:
        skin = orange = stripes = 0.0

    visual_human = skin > 0.20 and orange < 0.07 and stripes < 0.015
    visual_tiger = orange > 0.08 and stripes > 0.015

    dest = None
    reason = None

    if has_tiger and not has_bear:
        dest, reason = "tigra", "prompt_tiger"
    elif has_bear and not has_tiger:
        dest, reason = "vinna", "prompt_bear"
    elif has_tiger and has_bear:
        dest, reason = "trash", "prompt_both"
    elif has_kroll:
        dest, reason = "kroll", "prompt_kroll"
    else:
        # NO tiger word in active positive prompt → NOT Tigra
        if has_bear:
            dest, reason = "vinna", "prompt_bear_no_tiger"
        else:
            dest, reason = "trash", "no_tiger_in_prompt_text"

    # Extra: if prompt says tiger but image is clearly human girl → trash
    if dest == "tigra" and visual_human and not visual_tiger:
        dest, reason = "trash", "prompt_tiger_but_visual_human"

    stats[reason] += 1

    if dest == "tigra":
        moved["keep"] += 1
        if len(kept_examples) < 5:
            kept_examples.append((f, pos_l[:100].replace("\n", " | ")))
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[dest]
        shutil.move(path, unique_dst(folder, f))
        moved[dest] += 1
        move_log.append((dest, reason, f, pos_l[:90].replace("\n", " | "), skin, orange, stripes))
        if dest == "trash":
            to_trash_files.append(f)
        if reason.startswith("no_tiger") and len(no_tiger_examples) < 20:
            no_tiger_examples.append((f, pos_l[:120].replace("\n", " | "), mode))

    if i % 400 == 0:
        print("progress", i, dict(moved))

print("\n=== STRICT PROMPT-TEXT RECHECK ===")
print("MOVED", dict(moved))
print("REASONS:")
for r, c in stats.most_common():
    print(f"  {c:5d}  {r}")

print("\nNo-tiger examples:")
for row in no_tiger_examples:
    print(" ", row)

print("\nMove samples:")
for row in move_log[:30]:
    print(" ", row)

# Grid of first 48 trashed
if to_trash_files:
    sample = to_trash_files[:48]
    thumb = 100
    cols = 8
    grid = Image.new("RGB", (cols * thumb, ((len(sample) + cols - 1) // cols) * thumb), (20, 20, 20))
    with open(os.path.join(OUT, "trashed_names.txt"), "w", encoding="utf-8") as fh:
        for idx, f in enumerate(sample):
            # file already moved to trash
            src = os.path.join(TRASH, f)
            if not os.path.exists(src):
                # find dup
                cands = [x for x in os.listdir(TRASH) if x.startswith(os.path.splitext(f)[0])]
                src = os.path.join(TRASH, cands[0]) if cands else None
            if not src or not os.path.exists(src):
                continue
            im = Image.open(src).convert("RGB")
            im.thumbnail((thumb - 2, thumb - 2))
            grid.paste(im, ((idx % cols) * thumb + 1, (idx // cols) * thumb + 1))
            fh.write("%02d %s\n" % (idx, f))
    grid.save(os.path.join(OUT, "trashed_grid.png"))
    print("trashed grid:", os.path.join(OUT, "trashed_grid.png"))

print(
    "\nTotals T=%d V=%d K=%d Tr=%d"
    % (
        len([x for x in os.listdir(TIGRA) if os.path.isfile(os.path.join(TIGRA, x))]),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
