import urllib.request, json

queries = ["furry+oral", "anthro+oral", "snout+oral", "furry+deepthroat", "muzzle+oral"]
results = {}

for q in queries:
    url = f"https://civitai.com/api/v1/models?query={q}&types=LORA&limit=10"
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

for m_id, m in results.items():
    print(f"=== {m['name']} (ID: {m_id}) ===")
    for v in m['versions']:
        print(f"   vID: {v['v_id']} | {v['v_name']} | Base: {v['base']} | Words: {v['words'][:5]}")
