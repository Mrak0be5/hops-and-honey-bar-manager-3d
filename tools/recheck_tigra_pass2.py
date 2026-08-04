import os
import re
import json
import shutil
from PIL import Image

SRC = r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img"
TIGRA = os.path.join(SRC, "Tigra_2026")
VINNA = os.path.join(SRC, "Vinna_2026")
KROLL = os.path.join(SRC, "Kroll_2026")
TRASH = os.path.join(SRC, "Trash_2026")

for d in (VINNA, KROLL, TRASH):
    os.makedirs(d, exist_ok=True)

def extract_text(path):
    chunks = []
    try:
        with Image.open(path) as img:
            info = img.info
    except Exception:
        return ""
    for key in ("parameters", "prompt", "workflow"):
        raw = info.get(key)
        if not raw:
            continue
        if isinstance(raw, str):
            try:
                data = json.loads(raw)
            except Exception:
                chunks.append(raw)
                continue
        else:
            data = raw
        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in ("text", "prompt", "string", "lora_name", "ckpt_name") and isinstance(v, str):
                        chunks.append(v)
                    elif isinstance(v, (dict, list)):
                        stack.append(v)
            elif isinstance(node, list):
                stack.extend(node)
    return "\n".join(chunks).lower()

# Tiger signals in METADATA ONLY (not filename)
TIGER_PAT = re.compile(
    r"(tigra|tigress|(?<![a-z])tiger(?![a-z])|anthro[_ -]?tiger|anthropomorphic tiger|"
    r"tiger[_ -]?girl|tiger[_ -]?woman)",
    re.I,
)
# Bear signals in METADATA ONLY
BEAR_PAT = re.compile(
    r"(vinna|winna|(?<![a-z])winnie(?![a-z])|anthro[_ -]?bear|anthropomorphic bear|"
    r"bear[_ -]?woman|bear[_ -]?girl|(?<![a-z])bear\.safetensors|bear\.pt|"
    r"wnw[-_].*winnie|honey[- ]?yellow bear)",
    re.I,
)
# also plain bear.safetensors / lora named bear
BEAR_LORA = re.compile(r"\bbear\.(safetensors|pt|ckpt)\b|(?<![a-z])bear[_-]lora|lora.*\bbear\b", re.I)
KROLL_PAT = re.compile(r"\bkroll\b|anthro[_ -]?rabbit|anthropomorphic rabbit", re.I)

def has_tiger(text):
    return bool(TIGER_PAT.search(text))

def has_bear(text):
    if BEAR_PAT.search(text) or BEAR_LORA.search(text):
        return True
    # "bear" as lora filename token
    if re.search(r"['\"][^'\"]*bear[^'\"]*\.safetensors", text):
        return True
    if "bear.safetensors" in text:
        return True
    # anthro bear phrases
    if re.search(r"\bbear\b", text) and re.search(r"\b(anthro|furry|woman|girl|female)\b", text):
        # careful: "bear" alone in unrelated words — require context
        if re.search(r"(anthro bear|bear woman|bear girl|female bear|furry bear|\bbear,)", text):
            return True
    return False

def classify(path):
    text = extract_text(path)
    if not text.strip():
        return "trash", "no_metadata"

    tiger = has_tiger(text)
    bear = has_bear(text) or ("bear.safetensors" in text)
    kroll = bool(KROLL_PAT.search(text))

    if tiger and not bear and not kroll:
        return "tigra", "tiger_meta"
    if bear and not tiger and not kroll:
        return "vinna", "bear_meta"
    if kroll and not tiger and not bear:
        return "kroll", "kroll_meta"

    if tiger and bear:
        # Both in metadata — user: if unsure → trash
        return "trash", "both_bear_and_tiger_meta"
    if tiger and kroll:
        return "trash", "tiger_and_kroll"
    if bear and kroll:
        return "trash", "bear_and_kroll"

    if tiger:
        return "tigra", "tiger"
    if bear:
        return "vinna", "bear"
    if kroll:
        return "kroll", "kroll"

    return "trash", "unclear_no_tiger_no_bear"

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

DEST = {"vinna": VINNA, "kroll": KROLL, "trash": TRASH}

files = [
    f for f in os.listdir(TIGRA)
    if os.path.isfile(os.path.join(TIGRA, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print(f"Pass 2 (metadata-only, ignore filename): {len(files)}")

counts = {"tigra": 0, "vinna": 0, "kroll": 0, "trash": 0}
reasons = {}
samples = {"vinna": [], "trash": [], "kroll": []}

for i, f in enumerate(files, 1):
    src = os.path.join(TIGRA, f)
    label, reason = classify(src)
    reasons[reason] = reasons.get(reason, 0) + 1
    if label == "tigra":
        counts["tigra"] += 1
    else:
        shutil.move(src, unique_dst(DEST[label], f))
        counts[label] += 1
        if len(samples.get(label, [])) < 12:
            samples[label].append((f, reason))
    if i % 500 == 0 or i == len(files):
        print(f"  {i}/{len(files)} keep={counts['tigra']} V={counts['vinna']} Tr={counts['trash']} K={counts['kroll']}")

print("\n=== PASS 2 REPORT ===")
print(f"Kept Tigra: {counts['tigra']}")
print(f"Moved Vinna: {counts['vinna']}")
for f, r in samples["vinna"]:
    print(f"  V {f} [{r}]")
print(f"Moved Trash: {counts['trash']}")
for f, r in samples["trash"]:
    print(f"  T {f} [{r}]")
print(f"Moved Kroll: {counts['kroll']}")
print("\nReasons:")
for r, c in sorted(reasons.items(), key=lambda x: -x[1]):
    print(f"  {c:5d}  {r}")
print(
    f"\nTotals: Tigra={len(os.listdir(TIGRA))} Vinna={len(os.listdir(VINNA))} "
    f"Kroll={len(os.listdir(KROLL))} Trash={len(os.listdir(TRASH))}"
)

# Final audit: any bear.safetensors left in Tigra?
left_bear = 0
left_no_tiger = 0
for f in os.listdir(TIGRA):
    if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        continue
    t = extract_text(os.path.join(TIGRA, f))
    if "bear.safetensors" in t or (has_bear(t) and not has_tiger(t)):
        left_bear += 1
    if not has_tiger(t):
        left_no_tiger += 1
print(f"\nAUDIT left in Tigra with bear signal: {left_bear}")
print(f"AUDIT left in Tigra without tiger meta: {left_no_tiger}")
