import os, json
from PIL import Image

folder = r'C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img'

def get_png_prompt(path):
    try:
        with Image.open(path) as img:
            prompt_raw = img.info.get('prompt')
            if not prompt_raw:
                return str(img.info.get('parameters', ''))
            data = json.loads(prompt_raw)
            text_inputs = []
            for node_id, node in data.items():
                class_type = node.get('class_type', '')
                inputs = node.get('inputs', {})
                if 'text' in inputs and isinstance(inputs['text'], str):
                    text_inputs.append(f"{class_type}: {inputs['text']}")
                if 'lora_name' in inputs:
                    text_inputs.append(f"LORA: {inputs['lora_name']}")
            return '\n'.join(text_inputs)
    except Exception as e:
        return f"ERR: {e}"

files = [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f)) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]

by_name = sorted(files)[:30]
print("=== ALPHABETICAL TOP 30 ===")
for i, f in enumerate(by_name, 1):
    p = get_png_prompt(os.path.join(folder, f))
    p_single = ' | '.join(p.split('\n'))
    print(f"{i:2d}. {f}\n    -> {p_single[:200]}\n")

by_mtime_desc = sorted(files, key=lambda f: os.path.getmtime(os.path.join(folder, f)), reverse=True)[:30]
print("=== NEWEST TOP 30 (mtime desc) ===")
for i, f in enumerate(by_mtime_desc, 1):
    p = get_png_prompt(os.path.join(folder, f))
    p_single = ' | '.join(p.split('\n'))
    print(f"{i:2d}. {f}\n    -> {p_single[:200]}\n")
