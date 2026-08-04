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

queries = ['deepthroat', 'throatfuck', 'fellatio', 'irrumatio', 'reverse facefuck', 'lying oral', 'furry oral', 'facefuck', 'throat']

found_loras = []

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(q)}&types=LORA&limit=15"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for item in data.get('items', []):
                name = item.get('name')
                model_id = item.get('id')
                for ver in item.get('modelVersions', []):
                    base = ver.get('baseModel')
                    v_name = ver.get('name')
                    v_id = ver.get('id')
                    triggers = ver.get('trainedWords', [])
                    files = ver.get('files', [])
                    
                    # check if SDXL / Pony / Illustrious
                    if base in ['SDXL 1.0', 'Pony', 'Illustrious', 'NoobAI']:
                        air = f"urn:air:sdxl:lora:civitai:{model_id}@{v_id}"
                        found_loras.append({
                            'query': q,
                            'name': f"{name} - {v_name}",
                            'base': base,
                            'model_id': model_id,
                            'version_id': v_id,
                            'air': air,
                            'triggers': triggers
                        })
    except Exception as e:
        print(f"Error for {q}: {e}")

print(f"Total SDXL/Pony/Illustrious LoRAs found: {len(found_loras)}")
print(json.dumps(found_loras[:30], indent=2, ensure_ascii=False))
