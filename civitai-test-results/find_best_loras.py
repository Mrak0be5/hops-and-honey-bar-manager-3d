import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import urllib.request
import json
import urllib.parse

api_key = "12b71406df2ba5655e11aae36553d154"
headers = {
    "Authorization": f"Bearer {api_key}",
    "User-Agent": "Mozilla/5.0"
}

keywords = [
    'deepthroat', 'facefuck', 'irrumatio', 'throatfuck', 'fellatio',
    'reverse facefuck', 'lying oral', 'oral sex', 'blowjob', 'gagging',
    'furry oral', 'furry sex', 'female pov', 'lying on back'
]

results = []
seen_ids = set()

for kw in keywords:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(kw)}&types=LORA&limit=20&sort=Highest%20Rated"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for item in data.get('items', []):
                m_id = item.get('id')
                m_name = item.get('name')
                stats = item.get('stats', {})
                downloads = stats.get('downloadCount', 0)
                rating = stats.get('rating', 0)
                
                for ver in item.get('modelVersions', []):
                    v_id = ver.get('id')
                    v_name = ver.get('name')
                    base = ver.get('baseModel')
                    triggers = ver.get('trainedWords', [])
                    
                    if base in ['SDXL 1.0', 'Pony', 'Illustrious', 'NoobAI']:
                        air = f"urn:air:sdxl:lora:civitai:{m_id}@{v_id}"
                        if air not in seen_ids:
                            seen_ids.add(air)
                            results.append({
                                'kw': kw,
                                'title': f"{m_name} ({v_name})",
                                'base': base,
                                'air': air,
                                'downloads': downloads,
                                'triggers': triggers,
                                'description': item.get('description', '')[:200] if item.get('description') else ''
                            })
    except Exception as e:
        print(f"Error {kw}: {e}")

# Sort by downloads
results.sort(key=lambda x: x['downloads'], reverse=True)

print(f"Total relevant LoRAs found: {len(results)}")
for r in results[:40]:
    print(f"[{r['base']}] {r['title']} (DL: {r['downloads']})")
    print(f"  AIR: {r['air']}")
    print(f"  Triggers: {r['triggers']}")
    print("-" * 50)
