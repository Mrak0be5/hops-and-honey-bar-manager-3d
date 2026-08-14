# -*- coding: utf-8 -*-
import json, random, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\v7_furry_oral_test")
COMFY_OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\output")

# Base Settings
WTP = 0.18
ANTHRO_M, ANTHRO_C = 0.85, 0.95
BALLSDEEP_ORAL = 0.35
DEEPCON_ORAL = 0.35
GYM_LORA = 0.25
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

OUTFIT = "(((black sports bra))), (((black crop top))), bottomless, no panties, bare bottom, midriff, (((black choker)))"

FACE = (
    "(((anthro tiger female face))), (((tiger muzzle))), (((tiger snout))), "
    "furry tiger face, NOT human face, animal nose, facial stripes, "
    "(((white bob hair))), (((tiger ears))), orange fur, white belly, black stripes, pink nose"
)

MALE = (
    "(((human male))), (((1boy))), (((human skin))), (((real human male penis))), "
    "(human skin male:1.3), (smooth human skin male:1.3), muscular human male torso, male hands holding her head, "
    "male hips, male thighs, pubic hair, human man body, no tiger male, no furry male"
)

DESK = "single image, one shot, no collage, no panels, no pillow, no bed, office desk, laptop"

BASE_NEG = (
    "blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, watermark, text, "
    "white tail, white legs, white ass, white butt, neuroslop, melted, extra limbs, fused fingers, deformed, "
    "(floating penis:1.4), (disembodied penis:1.4), dildo, butt plug, sex toy, soda can, looking at viewer, looking at camera, eye contact, "
    "(human face:1.8), (human girl face:1.8), (pretty human woman:1.8), (anime human face:1.8), (semi-human face:1.8), (human nose:1.8), (human mouth:1.8), (human cheeks:1.8), "
    "no muzzle, no snout, shallow, tip only, half inserted, long shaft outside, "
    "leather jacket, coat, no glasses, pillow on desk, bed, bedroom, mattress, desk, office, floating, standing on nothing, glasses, sunglasses, underwear, panties, "
    "male tiger, anthro male, furry male, tiger man, male with fur, male with stripes, male tail, character sheet, reference sheet, turnaround, multiple views, collage, inset, sprite sheet, futa, hermaphrodite, solo, "
    "(multiple tails:1.4), (two tails:1.4), (three legs:1.4), (tail merged with penis:1.4), bent barbell, melted metal, broken dumbbell, "
    "(cheerleader:1.8), (human female:1.8), (2girls:1.5), (other girls:1.5), (crowd:1.5), (extra characters:1.5), "
    "(male tiger:1.5), (furry male:1.5), (striped male:1.5)"
)

def add_lora(nodes, nid, name, sm, sc, model_from, clip_from):
    nodes[nid] = {
        "class_type": "LoraLoader",
        "inputs": {"lora_name": name, "strength_model": sm, "strength_clip": sc, "model": [model_from, 0], "clip": [clip_from, 1]}
    }
    return nid, nid

def graph(test_config, seed, prefix):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    # 1. Style
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP, 1.0, m, c)
    # 2. Main Anthro Tiger LoRA
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    
    # 3. Deep penetration support
    m, c = add_lora(nodes, "4", "BallsDeep-PN-V3.1.safetensors", BALLSDEEP_ORAL, BALLSDEEP_ORAL * 0.9, m, c)
    m, c = add_lora(nodes, "5", "ponyxl-deep_penetration-concept-v01.safetensors", DEEPCON_ORAL, DEEPCON_ORAL, m, c)
    
    # 4. Specific Oral LoRA configuration for this test
    lora_id = 10
    for lora_name, sm, sc in test_config["loras"]:
        m, c = add_lora(nodes, str(lora_id), lora_name, sm, sc, m, c)
        lora_id += 1

    # 5. Gym environment
    m, c = add_lora(nodes, "21", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)

    neg = BASE_NEG + ", vaginal sex, anal sex, penis in ass, penis in pussy, closed mouth, just posing, licking tip only, doggystyle, from behind"
    
    pose_desc = "kneeling on gym floor, looking up, hands on his thighs, (side view of face:1.2)"
    work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, freeuse, sweaty, post-workout, not looking at camera"
    
    pos = (
        f"(((fellatio))), deepthroat, deep penetration, {test_config['extra_tags']}, "
        f"(((lips at base of penis))), (((balls on chin))), throat bulge, "
        f"{MALE}, {FACE}, {DESK}, {work}, freeuse gym, human male standing, only oral,\n\n{OUTFIT}\n\n{CHAR}"
    )

    nodes.update({
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": [c, 1]}},
        "102": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "103": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": STEPS, "cfg": CFG, "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "karras", "denoise": 1.0, "model": [m, 0], "positive": ["100", 0], "negative": ["101", 0], "latent_image": ["102", 0]}},
        "104": {"class_type": "VAEDecode", "inputs": {"samples": ["103", 0], "vae": ["1", 2]}},
        "105": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["104", 0]}},
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

TESTS = [
    {
        "id": "t1_muzzle_mask",
        "name": "Pony Muzzle Mask",
        "loras": [
            ("Pony_Muzzle_Mask.safetensors", 0.45, 0.45),
            ("facefuck_pony.safetensors", 0.15, 0.25)
        ],
        "extra_tags": "(((muzzle_mask))), (((open animal mouth))), (((fangs))), long snout, detailed tiger jaw"
    },
    {
        "id": "t2_maw_shot",
        "name": "Pony Maw Shot / Open Mouth",
        "loras": [
            ("Pony_Maw_Shot_Open_Mouth.safetensors", 0.40, 0.40),
            ("facefuck_pony.safetensors", 0.15, 0.25)
        ],
        "extra_tags": "(((open mouth, tongue, teeth, uvula, fangs, maw shot))), long snout, detailed tiger jaw"
    },
    {
        "id": "t3_mawshots",
        "name": "Pony Mawshots Lora",
        "loras": [
            ("Pony_Mawshots.safetensors", 0.40, 0.40),
            ("facefuck_pony.safetensors", 0.15, 0.25)
        ],
        "extra_tags": "(((Maw_Shot))), (((open animal mouth))), (((fangs))), long snout, detailed tiger jaw"
    },
    {
        "id": "t4_muzzle_plus_maw",
        "name": "Muzzle Mask + Maw Shot Combo",
        "loras": [
            ("Pony_Muzzle_Mask.safetensors", 0.35, 0.35),
            ("Pony_Maw_Shot_Open_Mouth.safetensors", 0.30, 0.30),
            ("facefuck_pony.safetensors", 0.15, 0.25)
        ],
        "extra_tags": "(((muzzle_mask))), (((open mouth, tongue, teeth, uvula, fangs, maw shot))), long snout, detailed tiger jaw"
    },
    {
        "id": "t5_muzzle_plus_teeth",
        "name": "Muzzle Mask + Female Tongue/Mouth",
        "loras": [
            ("Pony_Muzzle_Mask.safetensors", 0.35, 0.35),
            ("Female_Tongue_Mouth_and_Teeth_-_PONY-v2.safetensors", 0.30, 0.30),
            ("facefuck_pony.safetensors", 0.15, 0.25)
        ],
        "extra_tags": "(((muzzle_mask))), (((mouth open, tongue out, blowjob))), (((fangs))), long snout, detailed tiger jaw"
    }
]

def main():
    if not OUT.exists(): OUT.mkdir(parents=True)
    
    # We will run 2 seeds per test configuration (10 images total)
    seed_a = 888111
    seed_b = 999222
    
    for t in TESTS:
        for s_tag, seed in [("s1", seed_a), ("s2", seed_b)]:
            prefix = f"Tigra_2026/v7_furry_oral_test/{t['id']}_{s_tag}"
            queue(graph(t, seed, prefix))
            print(f"Queued {t['id']} ({t['name']}) - {s_tag} (seed={seed})", flush=True)
            
    print("Waiting for 10 furry oral test images...", flush=True)
    wait_queue()
    time.sleep(2)
    
    sub = COMFY_OUT / "Tigra_2026" / "v7_furry_oral_test"
    if sub.exists():
        for p in sorted(sub.glob("*.png")):
            dest = OUT / p.name
            safe_copy(p, dest)
            try: p.unlink()
            except: pass
    print("Done 10 V7 furry oral test images.", flush=True)

if __name__ == "__main__":
    main()
