import sys
sys.path.append(r'C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI')
import comfy_extras.nodes_minimax_h3 as M
import comfy_api.internal.__init__ as _internal

method = M.MiniMaxH3ReferenceToVideo.execute.__func__
try:
    method(M.MiniMaxH3ReferenceToVideo, clip=None, vae=None, audio_vae=None, prompt="test", width=1, height=1, length=1, ref_image_size="match", ref_image_0=None)
except Exception as e:
    print("Error:", type(e), e)
