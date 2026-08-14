# -*- coding: utf-8 -*-
import json, time, urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
OUT = Path(r"C:\Users\hebp\AppData\Roaming\StabilityMatrix\Images\Text2Img\Tigra_2026\dt_compare")
jobs = json.loads((OUT / "prompts.json").read_text(encoding="utf-8"))
ids = [j["prompt_id"] for j in jobs]
print("watching", len(ids), "jobs", flush=True)
t0 = time.time()
pending = set(ids)
failed = []
while pending and time.time() - t0 < 7200:
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
    nrun = len(q.get("queue_running") or [])
    npend = len(q.get("queue_pending") or [])
    print(f"left={len(pending)} failed={len(failed)} queue_run={nrun} queue_pend={npend} elapsed={int(time.time()-t0)}s", flush=True)
    if pending:
        time.sleep(20)
files = sorted(OUT.rglob("*.png"))
print("files", len(files), flush=True)
for p in files:
    print(p.relative_to(OUT), p.stat().st_size, flush=True)
if failed:
    print("FAILED", failed, flush=True)
    raise SystemExit(1)
print("ALL DONE", flush=True)
