import json, time, urllib.parse, urllib.request

TOKEN = __import__("os").environ.get("CIVITAI_API_TOKEN", "")
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Authorization": f"Bearer {TOKEN}",
}
ids = [
    924364, 480974, 721066, 287556, 513380, 1086861,
    521015, 467190, 454718, 396884, 360549, 406124,
    826597, 659127, 614439, 941860, 1502976, 866248,
    1523280, 755662, 721822, 446163, 680129,
]
# also search balls deep
queries = ["Balls Deep Deep(er) Penetration", "BallsDeep", "facefuck pony"]

def get(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode())

out = []
for mid in ids:
    try:
        m = get(f"https://civitai.com/api/v1/models/{mid}")
        stats = m.get("stats") or {}
        pony = []
        for v in (m.get("modelVersions") or [])[:8]:
            if v.get("baseModel") and "Pony" in str(v.get("baseModel")):
                pony.append(f"v{v.get('id')} {v.get('name')} words={v.get('trainedWords')} dl={(v.get('stats') or {}).get('downloadCount')}")
        out.append(f"{m.get('name')} | {mid} | DL={stats.get('downloadCount')} UP={stats.get('thumbsUpCount')}")
        for p in pony[:4]:
            out.append("  " + p)
        if not pony:
            v0 = (m.get("modelVersions") or [None])[0]
            if v0:
                out.append(f"  NO PONY top={v0.get('name')} base={v0.get('baseModel')}")
    except Exception as e:
        out.append(f"ERR {mid} {e}")
    time.sleep(0.2)

for q in queries:
    try:
        data = get("https://civitai.com/api/v1/models?query=" + urllib.parse.quote(q) + "&types=LORA&limit=8&nsfw=true")
        out.append(f"\nQUERY {q}")
        for item in data.get("items") or []:
            st = item.get("stats") or {}
            bases = sorted({v.get("baseModel") for v in (item.get("modelVersions") or []) if v.get("baseModel")})
            out.append(f"  {item.get('name')} id={item.get('id')} DL={st.get('downloadCount')} bases={bases}")
    except Exception as e:
        out.append(f"ERR Q {q} {e}")
    time.sleep(0.3)

path = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_furry_dt_detail.txt"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("\n".join(out))
