import sys
with open(r'C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\comfy_api\latest\_io.py', 'r') as f:
    text = f.read()
idx = text.find('dynamic_paths_default_value"][')
print(text[idx-500:idx+500])
