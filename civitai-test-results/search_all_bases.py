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

# Search Civitai models for Flux / Qwen / Krea / SDXL / Pony / Illustrious models or loras related to deepthroat / irrumatio / facefuck
queries = ['deepthroat', 'throatfuck', 'irrumatio', 'facefuck', 'reverse facefuck', 'lying oral']

found = []
seen = set()

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(q)}&nsfw=true&limit=30"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for item in data.get('items', []):
                m_id = item.get('id')
                m_name = item.get('name')
                m_type = item.get('type')
                
                for ver in item.get('modelVersions', []):
                    v_id = ver.get('id')
                    v_name = ver.get('name')
                    base = ver.get('baseModel')
                    triggers = ver.get('trainedWords', [])
                    
                    air = ver.get('air', f"urn:air:{base.lower()}:{m_type.lower()}:civitai:{m_id}@{v_id}")
                    if air not in seen:
                        seen.add(air)
                        found.append({
                            'query': q,
                            'title': f"{m_name} ({v_name})",
                            'type': m_type,
                            'base': base,
                            'air': air,
                            'triggers': triggers
                        })
    except Exception as e:
        print(f"Error {q}: {e}")

print(f"Total models/LoRAs found across bases: {len(found)}")
for f in found[:40]:
    print(f"[{f['base']} | {f['type']}] {f['title']}")
    print(f"  AIR: {f['air']}")
    print(f"  Triggers: {f['triggers']}")
    print("-" * 50)
