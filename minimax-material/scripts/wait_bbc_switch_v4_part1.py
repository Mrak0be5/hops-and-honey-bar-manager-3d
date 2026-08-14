import json
import sys
import time
import urllib.request

pid = sys.argv[1]
url = f"http://127.0.0.1:8188/history/{pid}"
t0 = time.time()
while time.time() - t0 < 3600:
    try:
        q = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/queue", timeout=30).read())
        running = any(item[1] == pid for item in q.get("queue_running", []))
        pending = any(item[1] == pid for item in q.get("queue_pending", []))
        elapsed = int(time.time() - t0)
        print(f"elapsed={elapsed}s running={running} pending={pending}", flush=True)
        data = json.loads(urllib.request.urlopen(url, timeout=30).read())
        if pid in data:
            st = data[pid].get("status", {})
            print("status", st.get("status_str"), "completed", st.get("completed"), flush=True)
            if st.get("status_str") in ("error", "failed") or (
                st.get("completed") and st.get("status_str") != "success"
            ):
                print("JOB_FAILED", flush=True)
                sys.exit(1)
            if st.get("completed") or st.get("status_str") == "success":
                print("JOB_DONE", flush=True)
                sys.exit(0)
    except Exception as e:
        print("poll_err", e, flush=True)
    time.sleep(20)
print("JOB_TIMEOUT", flush=True)
sys.exit(2)
