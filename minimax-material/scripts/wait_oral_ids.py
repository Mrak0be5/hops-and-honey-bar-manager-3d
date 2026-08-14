# -*- coding: utf-8 -*-
import json, time, urllib.request

IDS = [
    "17dfa0e4-731a-4a74-a050-9932f345cf50",
    "03a83b1f-088f-4f74-ab6e-e6ad22ad3948",
    "f477a9eb-d3c7-45df-9ecf-24420371b412",
    "583f2083-6419-4f38-ad8d-441f9eff774d",
    "5eea5f54-bfe5-4265-93da-f97c3bd9e370",
]
pending = set(IDS)
failed = []
t0 = time.time()
while pending and time.time() - t0 < 900:
    done = []
    for pid in list(pending):
        hist = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/history/" + pid, timeout=15).read())
        if pid not in hist:
            continue
        st = (hist[pid].get("status") or {}).get("status_str")
        if st == "error":
            failed.append(pid)
            done.append(pid)
            continue
        if hist[pid].get("outputs") or st == "success":
            done.append(pid)
    for pid in done:
        pending.discard(pid)
    q = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/queue", timeout=15).read())
    print(
        "left=%s failed=%s run=%s pend=%s t=%ss"
        % (
            len(pending),
            len(failed),
            len(q.get("queue_running") or []),
            len(q.get("queue_pending") or []),
            int(time.time() - t0),
        ),
        flush=True,
    )
    if pending:
        time.sleep(10)
print("DONE failed", failed, "pending", list(pending), flush=True)
if failed or pending:
    raise SystemExit(1)
