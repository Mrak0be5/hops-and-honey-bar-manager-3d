import urllib.request

models_to_download = [
    {
        "name": "Pony_Muzzle_Mask.safetensors",
        "vid": "534902",
        "desc": "(Pony+XL) muzzle mask"
    },
    {
        "name": "Pony_Maw_Shot_Open_Mouth.safetensors",
        "vid": "1054409",
        "desc": "Pony Open Mouth / Maw Shot"
    },
    {
        "name": "Pony_Mawshots.safetensors",
        "vid": "1700274",
        "desc": "Mawshots Lora (Pony)"
    }
]

for m in models_to_download:
    url = f"https://civitai.com/api/download/models/{m['vid']}?type=Model&format=SafeTensor"
    path = f"C:\\Users\\hebp\\AppData\\Roaming\\StabilityMatrix\\Models\\Lora\\{m['name']}"
    print(f"Downloading {m['desc']} (vID: {m['vid']}) to {path}...")
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Authorization': 'Bearer 33fcedccc4de49a96c2046360c1a8ce2'
    })
    try:
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
        print(f"-> Successfully downloaded {m['name']}!")
    except Exception as e:
        print(f"-> Error downloading {m['name']}: {e}")
