import json, time, urllib.parse, urllib.request

OUT = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_red_furry_dt.txt"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}

def get(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))

def fmt_item(item):
    stats = item.get("stats") or {}
    tags = []
    for t in item.get("tags") or []:
        tags.append(t.get("name") if isinstance(t, dict) else str(t))
    lines = []
    lines.append(f"NAME: {item.get('name')}")
    lines.append(f"URL: https://civitai.red/models/{item.get('id')}")
    lines.append(f"ID: {item.get('id')} TYPE: {item.get('type')} NSFW: {item.get('nsfw')} DL: {stats.get('downloadCount')} UP: {stats.get('thumbsUpCount')}")
    lines.append(f"TAGS: {', '.join(tags[:16])}")
    for v in (item.get("modelVersions") or [])[:8]:
        words = v.get("trainedWords") or []
        vst = v.get("stats") or {}
        lines.append(
            f"  vID={v.get('id')} | {v.get('name')} | {v.get('baseModel')} | words={words[:10]} | dl={vst.get('downloadCount')}"
        )
    return "\n".join(lines)

out = []

# Exact user search
url = "https://civitai.red/api/v1/models?" + urllib.parse.urlencode({
    "query": "Furry deepthroat",
    "limit": 50,
    "nsfw": "true",
})
data = get(url)
out.append(f"=== SEARCH Furry deepthroat items={len(data.get('items') or [])} ===")
for item in data.get("items") or []:
    out.append("")
    out.append(fmt_item(item))

# Extra related queries
for q, types in [
    ("furry_deepthroat", "LORA"),
    ("furry fellatio", "LORA"),
    ("anthro deepthroat", "LORA"),
    ("furry oral pony", "LORA"),
    ("yiffpony", "Checkpoint"),
    ("furry pony", "Checkpoint"),
    ("boleromix", "Checkpoint"),
    ("fluffy fur mix pony", "Checkpoint"),
    ("nova furry pony", "Checkpoint"),
    ("yiffy pony", "Checkpoint"),
]:
    time.sleep(0.25)
    u = "https://civitai.red/api/v1/models?" + urllib.parse.urlencode({
        "query": q,
        "types": types,
        "limit": 20,
        "nsfw": "true",
    })
    try:
        d = get(u)
        out.append("")
        out.append(f"=== QUERY {q} type={types} items={len(d.get('items') or [])} ===")
        for item in d.get("items") or []:
            out.append("")
            out.append(fmt_item(item))
    except Exception as e:
        out.append(f"ERR {q} {e}")

# Known IDs
for mid in [1083611, 448716, 535982, 29819, 503815, 257749]:
    time.sleep(0.2)
    try:
        m = get(f"https://civitai.red/api/v1/models/{mid}")
        out.append("")
        out.append(f"=== ID {mid} ===")
        out.append(fmt_item(m))
    except Exception as e:
        out.append(f"ERR ID {mid} {e}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("wrote", OUT, "chars", sum(len(x) for x in out))
