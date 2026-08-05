import os
import re
import json
import shutil
from PIL import Image

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
OUT = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\tools\_qc_weak_tiger"
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


def pos_text_nodes(path):
    with Image.open(path) as img:
        raw = img.info.get("prompt")
    if not raw:
        return []
    prompt = json.loads(raw) if isinstance(raw, str) else raw
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
            if isinstance(inp.get("text"), str) and inp["text"].strip():
                texts.append(inp["text"])
            for v in inp.values():
                if isinstance(v, list) and v and isinstance(v[0], (str, int)):
                    stack.append(str(v[0]))
    out = []
    seen = set()
    for t in texts:
        if t not in seen:
            out.append(t)
            seen.add(t)
    return out


STRONG = re.compile(
    r"\b(tigra|tigress|anthro|furry|black stripes|orange fur|tiger girl|tiger woman|anthropomorphic)\b",
    re.I,
)
ANY_TIGER = re.compile(r"\b(tigra|tigress|tiger)\b", re.I)

weak = []
for f in os.listdir(TIGRA):
    if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        continue
    path = os.path.join(TIGRA, f)
    nodes = pos_text_nodes(path)
    blob = "\n".join(nodes)
    if not ANY_TIGER.search(blob):
        weak.append((f, "no_tiger_word", blob[:150]))
        continue
    if not STRONG.search(blob):
        # only weak 'tiger' mention like "tiger's face" without furry/anthro/tigress
        weak.append((f, "weak_tiger_only", blob[:150]))

print("weak/no-species candidates:", len(weak))
for f, why, blob in weak[:40]:
    print(why, f)
    print(" ", blob.replace("\n", " | "))

# Move weak ones to trash - user said regular girls have no Tiger written properly
moved = 0
for f, why, blob in weak:
    src = os.path.join(TIGRA, f)
    if os.path.exists(src):
        shutil.move(src, unique_dst(TRASH, f))
        moved += 1

print("MOVED to trash:", moved)
print("Tigra left:", len([x for x in os.listdir(TIGRA) if x.lower().endswith(".png")]))
print("Trash:", len(os.listdir(TRASH)))

# Build grid of a slice of remaining + verify prompts all have STRONG species
ok = 0
bad = 0
for f in os.listdir(TIGRA):
    if not f.endswith(".png"):
        continue
    blob = "\n".join(pos_text_nodes(os.path.join(TIGRA, f)))
    if STRONG.search(blob) and ANY_TIGER.search(blob):
        ok += 1
    else:
        bad += 1
        print("STILL BAD", f)
print("remaining strong ok:", ok, "bad:", bad)
