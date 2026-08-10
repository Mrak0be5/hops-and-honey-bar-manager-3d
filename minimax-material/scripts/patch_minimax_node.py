import os
path = r'C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\comfy_extras\nodes_minimax_h3.py'
with open(path, 'r') as f:
    text = f.read()

# Add **kwargs to execute
old_sig = 'def execute(cls, clip, vae, audio_vae, prompt, width, height, length, ref_image_size="match",\n                ref_images=None, ref_videos=None, ref_video_audios=None, ref_audios=None) -> io.NodeOutput:'
new_sig = 'def execute(cls, clip, vae, audio_vae, prompt, width, height, length, ref_image_size="match",\n                ref_images=None, ref_videos=None, ref_video_audios=None, ref_audios=None, **kwargs) -> io.NodeOutput:'

if old_sig in text:
    text = text.replace(old_sig, new_sig)
    
    # Add reconstruction logic right after latent, frame_count = ...
    old_body = 'latent, frame_count = _empty_av_latent(width, height, length)\n\n        ref_items = []'
    new_body = '''latent, frame_count = _empty_av_latent(width, height, length)

        ref_images = ref_images or {}
        ref_videos = ref_videos or {}
        ref_video_audios = ref_video_audios or {}
        ref_audios = ref_audios or {}
        for k, v in kwargs.items():
            if k.startswith("ref_image_"): ref_images[k] = v
            elif k.startswith("ref_video_audio_"): ref_video_audios[k] = v
            elif k.startswith("ref_video_"): ref_videos[k] = v
            elif k.startswith("ref_audio_"): ref_audios[k] = v

        ref_items = []'''
    
    text = text.replace(old_body, new_body)
    
    with open(path, 'w') as f:
        f.write(text)
    print("Patched successfully.")
else:
    print("Signature not found. Maybe already patched?")
