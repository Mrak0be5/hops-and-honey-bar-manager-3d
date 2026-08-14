# -*- coding: utf-8 -*-
import json, shutil, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\inpaint_oral")
PREFIX_DIR = "Tigra_2026/inpaint_oral"
INPUT_DIR = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Packages\ComfyUI\input")

WTP_M, WTP_C = 0.25, 1.0
ANTHRO_M, ANTHRO_C = 0.58, 1.0
BALLSDEEP = 0.14
GYM = 0.12
CFG, STEPS = 7.0, 60
DENOISE_INPAINT = 0.85
GROW_MASK = 16

CHAR = (
    "score_9, score_8_up, score_9, score_8_up, score_7_up, score_6_up, illustration of wnw2,"
    "((extreme detailed tiger woman face)), portrait of nude, tiger paws, fur red tigger furry female nude, "
    "white bob cut, yellow fur, small black eyes, pads on paw, paws, tiger paws, 5fingers on the paws, "
    "tigermovie, white hair, short hair, tiger face, animal, sexual fur body, athletic fitness pumped up body, "
    "extreme detailed black eyes, 2d style, anthro, female, tiger, fur, tiger ears, pube hair, pussy, "
    "white fur breats, fur fingers, fur ass, fur legs, tiger long tail, bold tail, tall body, detailed fur, "
    "realistic fur, 1girl, 1boy"
)

FACE = "furred muzzle, short feline muzzle, philtrum, inverted v mouth, thin mouth line"

NEG_LIPS = (
    "(lips:1.9), (human lips:2.0), (plump lips:1.9), (pink lips:1.9), (full lips:1.8), "
    "(fleshy lips:1.9), (lipstick:1.8), (lip gloss:1.8), (pouty lips:1.8), (human mouth:1.7)"
)

NEG_COMMON = (
    "walls, blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, ai, watermark, text, "
    "white tail, white legs, human face, men face, two character, text, white ass, white butt, anal tail, "
    "cheerleader, 2girls, character sheet, multiple views, collage, T-pose, catgirl, kemonomimi, "
    "vaginal sex, anal sex, doggystyle, from behind, male tiger, anthro male, furry male, "
    + NEG_LIPS
)

NEG_P1 = NEG_COMMON + ", open mouth, fellatio, penis, 1boy, cock"
NEG_P2 = NEG_COMMON + ", closed mouth, just posing, licking tip only"

POSES = [
    ("kneel_right", "kneeling on gym floor, profile facing right, subject on left side of frame, looking right, empty space on the right, head and shoulders", (380, 240, 980, 760), 970101),
    ("sit_right", "sitting on gym bench, profile facing right, subject on left side of frame, looking right, empty space on the right", (400, 220, 980, 740), 970102),
    ("close_right", "close-up profile facing right, head on left, looking right, empty space on the right of muzzle", (300, 180, 1000, 820), 970103),
    ("kneel_up", "kneeling, looking up and right, three-quarter view, subject left, empty space on the right", (360, 200, 960, 740), 970104),
    ("stand_lean", "standing, leaning forward, profile facing right, subject left, empty space on the right of face", (380, 200, 970, 720), 970105),
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


def stack(oral):
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP_M, WTP_C, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    nid = 4
    if oral:
        m, c = add_lora(nodes, str(nid), "BallsDeep-PN-V3.1.safetensors", BALLSDEEP, BALLSDEEP * 0.9, m, c)
        nid += 1
    m, c = add_lora(nodes, str(nid), "m0d3rn_gym-p.safetensors", GYM, GYM, m, c)
    return nodes, m, c


def assert_no_lips_pos(text):
    if "lips" in text.lower():
        raise RuntimeError("lips in positive")


def assert_oral_ok(neg):
    low = neg.lower()
    for w in ("oral sex", "fellatio", "blowjob", "deepthroat", "penis in mouth", "penis on mouth", "minet"):
        if w in low:
            raise RuntimeError(f"oral banned in neg: {w}")


def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.loads(r.read().decode())
        if body.get("error") or body.get("node_errors"):
            raise RuntimeError(json.dumps(body, ensure_ascii=False)[:2000])
        return body["prompt_id"]


def wait_queue(timeout=9000):
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{COMFY}/queue", timeout=15) as r:
            q = json.loads(r.read().decode())
        nrun = len(q.get("queue_running") or [])
        npend = len(q.get("queue_pending") or [])
        if nrun == 0 and npend == 0:
            return
        print(f"queue running={nrun} pending={npend} elapsed={int(time.time()-t0)}s", flush=True)
        time.sleep(12)
    raise TimeoutError("queue timeout")


def graph_p1(pose_desc, seed, prefix):
    nodes, m, c = stack(False)
    pos = (
        f"in a gym, fitness center, {pose_desc}, closed feline muzzle, {FACE}, "
        f"black sports bra, black crop top, black choker, bottomless, solo, 1girl,\n\n{CHAR}"
    )
    assert_no_lips_pos(pos)
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


def write_mask(box, dest):
    im = Image.new("RGB", (1024, 1024), (0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse(box, fill=(255, 255, 255))
    im = im.filter(ImageFilter.GaussianBlur(radius=12))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)


def graph_p2(pose_desc, seed, prefix, img_name, mask_name):
    nodes, m, c = stack(True)
    pos = (
        f"fellatio, deepthroat, muzzle wrapped around penis, {FACE}, "
        f"standing human male, human skin male, real human male penis, "
        f"in a gym, {pose_desc}, black sports bra, black crop top, black choker, bottomless, 1girl, 1boy,\n\n{CHAR}"
    )
    assert_no_lips_pos(pos)
    assert_oral_ok(NEG_P2)
    nodes.update({
        "20": {"class_type": "LoadImage", "inputs": {"image": img_name}},
        "21": {"class_type": "LoadImage", "inputs": {"image": mask_name}},
        "22": {"class_type": "ImageToMask", "inputs": {"image": ["21", 0], "channel": "red"}},
        "23": {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {
                "pixels": ["20", 0],
                "vae": ["1", 2],
                "mask": ["22", 0],
                "grow_mask_by": GROW_MASK,
            },
        },
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG_P2, "clip": [c, 1]}},
        "103": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "karras", "denoise": DENOISE_INPAINT,
                "model": [m, 0], "positive": ["100", 0], "negative": ["101", 0], "latent_image": ["23", 0],
            },
        },
        "104": {"class_type": "VAEDecode", "inputs": {"samples": ["103", 0], "vae": ["1", 2]}},
        "105": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["104", 0]}},
    })
    return nodes, pos, NEG_P2


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i, (key, desc, box, seed) in enumerate(POSES, start=1):
        prefix = f"{PREFIX_DIR}/ip{i:02d}_{key}_p1"
        nodes, pos, neg = graph_p1(desc, seed, prefix)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "pass": 1, "seed": seed, "prompt_id": pid, "prompt": pos, "negative": neg})
        print(f"queued p1 {i} {key} {pid}", flush=True)
    print("waiting p1", flush=True)
    wait_queue()
    time.sleep(2)

    for i, (key, desc, box, seed) in enumerate(POSES, start=1):
        srcs = sorted(OUT.glob(f"ip{i:02d}_{key}_p1*.png"))
        if not srcs:
            raise FileNotFoundError(key)
        src = srcs[-1]
        img_name = f"tigra_ip{i:02d}_p1.png"
        mask_name = f"tigra_ip{i:02d}_mask.png"
        shutil.copy2(src, INPUT_DIR / img_name)
        write_mask(box, INPUT_DIR / mask_name)
        shutil.copy2(INPUT_DIR / mask_name, OUT / mask_name)
        prefix = f"{PREFIX_DIR}/ip{i:02d}_{key}_p2"
        nodes, pos, neg = graph_p2(desc, seed + 21, prefix, img_name, mask_name)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "pass": 2, "seed": seed + 21, "prompt_id": pid, "prompt": pos, "negative": neg, "from": src.name, "mask": box, "denoise": DENOISE_INPAINT})
        print(f"queued p2 {i} {key} {pid}", flush=True)

    print("waiting p2", flush=True)
    wait_queue()
    time.sleep(2)
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    files = sorted(OUT.glob("*_p2*.png"))
    print("p2 files", len(files), flush=True)
    for p in files:
        print(p.name, p.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
