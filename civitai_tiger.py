import urllib.request, json

url = 'https://civitai.com/api/v1/models?query=tiger+pony&types=LORA&limit=10'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    r = urllib.request.urlopen(req)
    data = json.loads(r.read().decode())
    for item in data.get('items', []):
        print(f"Model: {item['name']} (ID: {item['id']})")
        for v in item.get('modelVersions', []):
            print(f"   v: {v['name']} (vID: {v['id']}) - base: {v.get('baseModel')}")
except Exception as e:
    print('Error:', e)
