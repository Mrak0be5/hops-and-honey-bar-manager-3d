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

# Let's search specifically for Pony / Illustrious NSFW pose LoRAs
terms = ['fellatio', 'blowjob', 'oral', 'throat', 'deepthroat', 'facefuck', 'irrumatio', 'lying', 'pov', 'futa', 'furry']

found = []
seen = set()

for t in terms:
    url = f"https://civitai.com/api/v1/models?query={urllib.parse.quote(t)}&types=LORA&nsfw=true&limit=50&sort=Most%20Downloaded"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for item in data.get('items', []):
                m_id = item.get('id')
                m_name = item.get('name')
                tags = item.get('tags', [])
                
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
                                'term': t,
                                'title': m_name,
                                'version': v_name,
                                'base': base,
                                'air': air,
                                'triggers': triggers,
                                'tags': tags
                            })
    except Exception as e:
        print(f"Error {t}: {e}")

print(f"Total found: {len(found)}")

# Filter for relevant pose/action LoRAs
action_keywords = ['oral', 'throat', 'fellatio', 'blowjob', 'facefuck', 'irrumatio', 'gag', 'pov', 'lying', 'pose', 'sex', 'futa', 'penis', 'cum', 'furry']
relevant = []
for f in found:
    t_str = " ".join(f['triggers']).lower() + " " + f['title'].lower() + " " + f['version'].lower()
    if any(k in t_str for k in ['throat', 'fellatio', 'blowjob', 'facefuck', 'irrumatio', 'oral', 'gag', 'pov', 'lying', 'pose']):
        relevant.append(f)

print(f"Relevant action/pose LoRAs: {len(relevant)}")
for r in relevant[:30]:
    print(f"[{r['base']}] {r['title']} - {r['version']}")
    print(f"  AIR: {r['air']}")
    print(f"  Triggers: {r['triggers']}")
    print("=" * 60)
