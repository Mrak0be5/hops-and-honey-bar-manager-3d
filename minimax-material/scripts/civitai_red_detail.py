import json, urllib.parse, urllib.request

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}

def get(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))

out = []

for mid in [1083611, 998658, 2638481, 2625061, 859, 503815, 681901, 336784, 1112632]:
    pass

ids = [1083611, 998658, 2638481, 2625061, 503815, 681901, 336784, 1112632]
# Face in sheath from earlier grep: need id from file
# search extra
for q in ["Face in sheath concept", "Succ Smaller Male", "indigo furry mix pony", "zPDXL", "hassaku pony furry"]:
    d = get("https://civitai.red/api/v1/models?" + urllib.parse.urlencode({"query": q, "limit": 8, "nsfw": "true"}))
    out.append(f"\n=== Q {q} ===")
    for item in d.get("items") or []:
        st = item.get("stats") or {}
        bases = []
        for v in (item.get("modelVersions") or [])[:12]:
            bases.append(f"{v.get('name')}|{v.get('baseModel')}|dl={(v.get('stats') or {}).get('downloadCount')}|w={(v.get('trainedWords') or [])[:4]}")
        out.append(f"{item.get('name')} id={item.get('id')} type={item.get('type')} DL={st.get('downloadCount')}")
        for b in bases[:10]:
            out.append("  " + b)

for mid in [1083611, 998658, 503815, 681901]:
    m = get(f"https://civitai.red/api/v1/models/{mid}")
    st = m.get("stats") or {}
    desc = (m.get("description") or "").replace("<p>", "\n").replace("</p>", "").replace("<li>", "- ").replace("</li>", "").replace("<ul>", "").replace("</ul>", "")
    import re
    desc = re.sub(r"<[^>]+>", " ", desc)
    desc = re.sub(r"\s+", " ", desc).strip()[:1200]
    out.append(f"\n=== DETAIL {mid} {m.get('name')} DL={st.get('downloadCount')} ===")
    out.append(desc)
    for v in (m.get("modelVersions") or []):
        if v.get("baseModel") and ("Pony" in str(v.get("baseModel")) or "pony" in (v.get("name") or "").lower()):
            out.append(f"  PONY v{v.get('id')} {v.get('name')} base={v.get('baseModel')} words={v.get('trainedWords')} dl={(v.get('stats') or {}).get('downloadCount')}")

path = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_red_furry_dt2.txt"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("ok", len(out))
