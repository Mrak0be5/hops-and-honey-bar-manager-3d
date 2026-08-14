import urllib.request, json

queries = [
    "muzzle+mask",
    "maw+shot",
    "furry+fellatio",
    "anthro+fellatio",
    "furry+deepthroat",
    "muzzle+deepthroat",
    "furry+blowjob",
    "anthro+blowjob",
    "furry+mouth",
    "anthro+mouth"
]

results = {}

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={q}&limit=20"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        r = urllib.request.urlopen(req)
        data = json.loads(r.read().decode())
        for item in data.get('items', []):
            m_id = item['id']
            if m_id not in results:
                versions = []
                for v in item.get('modelVersions', []):
                    versions.append({
                        'v_id': v['id'],
                        'v_name': v['name'],
                        'base': v.get('baseModel'),
                        'words': v.get('trainedWords', [])
                    })
                results[m_id] = {
                    'name': item['name'],
                    'id': m_id,
                    'type': item.get('type'),
                    'versions': versions
                }
    except Exception as e:
        print(f"Error querying {q}: {e}")

out = []
out.append(f"Found {len(results)} total models:")
for m_id, m in results.items():
    pony_versions = [v for v in m['versions'] if v['base'] and 'Pony' in v['base']]
    if pony_versions or 'pony' in m['name'].lower():
        out.append(f"\n=== {m['name']} (ID: {m_id}) ===")
        for v in m['versions']:
            out.append(f"   vID: {v['v_id']} | {v['v_name']} | Base: {v['base']} | Words: {v['words']}")

with open('civitai_furry_oral_results.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"Saved {len(results)} models to civitai_furry_oral_results.txt")
