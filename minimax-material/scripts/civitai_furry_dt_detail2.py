import json, urllib.request
TOKEN = __import__("os").environ.get("CIVITAI_API_TOKEN", "")
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Authorization": f"Bearer {TOKEN}",
}
ids = [550870, 823170, 1602661, 635946, 1115133, 1817315]
out = []
for mid in ids:
    req = urllib.request.Request(f"https://civitai.com/api/v1/models/{mid}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            m = json.loads(r.read().decode())
        st = m.get("stats") or {}
        out.append(f"{m.get('name')} | {mid} | DL={st.get('downloadCount')} UP={st.get('thumbsUpCount')}")
        for v in (m.get("modelVersions") or [])[:8]:
            out.append(f"  v{v.get('id')} {v.get('name')} base={v.get('baseModel')} words={v.get('trainedWords')} dl={(v.get('stats') or {}).get('downloadCount')}")
    except Exception as e:
        out.append(f"ERR {mid} {e}")
path = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_furry_dt_detail2.txt"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("ok", len(out))
