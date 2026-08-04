import os
import re
import json
import shutil
from PIL import Image

TIGRA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026"
VINNA = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Vinna_2026"
TRASH = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Trash_2026"
KROLL = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Kroll_2026"

def get_positive_texts_and_loras(path):
    texts = []
    loras = []
    try:
        with Image.open(path) as img:
            raw = img.info.get("prompt")
            if not raw:
                return texts, loras, str(img.info.get("parameters", ""))
            data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return texts, loras, ""

    for node in data.values() if isinstance(data, dict) else []:
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type", "")
        inputs = node.get("inputs", {})
        if "lora_name" in inputs and isinstance(inputs["lora_name"], str):
            loras.append(inputs["lora_name"].lower())
        if ct in ("CLIPTextEncode", "CLIPTextEncodeSDXL", "TextInput_", "CR Text", "StringConstant"):
            t = inputs.get("text")
            if isinstance(t, str) and t.strip():
                texts.append(t.lower())
        # textinput custom nodes
        if "text" in inputs and isinstance(inputs["text"], str) and len(inputs["text"]) > 10:
            if ct.lower().find("negative") < 0:
                texts.append(inputs["text"].lower())
    return texts, loras, ""


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


files = [f for f in os.listdir(TIGRA) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
print("files", len(files))

# Analyze lora combinations
from collections import Counter
lora_combos = Counter()
moved = {"vinna": 0, "trash": 0, "kroll": 0, "keep": 0}
samples = []

for i, f in enumerate(files, 1):
    path = os.path.join(TIGRA, f)
    texts, loras, params = get_positive_texts_and_loras(path)
    blob = "\n".join(texts + loras + [params])

    has_tiger_lora = any("tiger" in l for l in loras)
    has_bear_lora = any(
        ("bear" in l and "teddy" not in l) or l.startswith("wnw") or "winnie" in l
        for l in loras
    )
    has_tiger_text = bool(re.search(r"\b(tigra|tigress|tiger)\b", "\n".join(texts)))
    has_bear_text = bool(
        re.search(
            r"\b(vinna|winna|winnie|anthro bear|bear woman|bear girl|female bear)\b",
            "\n".join(texts),
        )
    )
    has_rabbit_text = bool(re.search(r"\b(rabbit|bunny|kroll)\b", "\n".join(texts)))

    key = tuple(sorted(set(
        ["tigerL" if has_tiger_lora else "",
         "bearL" if has_bear_lora else "",
         "tigerT" if has_tiger_text else "",
         "bearT" if has_bear_text else ""]
    ) - {""}))
    lora_combos[key] += 1

    # STRICT rules per user:
    # - explicit bear text => Vinna (even if tiger lora present? => trash if both)
    # - bear lora WITHOUT tiger text AND WITHOUT tiger lora => Vinna
    # - bear lora + tiger lora, no clarifying text => need care:
    #     if bear text => vinna/trash; if tiger text => tigra; if neither => trash
    # - tiger lora or tiger text, no bear => tigra
    # - unclear => trash

    dest = None
    reason = None

    if has_bear_text and has_tiger_text:
        dest, reason = "trash", "both_texts"
    elif has_bear_text and not has_tiger_text:
        dest, reason = "vinna", "bear_text"
    elif has_rabbit_text and not has_tiger_text:
        dest, reason = "kroll", "rabbit_text"
    elif has_rabbit_text and has_tiger_text:
        dest, reason = "trash", "rabbit_and_tiger_text"
    elif any("bear.safetensors" in l or re.search(r"(^|[/\\])bear\.", l) for l in loras) and not has_tiger_text:
        # bear.safetensors without tiger in prompt text → Vinna (even if filename says tigra)
        dest, reason = "vinna", "bear_safetensors"
    elif has_bear_lora and not has_tiger_lora and not has_tiger_text:
        dest, reason = "vinna", "bear_lora_only"
    elif has_tiger_text or has_tiger_lora:
        dest, reason = "tigra", "tiger_signal"
    else:
        dest, reason = "trash", "no_clear_tiger"

    if dest == "tigra":
        moved["keep"] += 1
    else:
        folder = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}[dest]
        shutil.move(path, unique_dst(folder, f))
        moved[dest] += 1
        if len(samples) < 30:
            samples.append((dest, reason, f, loras[:3]))

    if i % 400 == 0:
        print("progress", i, moved)

print("\nCOMBO counts (before move classification):")
# already moved during loop - combo counted all
for k, c in lora_combos.most_common(20):
    print(c, k)

print("\nMOVED", moved)
for s in samples:
    print(" ", s)
print(
    "Totals T=%d V=%d K=%d Tr=%d"
    % (
        len([x for x in os.listdir(TIGRA) if os.path.isfile(os.path.join(TIGRA, x))]),
        len(os.listdir(VINNA)),
        len(os.listdir(KROLL)),
        len(os.listdir(TRASH)),
    )
)
