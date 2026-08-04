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

queries = [
    'facefuck', 'irrumatio', 'deepthroat', 'throatfuck', 'fellatio',
    'reverse', 'lying oral', 'throat', 'f3mp0v', 'pov fellatio', 'gagging',
    'head back', 'mouth open penis'
]

results = []
seen_ids = set()

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(q)}&types=LORA&limit=25"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for item in data.get('items', []):
                m_id = item.get('id')
                m_name = item.get('name')
                
                for ver in item.get('modelVersions', []):
                    v_id = ver.get('id')
                    v_name = ver.get('name')
                    base = ver.get('baseModel')
                    triggers = ver.get('trainedWords', [])
                    
                    if base in ['SDXL 1.0', 'Pony', 'Illustrious', 'NoobAI']:
                        air = f"urn:air:sdxl:lora:civitai:{m_id}@{v_id}"
                        if air not in seen_ids:
                            # Filter out character-specific loras unless they are pose/concept loras
                            name_lower = m_name.lower()
                            if any(k in name_lower or any(k in t.lower() for t in triggers) for k in ['face', 'throat', 'oral', 'fellatio', 'irrumatio', 'gag', 'pov', 'pos', 'concept', 'sex', 'cum', 'mouth', 'reverse']):
                                seen_ids.add(air)
                                results.append({
                                    'query': q,
                                    'title': f"{m_name} - {v_name}",
                                    'base': base,
                                    'air': air,
                                    'triggers': triggers
                                })
    except Exception as e:
        print(f"Error {q}: {e}")

print(f"Total concept/pose LoRAs found: {len(results)}")
for r in results:
    print(f"[{r['base']}] {r['title']}")
    print(f"  AIR: {r['air']}")
    print(f"  Triggers: {r['triggers']}")
    print("-" * 50)
