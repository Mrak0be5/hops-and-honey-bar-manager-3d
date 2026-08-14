# -*- coding: utf-8 -*-
import json, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\no_lips")
PREFIX_DIR = "Tigra_2026/no_lips"

WTP_M, WTP_C = 0.25, 1.0
ANTHRO_M, ANTHRO_C = 0.58, 1.0
BALLSDEEP = 0.16
GYM = 0.12
CFG, STEPS = 7.0, 60

CHAR = (
    "score_9, score_8_up, score_9, score_8_up, score_7_up, score_6_up, illustration of wnw2,"
    "((extreme detailed tiger woman face)), portrait of nude, tiger paws, fur red tigger furry female nude, "
    "white bob cut, yellow fur, small black eyes, pads on paw, paws, tiger paws, 5fingers on the paws, "
    "tigermovie, white hair, short hair, tiger face, animal, sexual fur body, athletic fitness pumped up body, "
    "extreme detailed black eyes, 2d style, anthro, female, tiger, fur, tiger ears, pube hair, pussy, "
    "white fur breats, fur fingers, fur ass, fur legs, tiger long tail, bold tail, tall body, detailed fur, "
    "realistic fur, 1girl, 1boy"
)

MUZZLE = (
    "furred muzzle, short feline muzzle, philtrum, inverted v mouth, thin mouth line, "
    "muzzle wrapped around penis"
)

NEG = (
    "walls, blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, ai, watermark, text, "
    "white tail, white legs, human face, men face, two character, text, white ass, white butt, anal tail, "
    "cheerleader, 2girls, character sheet, multiple views, collage, T-pose, catgirl, kemonomimi, "
    "vaginal sex, anal sex, doggystyle, from behind, closed mouth, just posing, licking tip only, "
    "male tiger, anthro male, furry male, "
    "(lips:1.9), (human lips:2.0), (plump lips:1.9), (pink lips:1.9), (full lips:1.8), "
    "(fleshy lips:1.9), (lipstick:1.8), (lip gloss:1.8), (pouty lips:1.8), (human mouth:1.7)"
)

POSES = [
    ("kneeling_profile", "kneeling on gym floor, looking up, hands on his thighs, profile view of face, side view", 961101),
    ("sitting_profile", "sitting on gym bench, leaning forward, profile view of face, side view", 961102),
    ("close_profile", "close-up profile, kneeling, muzzle at base of penis, side view of face", 961103),
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
    low = NEG.lower()
    for w in ("oral sex", "fellatio", "blowjob", "deepthroat", "penis in mouth", "penis on mouth", "minet"):
        if w in low:
            raise RuntimeError(f"oral banned in neg: {w}")
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "boleromixPony_v210.safetensors"}},
    }
    m, c = "1", "1"
    m, c = add_lora(nodes, "2", "WtP_Style_-_TTM.safetensors", WTP_M, WTP_C, m, c)
    m, c = add_lora(nodes, "3", "Anthro_Tiger_Mk_2.safetensors", ANTHRO_M, ANTHRO_C, m, c)
    m, c = add_lora(nodes, "4", "BallsDeep-PN-V3.1.safetensors", BALLSDEEP, BALLSDEEP * 0.9, m, c)
    m, c = add_lora(nodes, "5", "m0d3rn_gym-p.safetensors", GYM, GYM, m, c)
    pos = (
        f"fellatio, deepthroat, {MUZZLE}, "
        f"human male standing, 1girl, 1boy, in a gym, fitness center, gym equipment, "
        f"{pose_desc}, black sports bra, black crop top, black choker, bottomless,\n\n{CHAR}"
    )
    if "lip" in pos.lower().split("philtrum")[0] and "lips" in pos.lower():
        raise RuntimeError("lips in positive")
    if "lips" in pos.lower():
        raise RuntimeError("lips in positive")
    nodes.update({
        "100": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": [c, 1]}},
        "101": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": [c, 1]}},
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
    return nodes, pos


def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.loads(r.read().decode())
        if body.get("error") or body.get("node_errors"):
            raise RuntimeError(json.dumps(body, ensure_ascii=False)[:2000])
        return body["prompt_id"]


def wait_queue(timeout=2400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{COMFY}/queue", timeout=15) as r:
            q = json.loads(r.read().decode())
        if not q.get("queue_pending") and not q.get("queue_running"):
            return
        time.sleep(5)
    raise TimeoutError("queue timeout")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i, (key, desc, seed) in enumerate(POSES, start=1):
        prefix = f"{PREFIX_DIR}/nl{i:02d}_{key}"
        nodes, pos = graph(desc, seed, prefix)
        pid = queue(nodes)
        jobs.append({"id": i, "key": key, "seed": seed, "prompt_id": pid, "prompt": pos, "negative": NEG})
        print(f"queued {i} {key} {pid}", flush=True)
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    print("waiting", flush=True)
    wait_queue()
    time.sleep(2)
    for p in sorted(OUT.glob("*.png")):
        print(p.name, p.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
