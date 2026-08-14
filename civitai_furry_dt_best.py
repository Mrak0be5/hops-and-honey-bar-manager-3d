import urllib.request, json

queries = [
    "furry deepthroat",
    "anthro deepthroat",
    "furry fellatio",
    "anthro fellatio",
    "furry blowjob",
    "anthro blowjob",
    "muzzle oral",
    "snout oral",
    "maw shot",
    "facefuck pony",
    "deepthroat pony",
    "furry oral",
]

headers = {"User-Agent": "Mozilla/5.0"}
results = {}

for q in queries:
    url = "https://civitai.com/api/v1/models?query=" + urllib.parse.quote(q) + "&types=LORA&limit=20&nsfw=true"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
        for item in data.get("items", []):
            mid = item["id"]
            if mid in results:
                continue
            stats = item.get("stats") or {}
            versions = []
            for v in item.get("modelVersions", [])[:6]:
                versions.append({
                    "id": v.get("id"),
                    "name": v.get("name"),
                    "base": v.get("baseModel"),
                    "words": v.get("trainedWords") or [],
                    "downloads": (v.get("stats") or {}).get("downloadCount"),
                })
            results[mid] = {
                "name": item.get("name"),
                "id": mid,
                "downloads": stats.get("downloadCount"),
                "thumbs": stats.get("thumbsUpCount"),
                "nsfw": item.get("nsfw"),
                "tags": [t.get("name") if isinstance(t, dict) else str(t) for t in (item.get("tags") or [])][:12],
                "versions": versions,
            }
    except Exception as e:
        print("ERR", q, e)

ranked = sorted(results.values(), key=lambda x: (x.get("downloads") or 0), reverse=True)
out = []
out.append(f"unique={len(ranked)}")
for m in ranked:
    pony = [v for v in m["versions"] if v.get("base") and "Pony" in str(v.get("base"))]
    name_l = (m["name"] or "").lower()
    tags_l = " ".join(m["tags"]).lower()
    hay = name_l + " " + tags_l + " " + " ".join(" ".join(v.get("words") or []) for v in m["versions"]).lower()
    score_words = ["deepthroat", "fellatio", "blowjob", "oral", "facefuck", "maw", "muzzle", "snout", "furry", "anthro"]
    hits = [w for w in score_words if w in hay]
    if not hits:
        continue
    out.append("")
    out.append(f"NAME: {m['name']}")
    out.append(f"ID: {m['id']}  DL: {m['downloads']}  UP: {m['thumbs']}  NSFW: {m['nsfw']}")
    out.append(f"HITS: {', '.join(hits)}")
    out.append(f"TAGS: {', '.join(m['tags'])}")
    for v in m["versions"][:4]:
        out.append(f"  vID={v['id']} | {v['name']} | {v['base']} | words={v['words'][:8]} | dl={v['downloads']}")

path = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_furry_dt_best.txt"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("wrote", path, "lines", len(out))
