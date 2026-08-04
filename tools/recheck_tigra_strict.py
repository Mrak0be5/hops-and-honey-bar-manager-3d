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

TIGER_RE = re.compile(
    r"\b(tigra|tigress|tiger|panthera tigris|anthro tiger|anthropomorphic tiger|"
    r"tiger girl|tiger woman|orange fur.*stripe|stripe.*orange fur|"
    r"yellow fur.*black stripe|black stripe.*yellow fur)\b",
    re.I,
)
# Explicit bear / Vinna — NOT "wnw" alone (can be on tiger gens)
BEAR_RE = re.compile(
    r"\b(vinna|winna|winnie|anthro bear|anthropomorphic bear|bear woman|"
    r"bear girl|honey[- ]?yellow|ursine|pooh)\b",
    re.I,
)
# Weak bear lora tags — only count if NO tiger
WNW_RE = re.compile(r"\b(wnw|wnw2)\b", re.I)
KROLL_RE = re.compile(
    r"\b(kroll|anthro rabbit|anthropomorphic rabbit|bunny girl|rabbit girl)\b",
    re.I,
)

def extract_prompt_text(path):
    """Pull all human-readable prompt / workflow text from PNG metadata."""
    chunks = []
    try:
        with Image.open(path) as img:
            info = img.info
    except Exception as e:
        return "", f"read_err:{e}"

    # A1111 style
    if "parameters" in info and isinstance(info["parameters"], str):
        chunks.append(info["parameters"])

    # ComfyUI prompt JSON
    for key in ("prompt", "workflow"):
        raw = info.get(key)
        if not raw:
            continue
        if isinstance(raw, dict):
            data = raw
        else:
            try:
                data = json.loads(raw)
            except Exception:
                chunks.append(str(raw))
                continue
        # walk for text / lora fields
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

    # any other string meta
    for k, v in info.items():
        if k in ("prompt", "workflow", "parameters"):
            continue
        if isinstance(v, str) and len(v) > 20:
            chunks.append(v)

    return "\n".join(chunks), "ok"

def classify(path, filename):
    text, status = extract_prompt_text(path)
    name = filename.lower()
    blob = f"{name}\n{text}"

    has_tiger = bool(TIGER_RE.search(blob))
    has_bear = bool(BEAR_RE.search(blob))
    has_wnw = bool(WNW_RE.search(blob))
    has_kroll = bool(KROLL_RE.search(blob))

    # Filename strong signals
    if re.search(r"\b(tigra|tigress)\b", name) or name.startswith("tigra"):
        has_tiger = True
    if re.search(r"\b(vinna|winna|winnie)\b", name) and "tigra" not in name:
        has_bear = True
    if "kroll" in name and "tigra" not in name:
        has_kroll = True

    # wnw alone without tiger/bear words → likely Vinna lora gens of bear
    # BUT tigra-wnw-test with tiger in prompt stays tiger
    if has_wnw and not has_tiger and not has_bear:
        has_bear = True  # treat as Vinna unless tiger proven

    # Decision
    if has_tiger and not has_bear and not has_kroll:
        return "tigra", "tiger_only"
    if has_bear and not has_tiger and not has_kroll:
        return "vinna", "bear_only"
    if has_kroll and not has_tiger and not has_bear:
        return "kroll", "kroll_only"

    if has_tiger and has_bear:
        # Both mentioned — prefer filename / stronger subject
        if "tigra" in name or "tigress" in name:
            # still could be misnamed — check if tiger is only in filename
            if TIGER_RE.search(text) and not BEAR_RE.search(text):
                return "tigra", "mixed_name_tigra_prompt_tiger"
            if BEAR_RE.search(text) and not TIGER_RE.search(text):
                return "vinna", "mixed_name_tigra_prompt_bear"
            # both in prompt: scene with both → trash (user: if unsure trash)
            if TIGER_RE.search(text) and BEAR_RE.search(text):
                return "trash", "both_tiger_and_bear"
            return "tigra", "filename_tigra"
        if re.search(r"vinna|winna|winnie", name):
            return "vinna", "filename_vinna"
        # both in prompt, unclear primary → trash
        return "trash", "both_unclear"

    if has_tiger and has_kroll:
        if "kroll" in name and "tigra" not in name:
            return "kroll", "filename_kroll"
        if "tigra" in name or TIGER_RE.search(text):
            return "tigra", "tiger_over_kroll"
        return "trash", "tiger_kroll_unclear"

    if has_tiger:
        return "tigra", "tiger"
    if has_bear:
        return "vinna", "bear"
    if has_kroll:
        return "kroll", "kroll"

    # No clear tiger → NOT stay in Tigra
    return "trash", "no_tiger_signal"

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
    f
    for f in os.listdir(TIGRA)
    if os.path.isfile(os.path.join(TIGRA, f))
    and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
]
print(f"Strict recheck Tigra_2026: {len(files)} files")

counts = {"tigra": 0, "vinna": 0, "kroll": 0, "trash": 0}
reason_counts = {}
samples = {"vinna": [], "kroll": [], "trash": []}
errors = []

for i, f in enumerate(files, 1):
    src = os.path.join(TIGRA, f)
    try:
        label, reason = classify(src, f)
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
        if label == "tigra":
            counts["tigra"] += 1
        else:
            shutil.move(src, unique_dst(DEST[label], f))
            counts[label] += 1
            if len(samples[label]) < 20:
                samples[label].append((f, reason))
    except Exception as e:
        errors.append((f, str(e)))
        # on error → trash (user: if unsure trash)
        try:
            shutil.move(src, unique_dst(TRASH, f))
            counts["trash"] += 1
        except Exception as e2:
            errors.append((f, f"move_fail:{e2}"))

    if i % 500 == 0 or i == len(files):
        print(
            f"  {i}/{len(files)} keep={counts['tigra']} "
            f"V={counts['vinna']} K={counts['kroll']} Tr={counts['trash']}"
        )

print("\n=== STRICT RECHECK ===")
print(f"Kept Tigra: {counts['tigra']}")
print(f"Moved Vinna: {counts['vinna']}")
for f, r in samples["vinna"]:
    print(f"  V {f} [{r}]")
print(f"Moved Kroll: {counts['kroll']}")
for f, r in samples["kroll"]:
    print(f"  K {f} [{r}]")
print(f"Moved Trash: {counts['trash']}")
for f, r in samples["trash"]:
    print(f"  T {f} [{r}]")
print("\nReasons:")
for r, c in sorted(reason_counts.items(), key=lambda x: -x[1]):
    print(f"  {c:5d}  {r}")
if errors:
    print(f"Errors: {len(errors)}")
print(
    f"\nTotals: Tigra={len(os.listdir(TIGRA))} Vinna={len(os.listdir(VINNA))} "
    f"Kroll={len(os.listdir(KROLL))} Trash={len(os.listdir(TRASH))}"
)
