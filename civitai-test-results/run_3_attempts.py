import urllib.request
import json
import time

api_key = "12b71406df2ba5655e11aae36553d154"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

ref_sheet = "https://tempfile.redpandaai.co/kieai/1335989/tigra-refs/1785874195442-ouvk6cnjd1.png"

# We will run 3 precise attempts on Civitai and Seedream
# Attempt 1: Furry Vision XL + Deepthroat (girl lying) LoRA + strong prompt tuning
# Attempt 2: Illustrious / TovaMix + Deepthroat Concept booru v2 + strong prompt tuning
# Attempt 3: Seedream 5 Pro image-to-image via Kie API with ref sheet

tigra_desc = "anthro female tiger, orange fur, bold black tiger stripes, white muzzle chest stomach, short silver-white bob haircut with straight bangs, bright green eyes, six-pack abs, long ringed tiger tail, digitigrade paws"

runs = [
    {
        "name": "Attempt 1 (Furry Vision XL + Girl Lying LoRA)",
        "model": "urn:air:sdxl:checkpoint:civitai:1860144@2736029",
        "lora": {"urn:air:sdxl:lora:civitai:1116228@1254364": 0.95},
        "prompt": f"masterpiece, best quality, ultra-detailed, 1girl, {tigra_desc}, 1boy, lying on back, lying on floor, penis in mouth, cock in mouth, deepthroat, face_deepthroat, fellatio, oral, throatfuck, saliva, saliva trail, gagging, green eyes looking away at glowing TV screen in background, NOT looking at partner, NOT looking at camera, distracted by show, studio lighting, rating_explicit",
        "neg": "lowres, bad anatomy, bad hands, human skin, looking at camera, looking at partner, worst quality"
    },
    {
        "name": "Attempt 2 (TovaMix v1.6 + Deepthroat Concept v2 LoRA)",
        "model": "urn:air:sdxl:checkpoint:civitai:2284900@3075829",
        "lora": {"urn:air:sdxl:lora:civitai:1439937@2146834": 0.9},
        "prompt": f"masterpiece, best quality, ultra-detailed, 1girl, {tigra_desc}, <lora:deepthroat-v2-illustriousxl-lora-nochekaiser:1>, deepthroat, irrumatio, fellatio, oral, 1boy, penis, erect penis, lying on back, head hanging off couch, inverted face, penis in mouth, throatfuck, gagging, saliva, green eyes looking at glowing TV screen, NOT looking at camera, rating_explicit",
        "neg": "lowres, bad anatomy, bad hands, human skin, worst quality"
    },
    {
        "name": "Attempt 3 (Pony V6 XL + Deepthroat Concept Pony LoRA)",
        "model": "urn:air:sdxl:checkpoint:civitai:101055@128078",
        "lora": {
            "urn:air:sdxl:lora:civitai:300005@436219": 0.7, # Furry lora
            "urn:air:sdxl:lora:civitai:923521@1033741": 0.95 # Deepthroat lora
        },
        "prompt": f"score_9, score_8_up, score_7_up, 1girl, {tigra_desc}, <lora:deepthroat-ponyxl-lora-nochekaiser:1>, deepthroat, fellatio, oral, irrumatio, 1boy, penis, erect penis, lying on back, head hanging off sofa, head grab, penis in mouth, gagging, saliva, green eyes, looking away at glowing TV screen, rating_explicit, full body",
        "neg": "score_4, score_5, score_6, lowres, bad anatomy, bad hands, human skin"
    }
]

results = []

for r in runs:
    print(f"=== Submitting {r['name']} ===")
    bodyMap = {
        "steps": [
            {
                "$type": "imageGen",
                "input": {
                    "ecosystem": "sdxl",
                    "engine": "sdcpp",
                    "model": r["model"],
                    "prompt": r["prompt"],
                    "negativePrompt": r["neg"],
                    "width": 896,
                    "height": 1152,
                    "steps": 32,
                    "cfgScale": 7.0,
                    "quantity": 1,
                    "outputFormat": "jpeg",
                    "loras": r["lora"]
                }
            }
        ]
    }
    
    url = "https://orchestration.civitai.com/v2/consumer/workflows?allowMatureContent=true&wait=90"
    req = urllib.request.Request(url, data=json.dumps(bodyMap).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            wf_id = data.get('id')
            print(f"  Workflow: {wf_id}")
            
            # Poll status
            poll_url = f"https://orchestration.civitai.com/v2/consumer/workflows/{wf_id}"
            poll_req = urllib.request.Request(poll_url, headers={"Authorization": f"Bearer {api_key}"})
            img_url = None
            
            for _ in range(60):
                time.sleep(5)
                with urllib.request.urlopen(poll_req) as p_resp:
                    p_data = json.loads(p_resp.read().decode('utf-8'))
                    st = p_data.get('status')
                    print(f"    status={st}")
                    if st in ['succeeded', 'COMPLETED']:
                        img_url = p_data['steps'][0]['output']['images'][0]['url']
                        break
                    if st in ['failed', 'expired']:
                        print(f"    FAILED: {p_data}")
                        break
            
            if img_url:
                print(f"  SUCCESS: {img_url}")
                results.append({"name": r['name'], "url": img_url})
    except Exception as e:
        print(f"  ERROR: {e}")

print("=== ALL CIVITAI RUNS DONE ===")
print(json.dumps(results, indent=2))
