import os
import re
import json
import shutil
from collections import Counter
from PIL import Image

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"

for d in (VINNA, TRASH, KROLL):
    os.makedirs(d, exist_ok=True)


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


def parse_active_prompts(path):
    """Return active positive prompt text + loras from ComfyUI graph links if possible."""
    with Image.open(path) as img:
        prompt_raw = img.info.get("prompt")
        workflow_raw = img.info.get("workflow")
    if not prompt_raw:
        return {"positive": "", "loras": [], "mode": "empty"}

    try:
        prompt = json.loads(prompt_raw) if isinstance(prompt_raw, str) else prompt_raw
    except Exception:
        return {"positive": str(prompt_raw).lower(), "loras": [], "mode": "raw"}

    # API prompt format: node_id -> {class_type, inputs}
    loras = []
    text_nodes = {}
    for nid, node in prompt.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type", "")
        inputs = node.get("inputs", {})
        if "lora_name" in inputs and isinstance(inputs["lora_name"], str):
            loras.append(inputs["lora_name"].lower())
        if "text" in inputs and isinstance(inputs["text"], str):
            text_nodes[str(nid)] = {
                "text": inputs["text"],
                "class": ct,
                "title": (node.get("_meta") or {}).get("title", ""),
            }

    # Find sampler positive input link: ["node_id", 0]
    pos_texts = []
    for nid, node in prompt.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type", "")
        if "Sampler" in ct or ct in ("KSampler", "KSamplerAdvanced", "SamplerCustom"):
            inputs = node.get("inputs", {})
            for key in ("positive", "pos"):
                ref = inputs.get(key)
                if isinstance(ref, list) and ref:
                    # follow chain backwards collecting text
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
                            pos_texts.append(inp["text"])
                        # common conditioning chain inputs
                        for k, v in inp.items():
                            if isinstance(v, list) and v and isinstance(v[0], (str, int)):
                                stack.append(str(v[0]))

    # Fallback: prefer nodes titled positive / not negative
    if not pos_texts:
        for nid, info in text_nodes.items():
            title = (info["title"] + " " + info["class"]).lower()
            if "negative" in title:
                continue
            if "positive" in title or "pos" in title:
                pos_texts.append(info["text"])
        if not pos_texts:
            # all non-negative texts
            for nid, info in text_nodes.items():
                title = (info["title"] + " " + info["class"]).lower()
                if "negative" not in title:
                    pos_texts.append(info["text"])

    # Also parse UI workflow widgets_values for leftover bear prompts (diagnostic)
    widget_bear = False
    widget_tiger = False
    if workflow_raw:
        try:
            wf = json.loads(workflow_raw) if isinstance(workflow_raw, str) else workflow_raw
            wblob = json.dumps(wf).lower()
            widget_bear = bool(re.search(r"\b(bear|winnie|vinna)\b", wblob))
            widget_tiger = bool(re.search(r"\b(tiger|tigra|tigress)\b", wblob))
        except Exception:
            pass

    positive = "\n".join(pos_texts).lower()
    return {
        "positive": positive,
        "loras": loras,
        "mode": "graph",
        "widget_bear": widget_bear,
        "widget_tiger": widget_tiger,
        "all_texts": [t["text"].lower() for t in text_nodes.values()],
    }


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("files", len(files))

stats = Counter()
moved = Counter()
samples = []

# First pass: analyze active positive
active_bear_only = []
active_both = []
active_tiger = []
active_none = []
widget_only_bear = []

for i, f in enumerate(files, 1):
    p = os.path.join(TIGRA, f)
    try:
        info = parse_active_prompts(p)
    except Exception as e:
        info = {"positive": "", "loras": [], "mode": "err"}
        moved["trash"] += 1
        shutil.move(p, unique_dst(TRASH, f))
        continue

    pos = info["positive"]
    loras = " ".join(info["loras"])
    blob = pos + "\n" + loras

    tiger = bool(re.search(r"\b(tigra|tigress|tiger)\b", blob) or "anthro_tiger" in loras or "tiger" in loras)
    bear = bool(
        re.search(r"\b(vinna|winna|winnie|anthro bear|bear woman|bear girl|furry bear|yellow bear|blonde bear)\b", pos)
        or re.search(r"\bbear\b", pos)
        or any("bear" in l and "teddy" not in l for l in info["loras"])
    )
    # wnw in positive text as character token
    if re.search(r"\b(wnw|wnw2)\b", pos) and re.search(r"\b(bear|winnie)\b", pos):
        bear = True

    rabbit = bool(re.search(r"\b(rabbit|bunny|kroll)\b", pos))

    if tiger and not bear:
        stats["active_tiger"] += 1
        active_tiger.append(f)
        label = "tigra"
    elif bear and not tiger:
        stats["active_bear"] += 1
        active_bear_only.append(f)
        label = "vinna"
    elif tiger and bear:
        stats["active_both"] += 1
        active_both.append(f)
        # prefer: if tiger lora and tiger words stronger keep? User: unsure -> trash
        label = "trash"
    elif rabbit:
        stats["active_rabbit"] += 1
        label = "kroll"
    else:
        stats["active_none"] += 1
        active_none.append(f)
        # leftover widgets may say bear but active prompt unclear
        if info.get("widget_bear") and not info.get("widget_tiger"):
            label = "vinna"
        else:
            label = "trash"

    if label == "tigra":
        moved["keep"] += 1
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[label]
        shutil.move(p, unique_dst(folder, f))
        moved[label] += 1
        if len(samples) < 25:
            samples.append((label, f, pos[:120].replace("\n", " | "), info["loras"][:3]))

    if i % 400 == 0:
        print("progress", i, dict(moved), dict(stats))

print("\nSTATS", dict(stats))
print("MOVED", dict(moved))
print("SAMPLES:")
for s in samples:
    print(s)

print("active_bear examples:", active_bear_only[:10])
print("active_both examples:", active_both[:10])
print("active_none examples:", active_none[:10])

print(
    "Totals T=%d V=%d K=%d Tr=%d"
    % (
        len([x for x in os.listdir(TIGRA) if os.path.isfile(os.path.join(TIGRA, x))]),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
