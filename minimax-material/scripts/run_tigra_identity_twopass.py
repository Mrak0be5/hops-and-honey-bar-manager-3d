# -*- coding: utf-8 -*-
import json, shutil, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\identity_twopass")
PREFIX_DIR = "Tigra_2026/identity_twopass"
INPUT_DIR = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input")

WTP = 0.18
ANTHRO_M, ANTHRO_C = 0.72, 0.88
GYM_LORA = 0.18
BALLSDEEP_P2 = 0.22
DEEPCON_P2 = 0.20
CFG, STEPS = 6.5, 60
DENOISE_P2 = 0.48

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

BASE_NEG = (
    "blue eyes, cyan eyes, teal eyes, blur, glow, white glove, glove, bad anatomy, low quality, watermark, text, "
    "white tail, white legs, white ass, white butt, neuroslop, melted, extra limbs, fused fingers, deformed, "
    "(floating penis:1.4), (disembodied penis:1.4), dildo, butt plug, sex toy, looking at viewer, looking at camera, eye contact, "
    "(human face:1.7), (human girl face:1.7), (pretty human woman:1.7), (anime human face:1.7), (human nose:1.5), "
    "(human lips:1.9), (plump lips:1.9), (pink lips:1.8), (lipstick:1.8), (lip gloss:1.7), (full lips:1.8), "
    "(feral snout:1.5), (horse muzzle:1.5), (long snout:1.5), (long crocodile snout:1.5), "
    "(muzzle strap:1.6), (ball gag:1.6), "
    "(yellow eyes:1.5), (golden eyes:1.4), (eyeshadow:1.5), (purple eyeshadow:1.5), "
    "leather jacket, coat, glasses, sunglasses, underwear, panties, pillow, bed, bedroom, "
    "(male tiger:1.6), (anthro male:1.6), (furry male:1.6), (male tail:1.6), "
    "character sheet, reference sheet, turnaround, multiple views, collage, T-pose, "
    "(cheerleader:1.6), (2girls:1.8), (3girls:1.8), (multiple girls:1.7), (crowd:1.5), "
    "vaginal sex, anal sex, doggystyle, from behind, monochrome, censored"
)

NEG_P1 = BASE_NEG + ", shallow, tip only"
NEG_P2 = BASE_NEG + ", shallow, tip only, half inserted, closed mouth, just posing, licking tip only"

ORAL_BAN = (
    "fellatio", "blowjob", "deepthroat", "oral sex", "oral", "penis in mouth",
    "irrumatio", "facefuck", "cock in mouth", "sucking cock", "mouth sex",
)

POSES = [
    ("kneeling_profile", "kneeling on gym floor, looking up, hands on his thighs, (profile view of face:1.45), (side view:1.35)", 926701),
    ("sitting_profile", "sitting on gym bench, leaning forward, (profile view of face:1.45), (side view:1.35)", 926702),
    ("close_34", "close-up three-quarter view from the side, kneeling, (profile view of face:1.4)", 926703),
]


def assert_oral_allowed(neg, label):
    low = neg.lower()
    hits = [w for w in ORAL_BAN if w in low]
    if hits:
        raise RuntimeError(f"{label} negative blocks oral: {hits}")


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


def graph_p1(pose_desc, seed, prefix):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP, 1.0, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    m, c = add_lora(nodes, "4", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)
    work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, sweaty, post-workout, not looking at camera"
    pos = (
        f"{FACE}, closed feline muzzle, thin mouth line, penis in front of muzzle, "
        f"{MALE}, {work}, human male standing, {OUTFIT}\n"
        f"BREAK\n{CHAR}"
    )
    assert_oral_allowed(NEG_P1, "pass1")
    nodes.update({
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG_P1, "clip": [c, 1]}},
        "102": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "103": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "karras", "denoise": 1.0,
                "model": [m, 0], "positive": ["100", 0], "negative": ["101", 0], "latent_image": ["102", 0],
            },
        },
        "104": {"class_type": "VAEDecode", "inputs": {"samples": ["103", 0], "vae": ["1", 2]}},
        "105": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["104", 0]}},
    })
    return nodes, pos, NEG_P1


def graph_p2(pose_desc, seed, prefix, input_name):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP, 1.0, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    m, c = add_lora(nodes, "4", "BallsDeep-PN-V3.1.safetensors", BALLSDEEP_P2, BALLSDEEP_P2 * 0.9, m, c)
    m, c = add_lora(nodes, "5", "ponyxl-deep_penetration-concept-v01.safetensors", DEEPCON_P2, DEEPCON_P2, m, c)
    m, c = add_lora(nodes, "6", "m0d3rn_gym-p.safetensors", GYM_LORA, GYM_LORA, m, c)
    work = f"(((in a gym))), fitness center, gym equipment, {pose_desc}, sweaty, post-workout, not looking at camera"
    pos = (
        f"{FACE}, (((fellatio))), deepthroat, "
        f"(((muzzle wrapped around penis))), throat bulge, shaft in muzzle, "
        f"{MALE}, {work}, human male standing, only oral, {OUTFIT}\n"
        f"BREAK\n{CHAR}"
    )
    assert_oral_allowed(NEG_P2, "pass2")
    nodes.update({
        "20": {"class_type": "LoadImage", "inputs": {"image": input_name}},
        "21": {"class_type": "VAEEncode", "inputs": {"pixels": ["20", 0], "vae": ["1", 2]}},
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG_P2, "clip": [c, 1]}},
        "103": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "karras", "denoise": DENOISE_P2,
                "model": [m, 0], "positive": ["100", 0], "negative": ["101", 0], "latent_image": ["21", 0],
            },
        },
        "104": {"class_type": "VAEDecode", "inputs": {"samples": ["103", 0], "vae": ["1", 2]}},
        "105": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["104", 0]}},
    })
    return nodes, pos, NEG_P2


def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.loads(r.read().decode())
        if body.get("error") or body.get("node_errors"):
            raise RuntimeError(json.dumps(body, ensure_ascii=False)[:2000])
        return body["prompt_id"]


def wait_queue(timeout=7200):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(f"{COMFY}/queue", timeout=15) as r:
                q = json.loads(r.read().decode())
            nrun = len(q.get("queue_running") or [])
            npend = len(q.get("queue_pending") or [])
            if nrun == 0 and npend == 0:
                return
            print(f"queue running={nrun} pending={npend} elapsed={int(time.time()-t0)}s", flush=True)
        except Exception as e:
            print("queue poll", e, flush=True)
        time.sleep(8)
    raise TimeoutError("queue timeout")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assert_oral_allowed(NEG_P1, "pass1")
    assert_oral_allowed(NEG_P2, "pass2")
    print("neg oral-ok", flush=True)

    jobs = []
    for i, (key, desc, seed) in enumerate(POSES, start=1):
        prefix = f"{PREFIX_DIR}/tp{i:02d}_{key}_p1"
        nodes, pos, neg = graph_p1(desc, seed, prefix)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "seed": seed, "pass": 1, "prefix": prefix, "prompt_id": pid, "prompt": pos, "negative": neg})
        print(f"queued p1 {i} {key} {pid}", flush=True)

    print("waiting pass1 (+any current queue)", flush=True)
    wait_queue()
    time.sleep(2)

    for i, (key, desc, seed) in enumerate(POSES, start=1):
        srcs = sorted(OUT.glob(f"tp{i:02d}_{key}_p1*.png"))
        if not srcs:
            raise FileNotFoundError(f"missing pass1 {key}")
        src = srcs[-1]
        inp_name = f"tigra_tp{i:02d}_p1.png"
        shutil.copy2(src, INPUT_DIR / inp_name)
        prefix = f"{PREFIX_DIR}/tp{i:02d}_{key}_p2"
        nodes, pos, neg = graph_p2(desc, seed + 17, prefix, inp_name)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "seed": seed + 17, "pass": 2, "prefix": prefix, "prompt_id": pid, "prompt": pos, "negative": neg, "from": src.name})
        print(f"queued p2 {i} {key} {pid} from {src.name}", flush=True)

    print("waiting pass2", flush=True)
    wait_queue()
    time.sleep(2)
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    files = sorted(OUT.glob("*_p2*.png"))
    print("p2 files", len(files), flush=True)
    for p in files:
        print(p.name, p.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
