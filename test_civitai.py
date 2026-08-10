import urllib.request, json
try:
    url = 'https://civitai.com/api/v1/models?query=gym+workout&types=LORA&limit=10'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    r = urllib.request.urlopen(req)
    data = json.loads(r.read().decode())
    for m in data.get('items', []):
        print(f"{m['name']} - ID: {m['id']}")
except Exception as e:
    print('Error:', e)
