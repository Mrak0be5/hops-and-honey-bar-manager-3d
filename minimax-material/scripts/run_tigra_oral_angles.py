# -*- coding: utf-8 -*-
import json, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\oral_dt50")
PREFIX_DIR = "Tigra_2026/oral_dt50"

WTP_M, WTP_C = 0.25, 1.0
ANTHRO_M, ANTHRO_C = 0.5, 1.0
GYM = 0.12
BALLSDEEP = 0.08
DEEPCON = 0.15
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
    "muzzle wrapped around penis, muzzle at the base of penis, balls pressed against muzzle"
)

NEG = (
    "walls, blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, ai, watermark, text, "
    "white tail, white legs, human face, men face, two character, text, white ass, white butt, anal tail, "
    "cheerleader, 2girls, catgirl, kemonomimi, vaginal sex, anal sex, doggystyle, from behind, "
    "closed mouth, just posing, licking tip only, male tiger, anthro male, furry male, "
    "(human lips:2.0), (plump lips:1.9), (pink lips:1.9), (fleshy lips:1.9), lipstick, lip gloss, "
    "(choker:2.2), (ring_gag:2.2)"
)

OUTFIT = "(shirt lift:1.45), (clothes lift:1.4), (breasts out:1.55), (nipples:1.4), sports bra bunched at collarbone, bottomless"

DEPTH = "balls deep, deepthroat, muzzle at the base of penis, balls pressed against muzzle"

POSES = [
    ("kneel", "in a gym, upper body portrait, kneeling, looking up, fellatio, {DEPTH}, human male standing"),
    ("profile", "in a gym, upper body portrait, profile, side view, fellatio, {DEPTH}, human male standing"),
    ("threeq", "in a gym, upper body portrait, three-quarter view, looking up, fellatio, {DEPTH}, human male standing"),
    ("above", "in a gym, upper body portrait, from above, looking up, fellatio, {DEPTH}, human male standing"),
    ("bench", "in a gym, upper body portrait, sitting on gym bench, leaning forward, fellatio, {DEPTH}, human male standing"),
    ("hips", "in a gym, upper body portrait, hands on his hips, looking up, fellatio, {DEPTH}, human male standing"),
    ("balls", "in a gym, upper body portrait, paws on his balls, looking up, fellatio, {DEPTH}, human male standing"),
    ("between", "in a gym, upper body portrait, between his legs, looking up, fellatio, {DEPTH}, human male standing"),
    ("close", "in a gym, close portrait, face and muzzle, looking up, fellatio, {DEPTH}, human male standing"),
    ("chest", "in a gym, upper body portrait, face and chest, looking up, fellatio, {DEPTH}, human male standing"),
]

SHOTS = []
seed = 986001
for round_i in range(5):
    for name, tmpl in POSES:
        scene = tmpl.format(DEPTH=DEPTH)
        SHOTS.append((f"{name}_{round_i+1}", scene, seed))
        seed += 1


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


def graph(scene, seed, prefix):
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
    m, c = add_lora(nodes, "5", "ponyxl-deep_penetration-concept-v01.safetensors", DEEPCON, DEEPCON, m, c)
    m, c = add_lora(nodes, "6", "m0d3rn_gym-p.safetensors", GYM, GYM, m, c)
    pos = f"{scene}, {MUZZLE},\n\n{CHAR}"
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
    types = {n["class_type"] for n in nodes.values()}
    for bad in ("VAEEncodeForInpaint", "LoadImage", "SetLatentNoiseMask"):
        if bad in types:
            raise RuntimeError(bad)
    return nodes, pos


def queue(prompt):
    data = json.dumps({"prompt": prompt}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.loads(r.read().decode())
        if body.get("error") or body.get("node_errors"):
            raise RuntimeError(json.dumps(body, ensure_ascii=False)[:2000])
        return body["prompt_id"]


def wait_ids(ids, timeout=1800):
    t0 = time.time()
    pending = set(ids)
    failed = []
    while pending and time.time() - t0 < timeout:
        done = []
        for pid in list(pending):
            with urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=15) as r:
                hist = json.loads(r.read().decode())
            if pid not in hist:
                continue
            item = hist[pid]
            st = (item.get("status") or {}).get("status_str")
            if st == "error":
                failed.append(pid)
                done.append(pid)
                continue
            if item.get("outputs") or st == "success":
                done.append(pid)
        for pid in done:
            pending.discard(pid)
        q = json.loads(urllib.request.urlopen(f"{COMFY}/queue", timeout=15).read().decode())
        print(f"left={len(pending)} failed={len(failed)} queue_run={len(q.get('queue_running') or [])} queue_pend={len(q.get('queue_pending') or [])} elapsed={int(time.time()-t0)}s", flush=True)
        if pending:
            time.sleep(8)
    if pending:
        raise TimeoutError(f"still pending {pending}")
    if failed:
        raise RuntimeError(f"failed {failed}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    ids = []
    for i, (key, scene, seed) in enumerate(SHOTS, start=1):
        prefix = f"{PREFIX_DIR}/dt{i:02d}_{key}"
        nodes, pos = graph(scene, seed, prefix)
        pid = queue(nodes)
        ids.append(pid)
        rec = {"id": i, "shot": key, "seed": seed, "prompt_id": pid, "prompt": pos, "negative": NEG, "steps": STEPS}
        jobs.append(rec)
        (OUT / f"prompt_{key}.txt").write_text(pos, encoding="utf-8")
        print(f"queued {i} {key} {pid}", flush=True)
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    wait_ids(ids, timeout=2400)
    time.sleep(2)
    files = sorted(OUT.glob("dt*.png"))
    print("files", len(files), flush=True)
    for p in files:
        print(p.name, p.stat().st_size, flush=True)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
