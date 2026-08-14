# -*- coding: utf-8 -*-
import json, random, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\identity_fix_test")
COMFY_OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output")

# Restored & Tuned Strengths
WTP = 0.18
ANTHRO_M, ANTHRO_C = 0.85, 0.95  # Boosted for strong identity lock
BALLSDEEP_AV, BALLSDEEP_ORAL = 0.60, 0.35
DEEPCON_AV, DEEPCON_ORAL = 0.50, 0.35
DOGGY = 0.35
BEHIND = 0.35
GYM_LORA = 0.30  # Reduced from 0.60 so it doesn't destroy character
CFG, STEPS = 6.5, 60

CHAR = (
    "score_9, score_8_up, score_9, score_8_up, score_7_up, score_6_up, illustration of wnw2,"
    "((extreme detailed tiger woman face)), portrait of nude, tiger paws, fur red tigger furry female nude, "
    "white bob cut, yellow fur, small black eyes, pads on paw, paws, tiger paws, 5fingers on the paws, "
    "tigermovie, white hair, short hair, tiger face, animal, sexual fur body, athletic fitness pumped up body, "
    "extreme detailed black eyes, 2d style, anthro, female, tiger, fur, tiger ears, pube hair, pussy, "
    "white fur breats, fur fingers, fur ass, fur legs, tiger long tail, bold tail, tall body, detailed fur, "
    "realistic fur, 1girl, 1boy, (single tiger tail:1.3)"
)

# No 'cheerleader' keyword - it bleeds human anime girls!
OUTFIT = "(((black crop top))), bottomless, no panties, bare bottom, midriff, (((black choker)))"

FACE = (
    "(((anthro tiger female face))), (((tiger muzzle))), (((tiger snout))), "
    "furry tiger face, NOT human face, animal nose, facial stripes, "
    "(((white bob hair))), (((tiger ears))), orange fur, white belly, black stripes, pink nose"
)

MALE = (
    "(((human male))), (((1boy))), (((human skin))), (((real human male penis))), "
    "muscular human male torso, male hands holding her hips, "
    "male hips, male thighs, pubic hair, human man body, no tiger male, no furry male"
)

DEEP = "deep penetration, (((balls deep))), (((fully hilted))), (((only balls and base of shaft visible))), hips flush, no gap"
DESK = "single image, one shot, no collage, no panels, no pillow, no bed, office desk, laptop"

BASE_NEG = (
    "blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, watermark, text, "
    "white tail, white legs, human face, men face, white ass, white butt, neuroslop, melted, extra limbs, fused fingers, deformed, "
    "(floating penis:1.4), (disembodied penis:1.4), dildo, butt plug, sex toy, soda can, looking at viewer, looking at camera, eye contact, "
    "human girl face, pretty human woman, anime human face, semi-human face, no muzzle, no snout, shallow, tip only, half inserted, long shaft outside, "
    "leather jacket, coat, no glasses, pillow on desk, bed, bedroom, mattress, desk, office, floating, standing on nothing, glasses, sunglasses, underwear, panties, "
    "male tiger, anthro male, furry male, tiger man, male with fur, male with stripes, male tail, character sheet, reference sheet, turnaround, multiple views, collage, inset, sprite sheet, futa, hermaphrodite, solo, "
    "(multiple tails:1.4), (two tails:1.4), (three legs:1.4), (tail merged with penis:1.4), bent barbell, melted metal, broken dumbbell, "
    "(cheerleader:1.5), (human female:1.5), (2girls:1.5), (other girls:1.5), (crowd:1.5), (extra characters:1.5)"
)

POSES_ANAL = {
    "bench_press": "(missionary position:1.3), lying on back on weightlifting bench, raised legs, spread legs, feet in air, human male standing between legs",
    "doggystyle": "doggystyle, bent over, from behind, all fours on gym mat",
}

POSES_ORAL = {
    "kneeling": "kneeling on gym floor, looking up, hands on his thighs, (side view of face:1.2)",
    "sitting_bench": "sitting on gym bench, leaning forward, (profile view of face:1.3)",
}

def positive(act, pose_key):
    if act == "anal":
        pose_desc = POSES_ANAL[pose_key]
        work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, freeuse, sweaty, post-workout, not looking at camera"
        prompt = (
            f"(((anal sex))), deep penetration, anal, "
            f"(((human cock balls deep in anus))), (((anal hilted))), "
            f"anus stretched around base only, balls against ass, clear anal not vaginal, "
            f"{DEEP}, {MALE}, {work}, {FACE}, {DESK}, freeuse gym"
        )
    else:
        pose_desc = POSES_ORAL[pose_key]
        work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, freeuse, sweaty, post-workout, not looking at camera"
        prompt = (
            f"(((fellatio))), deepthroat, deep penetration, (((open animal mouth))), (((fangs))), long snout, detailed tiger jaw, "
            f"(((lips at base of penis))), (((balls on chin))), throat bulge, "
            f"{MALE}, {FACE}, {DESK}, {work}, freeuse gym, human male standing, only oral"
        )
    return f"{prompt},\n\n{OUTFIT}\n\n{CHAR}"

def add_lora(nodes, nid, name, sm, sc, model_from, clip_from):
    nodes[nid] = {
        "class_type": "LoraLoader",
        "inputs": {"lora_name": name, "strength_model": sm, "strength_clip": sc, "model": [model_from, 0], "clip": [clip_from, 1]}
    }
    return nid, nid

def graph(act, pose_key, seed, prefix):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP, 1.0, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    bd = BALLSDEEP_ORAL if act == "oral" else BALLSDEEP_AV
    m, c = add_lora(nodes, "4", "BallsDeep-PN-V3.1.safetensors", bd, bd * 0.9, m, c)
    dc = DEEPCON_ORAL if act == "oral" else DEEPCON_AV
    m, c = add_lora(nodes, "5", "ponyxl-deep_penetration-concept-v01.safetensors", dc, dc, m, c)
    
    if act == "anal" and pose_key in ["doggystyle"]:
        m, c = add_lora(nodes, "6", "doggystyle-ponyxl-lora-nochekaiser.safetensors", DOGGY, DOGGY, m, c)
        m, c = add_lora(nodes, "7", "sex_from_behind_pony_V1.0.safetensors", BEHIND, BEHIND, m, c)
    
    if act == "oral":
        m, c = add_lora(nodes, "8", "facefuck_pony.safetensors", 0.20, 0.30, m, c)
        m, c = add_lora(nodes, "20", "Female_Tongue_Mouth_and_Teeth_-_PONY-v2.safetensors", 0.35, 0.35, m, c)

    m, c = add_lora(nodes, "21", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)

    neg = BASE_NEG + (", vaginal sex, penis in pussy, oral sex, fellatio, penis in mouth" if act == "anal" else ", vaginal sex, anal sex, penis in ass, penis in pussy, closed mouth, just posing, licking tip only, doggystyle, from behind")
    pos = positive(act, pose_key)

    nodes.update({
        "10": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "11": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": [c, 1]}},
        "12": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "13": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": STEPS, "cfg": CFG, "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "karras", "denoise": 1.0, "model": [m, 0], "positive": ["10", 0], "negative": ["11", 0], "latent_image": ["12", 0]}},
        "14": {"class_type": "VAEDecode", "inputs": {"samples": ["13", 0], "vae": ["1", 2]}},
        "15": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["14", 0]}},
    })
    return nodes

def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())["prompt_id"]

def wait_queue(timeout=14400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            req = urllib.request.Request(f"{COMFY}/queue")
            with urllib.request.urlopen(req, timeout=15) as r:
                q = json.loads(r.read().decode())
            if not q.get("queue_pending") and not q.get("queue_running"):
                return
        except Exception:
            pass
        time.sleep(5)
    raise TimeoutError("queue timeout")

def safe_copy(src, dst, retries=12):
    for _ in range(retries):
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
            return True
        except Exception:
            time.sleep(1.2)
    return False

def main():
    if not OUT.exists(): OUT.mkdir(parents=True)
    rng = random.Random(12345)
    
    # 2 Anal, 2 Oral test
    tests = [
        ("anal", "bench_press", "t01"),
        ("anal", "doggystyle", "t02"),
        ("oral", "kneeling", "t01"),
        ("oral", "sitting_bench", "t02"),
    ]
    
    for act, pose, tag in tests:
        seed = rng.randint(1, 2**63 - 1)
        prefix = f"Tigra_2026/identity_fix_test/{act}_{tag}_{pose}"
        queue(graph(act, pose, seed, prefix))
        print(f"Queued {act} {tag} {pose} (seed={seed})")
    
    print("Waiting for test generation...")
    wait_queue()
    time.sleep(2)
    
    for act, pose, tag in tests:
        sub = COMFY_OUT / "Tigra_2026" / "identity_fix_test"
        dest = OUT / act
        if sub.exists():
            for p in sorted(sub.glob("*.png")):
                if p.resolve() != (dest / p.name).resolve():
                    safe_copy(p, dest / p.name)
                    try: p.unlink()
                    except: pass
    print("Test complete.")

if __name__ == "__main__":
    main()
