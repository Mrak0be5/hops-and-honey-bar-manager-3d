# -*- coding: utf-8 -*-
import json, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\identity_mid")
PREFIX_DIR = "Tigra_2026/identity_mid"

WTP = 0.18
ANTHRO_M, ANTHRO_C = 0.80, 0.92
BALLSDEEP_ORAL = 0.28
DEEPCON_ORAL = 0.25
GYM_LORA = 0.18
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
    "(anthro tigress:1.35), (feline muzzle:1.4), (short tiger snout:1.3), (philtrum:1.3), "
    "(inverted v mouth:1.25), (thin mouth line:1.35), (furred muzzle:1.35), "
    "(white bob bangs:1.3), rounded tiger ears, (small black almond eyes:1.4), black eye markings, "
    "two black cheek stripes, pink feline nose, white muzzle fur, orange face fur"
)

MALE = (
    "(((human male))), (((1boy))), (((human skin))), (((real human male penis))), "
    "(human skin male:1.4), muscular human male torso, male hands holding her head, "
    "male hips, male thighs, pubic hair, human man body, no tiger male, no furry male, no male tail"
)

DESK = "single image, one shot, no collage, no panels, 1girl, 1boy"

BASE_NEG = (
    "blue eyes, cyan eyes, teal eyes, blur, glow, white glove, glove, bad anatomy, low quality, watermark, text, "
    "white tail, white legs, white ass, white butt, neuroslop, melted, extra limbs, fused fingers, deformed, "
    "(floating penis:1.4), (disembodied penis:1.4), dildo, butt plug, sex toy, looking at viewer, looking at camera, eye contact, "
    "(human face:1.7), (human girl face:1.7), (pretty human woman:1.7), (anime human face:1.7), (human nose:1.5), "
    "(human lips:1.9), (plump lips:1.9), (pink lips:1.8), (lipstick:1.8), (lip gloss:1.7), (full lips:1.8), "
    "(feral snout:1.5), (horse muzzle:1.5), (long snout:1.5), (long crocodile snout:1.5), (maw shot:1.4), "
    "(muzzle strap:1.6), (ball gag:1.6), "
    "(yellow eyes:1.5), (golden eyes:1.4), (eyeshadow:1.5), (purple eyeshadow:1.5), "
    "shallow, tip only, half inserted, "
    "leather jacket, coat, glasses, sunglasses, underwear, panties, pillow, bed, bedroom, "
    "(male tiger:1.6), (anthro male:1.6), (furry male:1.6), (male tail:1.6), "
    "character sheet, reference sheet, turnaround, multiple views, collage, T-pose, "
    "(cheerleader:1.6), (2girls:1.8), (3girls:1.8), (multiple girls:1.7), (crowd:1.5), "
    "vaginal sex, anal sex, doggystyle, from behind, monochrome, censored"
)

POSES = [
    ("kneeling_profile", "kneeling on gym floor, looking up, hands on his thighs, (profile view of face:1.4), (side view:1.3)", 915601),
    ("sitting_profile", "sitting on gym bench, leaning forward, (profile view of face:1.45), (side view:1.3)", 915602),
    ("kneeling_34", "kneeling, three-quarter view of face from the side, (short muzzle silhouette:1.3)", 915603),
    ("standing_profile", "standing, bending knees slightly, (profile view of face:1.45)", 915604),
    ("close_profile", "close-up profile, kneeling, muzzle at base of penis, (side view of face:1.45)", 915605),
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
    m, c = add_lora(nodes, "4", "BallsDeep-PN-V3.1.safetensors", BALLSDEEP_ORAL, BALLSDEEP_ORAL * 0.9, m, c)
    m, c = add_lora(nodes, "5", "ponyxl-deep_penetration-concept-v01.safetensors", DEEPCON_ORAL, DEEPCON_ORAL, m, c)
    m, c = add_lora(nodes, "6", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)

    work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, sweaty, post-workout, not looking at camera"
    pos = (
        f"{FACE}, (((fellatio))), deepthroat, "
        f"(((muzzle wrapped around penis))), throat bulge, shaft in muzzle, "
        f"{MALE}, {DESK}, {work}, human male standing, only oral, {OUTFIT}\n"
        f"BREAK\n{CHAR}"
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
        body = json.loads(r.read().decode())
        if body.get("error") or body.get("node_errors"):
            raise RuntimeError(json.dumps(body, ensure_ascii=False)[:2000])
        return body["prompt_id"]


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
        prefix = f"{PREFIX_DIR}/im{i:02d}_{key}"
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
