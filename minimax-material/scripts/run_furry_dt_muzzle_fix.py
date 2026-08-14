# -*- coding: utf-8 -*-
import json, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\furry_dt_muzzle_fix")
PREFIX_DIR = "Tigra_2026/furry_dt_muzzle_fix"

WTP = 0.18
ANTHRO_M, ANTHRO_C = 0.95, 1.0
ELEPTOR = 0.40
BALLSDEEP_ORAL = 0.30
DEEPCON_ORAL = 0.25
MUZZLE = 0.65
MAW = 0.35
FURRY_DT = 0.20
GYM_LORA = 0.20
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
    "(anthro female tiger:1.5), female_tiger, (tiger snout:1.6), (tiger muzzle:1.6), "
    "long animal snout, whiskers, pink animal nose, black stripes on muzzle, "
    "(((small black eyes))), no makeup, no eyeshadow, "
    "(((white bob hair))), (((tiger ears))), orange fur, white muzzle fur, black stripes"
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
    "(human face:1.8), (human girl face:1.8), (pretty human woman:1.8), (anime human face:1.8), (semi-human face:1.8), "
    "(human nose:1.8), (human mouth:1.8), (human cheeks:1.8), (human jaw:1.6), (human chin:1.6), "
    "(lips:1.9), (human lips:1.9), (pink lips:1.8), (lipstick:1.7), (lip gloss:1.6), (plump lips:1.8), (full lips:1.7), "
    "(yellow eyes:1.7), (golden eyes:1.6), (eyeshadow:1.7), (purple eyeshadow:1.7), (makeup:1.6), (long eyelashes:1.5), "
    "no muzzle, no snout, shallow, tip only, half inserted, long shaft outside, "
    "leather jacket, coat, no glasses, pillow on desk, bed, bedroom, mattress, desk, office, floating, standing on nothing, glasses, sunglasses, underwear, panties, "
    "male tiger, anthro male, furry male, tiger man, male with fur, male with stripes, male tail, character sheet, reference sheet, turnaround, multiple views, collage, inset, sprite sheet, futa, hermaphrodite, solo, "
    "(multiple tails:1.4), (two tails:1.4), (three legs:1.4), (tail merged with penis:1.4), bent barbell, melted metal, broken dumbbell, "
    "(cheerleader:1.8), (human female:1.8), (2girls:1.5), (other girls:1.5), (crowd:1.5), (extra characters:1.5), "
    "(male tiger:1.5), (furry male:1.5), (striped male:1.5), "
    "vaginal sex, anal sex, penis in ass, penis in pussy, closed mouth, just posing, licking tip only, doggystyle, from behind, "
    "monochrome, words, sound effects, text, letters, censored, black bar"
)

POSES = [
    ("kneeling", "kneeling on gym floor, looking up, hands on his thighs, (side view of face:1.3)", 713401),
    ("sitting_bench", "sitting on gym bench, leaning forward, (profile view of face:1.4)", 713402),
    ("lying_back", "lying on back on gym mat, looking up at him, (side view of face:1.3)", 713403),
    ("standing_oral", "standing, bending knees slightly, (profile view of face:1.4)", 713404),
    ("kneeling_close", "close-up side view, kneeling, snout at base of penis, throat bulge, (profile view of muzzle:1.4)", 713405),
]


def add_lora(nodes, nid, name, sm, sc, model_from, clip_from):
    nodes[nid] = {
        "class_type": "LoraLoader",
        "inputs": {
            "lora_name": name,
            "strength_model": sm,
            "strength_clip": sc,
            "model": [model_from, 0],
            "clip": [clip_from, 1],
        },
    }
    return nid, nid


def graph(pose_desc, seed, prefix):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP, 1.0, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    m, c = add_lora(nodes, "4", "eleptor_tiger.safetensors", ELEPTOR, ELEPTOR, m, c)
    m, c = add_lora(nodes, "5", "Pony_Muzzle_Mask.safetensors", MUZZLE, MUZZLE, m, c)
    m, c = add_lora(nodes, "6", "Pony_Maw_Shot_Open_Mouth.safetensors", MAW, MAW, m, c)
    m, c = add_lora(nodes, "7", "BallsDeep-PN-V3.1.safetensors", BALLSDEEP_ORAL, BALLSDEEP_ORAL * 0.9, m, c)
    m, c = add_lora(nodes, "8", "ponyxl-deep_penetration-concept-v01.safetensors", DEEPCON_ORAL, DEEPCON_ORAL, m, c)
    m, c = add_lora(nodes, "9", "Furry_Deep_Throat.safetensors", FURRY_DT, FURRY_DT, m, c)
    m, c = add_lora(nodes, "10", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)

    work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, freeuse, sweaty, post-workout, not looking at camera"
    pos = (
        f"(((fellatio))), deepthroat, furry_deepthroat, muzzle_mask, maw shot, "
        f"(anthro tiger:1.5), (((open animal maw))), (((fangs))), (tiger snout:1.5), "
        f"(((snout wrapped around penis))), (((muzzle at base of penis))), (((no human lips))), "
        f"whiskers, animal mouth, throat bulge, "
        f"{MALE}, {FACE}, {DESK}, {work}, freeuse gym, human male standing, only oral,\n\n{OUTFIT}\n\n{CHAR}"
    )

    nodes.update({
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": BASE_NEG, "clip": [c, 1]}},
        "102": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "103": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": "dpmpp_3m_sde_gpu",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": [m, 0],
                "positive": ["100", 0],
                "negative": ["101", 0],
                "latent_image": ["102", 0],
            },
        },
        "104": {"class_type": "VAEDecode", "inputs": {"samples": ["103", 0], "vae": ["1", 2]}},
        "105": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["104", 0]}},
    })
    return nodes, pos


def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())["prompt_id"]


def wait_queue(timeout=3600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(f"{COMFY}/queue", timeout=15) as r:
                q = json.loads(r.read().decode())
            if not q.get("queue_pending") and not q.get("queue_running"):
                return
        except Exception:
            pass
        time.sleep(5)
    raise TimeoutError("queue timeout")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i, (key, desc, seed) in enumerate(POSES, start=1):
        prefix = f"{PREFIX_DIR}/mf{i:02d}_{key}"
        nodes, pos = graph(desc, seed, prefix)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "seed": seed, "prefix": prefix, "prompt_id": pid, "prompt": pos})
        print(f"queued {i} {key} seed={seed} pid={pid}", flush=True)
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    print("waiting", flush=True)
    wait_queue()
    time.sleep(2)
    files = sorted(OUT.glob("*.png"))
    print("files", len(files), flush=True)
    for p in files:
        print(p.name, flush=True)


if __name__ == "__main__":
    main()
