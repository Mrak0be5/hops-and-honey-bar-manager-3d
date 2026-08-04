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

# Search for specific deepthroat / irrumatio / facefuck / lying oral LoRAs across Pony / Illustrious / NoobAI / SDXL
queries = ['deepthroat', 'irrumatio', 'facefuck', 'reverse facefuck', 'lying oral', 'balls deep']

found = []
seen = set()

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(q)}&types=LORA&nsfw=true&limit=30"
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
                        if air not in seen:
                            seen.add(air)
                            found.append({
                                'query': q,
                                'title': f"{m_name} ({v_name})",
                                'base': base,
                                'air': air,
                                'triggers': triggers
                            })
    except Exception as e:
        print(f"Error {q}: {e}")

print(f"Total specific deepthroat LoRAs found: {len(found)}")
for f in found:
    print(f"[{f['base']}] {f['title']}")
    print(f"  Query: {f['query']}")
    print(f"  AIR: {f['air']}")
    print(f"  Triggers: {f['triggers']}")
    print("-" * 50)
