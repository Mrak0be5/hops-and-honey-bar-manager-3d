import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8188/object_info')
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    info = data.get('MiniMaxH3ReferenceToVideo', {})
    print(json.dumps(info, indent=2))
except Exception as e:
    print('Error:', e)
