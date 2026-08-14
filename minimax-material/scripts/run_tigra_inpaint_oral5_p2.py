# -*- coding: utf-8 -*-
import json, shutil, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, r"c:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\minimax-material\scripts")
import run_tigra_inpaint_oral5 as m

OUT = m.OUT
INPUT_DIR = m.INPUT_DIR

MASKS = {
    1: (500, 140, 980, 560),
    2: (420, 60, 920, 500),
    3: (380, 220, 1000, 780),
    4: (360, 40, 720, 430),
    5: (40, 60, 520, 500),
}


def main():
    jobs = json.loads((OUT / "prompts.json").read_text(encoding="utf-8")) if (OUT / "prompts.json").exists() else []
    p2 = []
    for i, (key, desc, _box, seed) in enumerate(m.POSES, start=1):
        srcs = sorted(OUT.glob(f"ip{i:02d}_{key}_p1*.png"))
        if not srcs:
            raise FileNotFoundError(key)
        src = srcs[-1]
        img_name = f"tigra_ip{i:02d}_p1.png"
        mask_name = f"tigra_ip{i:02d}_mask.png"
        shutil.copy2(src, INPUT_DIR / img_name)
        box = MASKS[i]
        m.write_mask(box, INPUT_DIR / mask_name)
        shutil.copy2(INPUT_DIR / mask_name, OUT / mask_name)
        prefix = f"{m.PREFIX_DIR}/ip{i:02d}_{key}_p2"
        nodes, pos, neg = m.graph_p2(desc, seed + 21, prefix, img_name, mask_name)
        pid = m.queue(nodes)
        rec = {"id": i, "key": key, "pass": 2, "seed": seed + 21, "prompt_id": pid, "prompt": pos, "negative": neg, "from": src.name, "mask": box}
        p2.append(rec)
        print(f"queued p2 {i} {key} {pid} mask={box}", flush=True)
    jobs = [j for j in jobs if j.get("pass") != 2] + p2
    (OUT / "prompts.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")
    print("waiting p2", flush=True)
    m.wait_queue()
    time.sleep(2)
    files = sorted(OUT.glob("*_p2*.png"))
    print("p2 files", len(files), flush=True)
    for p in files:
        print(p.name, p.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
