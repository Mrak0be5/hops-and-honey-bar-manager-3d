import json
import time
import urllib.parse
import urllib.request

TOKEN = __import__("os").environ.get("CIVITAI_API_TOKEN", "")
OUT = r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\civitai_furry_dt_best.txt"

QUERIES = [
    "deepthroat",
    "deep throat",
    "facefuck",
    "face fuck",
    "irrumatio",
    "fellatio",
    "blowjob",
    "oral insertion",
    "throat bulge",
    "sucking mouth",
    "maw shot",
    "mawshot",
    "muzzle mask",
    "open mouth uvula",
    "furry oral",
    "anthro oral",
    "furry fellatio",
    "anthro fellatio",
    "furry deepthroat",
    "anthro deepthroat",
    "snout oral",
    "muzzle oral",
    "balls deep",
    "deep penetration",
]

TAGS = [
    "deepthroat",
    "fellatio",
    "oral",
    "blowjob",
    "facefuck",
    "irrumatio",
    "maw",
    "mawshot",
    "furry",
    "anthro",
]

KNOWN_IDS = [
    360549,
    924364,
    480974,
    941860,
    1502976,
    866248,
    1094445,
    1327988,
    1037629,
]

CHAR_NOISE = [
    "sonic",
    "dislyte",
    "furry babes",
    "fnaf",
    "helluva",
    "zootopia",
    "animal crossing",
    "league of legends",
    "arknights",
    "digimon",
    "blue archive",
    "bfdi",
    "dandy",
    "big mouth",
    "lady and the tramp",
    "swiper",
    "kindred",
    "boykisser",
    "peroro",
    "geronimo",
    "minecraft",
    "fortnite",
    "pokemon character",
]

POS = [
    "deepthroat",
    "deep throat",
    "facefuck",
    "face fuck",
    "irrumatio",
    "fellatio",
    "blowjob",
    "oral",
    "maw",
    "mawshot",
    "maw shot",
    "muzzle",
    "snout",
    "uvula",
    "throat",
    "sucking",
    "balls deep",
    "deep penetration",
    "mouth shot",
    "open mouth",
    "furry",
    "anthro",
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Authorization": f"Bearer {TOKEN}",
}


def get_json(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


def ingest(results, item):
    if not item or item.get("type") not in (None, "LORA", "LoCon", "LoRA"):
        if item and item.get("type") not in ("LORA", "LoCon"):
            return
    mid = item.get("id")
    if not mid or mid in results:
        return
    stats = item.get("stats") or {}
    versions = []
    for v in item.get("modelVersions") or []:
        versions.append({
            "id": v.get("id"),
            "name": v.get("name"),
            "base": v.get("baseModel"),
            "words": v.get("trainedWords") or [],
            "downloads": (v.get("stats") or {}).get("downloadCount"),
        })
    tags = []
    for t in item.get("tags") or []:
        if isinstance(t, dict):
            tags.append(t.get("name") or "")
        else:
            tags.append(str(t))
    results[mid] = {
        "name": item.get("name") or "",
        "id": mid,
        "type": item.get("type"),
        "downloads": stats.get("downloadCount") or 0,
        "thumbs": stats.get("thumbsUpCount") or 0,
        "nsfw": item.get("nsfw"),
        "tags": tags[:20],
        "versions": versions,
        "desc": (item.get("description") or "")[:400],
    }


results = {}

for q in QUERIES:
    url = (
        "https://civitai.com/api/v1/models?"
        + urllib.parse.urlencode({
            "query": q,
            "types": "LORA",
            "limit": 50,
            "nsfw": "true",
            "sort": "Highest Rated",
        })
    )
    try:
        data = get_json(url)
        for item in data.get("items") or []:
            ingest(results, item)
        print("Q", q, "got", len(data.get("items") or []), "unique", len(results))
    except Exception as e:
        print("ERR Q", q, e)
    time.sleep(0.35)

for tag in TAGS:
    url = (
        "https://civitai.com/api/v1/models?"
        + urllib.parse.urlencode({
            "tag": tag,
            "types": "LORA",
            "limit": 40,
            "nsfw": "true",
            "sort": "Most Downloaded",
        })
    )
    try:
        data = get_json(url)
        for item in data.get("items") or []:
            ingest(results, item)
        print("T", tag, "got", len(data.get("items") or []), "unique", len(results))
    except Exception as e:
        print("ERR T", tag, e)
    time.sleep(0.35)

for mid in KNOWN_IDS:
    if mid in results:
        continue
    url = f"https://civitai.com/api/v1/models/{mid}"
    try:
        item = get_json(url)
        ingest(results, item)
        print("ID", mid, item.get("name"))
    except Exception as e:
        print("ERR ID", mid, e)
    time.sleep(0.25)

ranked = []
for m in results.values():
    name_l = m["name"].lower()
    if any(n in name_l for n in CHAR_NOISE):
        continue
    pony = [v for v in m["versions"] if v.get("base") and "Pony" in str(v.get("base"))]
    hay = " ".join([
        name_l,
        " ".join(m["tags"]).lower(),
        " ".join(" ".join(v.get("words") or []) for v in m["versions"]).lower(),
        (m.get("desc") or "").lower(),
    ])
    hits = [w for w in POS if w in hay]
    if not hits:
        continue
    act_hits = [w for w in hits if w not in ("furry", "anthro", "open mouth", "muzzle", "snout")]
    if not act_hits and not pony:
        continue
    score = (m["downloads"] or 0) + (m["thumbs"] or 0) * 8
    if pony:
        score += 50000
    if any(w in hay for w in ("deepthroat", "deep throat", "facefuck", "irrumatio", "maw shot", "mawshot")):
        score += 80000
    if any(w in hay for w in ("furry", "anthro", "muzzle", "snout", "maw")):
        score += 20000
    ranked.append((score, hits, pony, m))

ranked.sort(key=lambda x: x[0], reverse=True)

lines = [f"unique_raw={len(results)} ranked={len(ranked)}"]
for score, hits, pony, m in ranked[:80]:
    lines.append("")
    lines.append(f"NAME: {m['name']}")
    lines.append(f"URL: https://civitai.com/models/{m['id']}")
    lines.append(f"ID: {m['id']}  DL: {m['downloads']}  UP: {m['thumbs']}  TYPE: {m['type']}  NSFW: {m['nsfw']}")
    lines.append(f"SCORE: {score}  HITS: {', '.join(hits)}")
    lines.append(f"TAGS: {', '.join(m['tags'][:12])}")
    show = pony[:4] if pony else m["versions"][:4]
    for v in show:
        lines.append(
            f"  vID={v['id']} | {v['name']} | {v['base']} | words={v['words'][:8]} | dl={v['downloads']}"
        )

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("wrote", OUT, "lines", len(lines))
