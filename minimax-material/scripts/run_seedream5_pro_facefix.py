import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "tigra-jacko-facefix"
KEY = os.environ["MUAPI_API_KEY"]
BASE = "https://api.muapi.ai/api/v1"
HEADERS = {"x-api-key": KEY, "Content-Type": "application/json"}

POSE = "https://tempfile.redpandaai.co/kieai/1335989/tigra-facefix-jacko/1786669544847-7699skxmrv2.png"
SHEET = "https://tempfile.redpandaai.co/kieai/1335989/tigra-facefix-jacko/1786669542680-pj1rx3088o.png"
FACE = "https://tempfile.redpandaai.co/kieai/1335989/tigra-facefix-jacko/1786669546414-u2c3blgk4cc.png"
IMAGES = [POSE, SHEET, FACE]

PROMPT_A = (ROOT / "prompts" / "tigra-jacko-facefix-a.txt").read_text(encoding="utf-8")
PROMPT_B = (ROOT / "prompts" / "tigra-jacko-facefix-b.txt").read_text(encoding="utf-8")


def submit(name: str, prompt: str) -> str:
    body = {
        "prompt": prompt,
        "images_list": IMAGES,
        "aspect_ratio": "16:9",
        "resolution": "1K",
    }
    r = requests.post(
        f"{BASE}/seedream-5.0-pro-edit",
        headers=HEADERS,
        json=body,
        timeout=60,
    )
    print(name, r.status_code, r.text[:2000])
    r.raise_for_status()
    data = r.json()
    rid = data.get("request_id") or data.get("id") or (data.get("data") or {}).get("request_id")
    if not rid:
        raise RuntimeError(f"no request_id: {data}")
    print(name, "request_id", rid)
    return rid


def poll(name: str, rid: str, timeout: int = 300) -> dict:
    start = time.time()
    while True:
        r = requests.get(
            f"{BASE}/predictions/{rid}/result",
            headers=HEADERS,
            timeout=60,
        )
        print(name, "poll", r.status_code, r.text[:1500])
        r.raise_for_status()
        data = r.json()
        status = (data.get("status") or data.get("state") or "").lower()
        if status in {"completed", "success", "done"}:
            return data
        if status in {"failed", "error", "cancelled"}:
            raise RuntimeError(f"{name} failed: {data}")
        if time.time() - start > timeout:
            raise TimeoutError(f"{name} timeout: {data}")
        time.sleep(8)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, timeout=120, stream=True) as r:
        r.raise_for_status()
        dest.write_bytes(r.content)
    print("saved", dest, dest.stat().st_size)


def main() -> None:
    jobs = [("a", PROMPT_A), ("b", PROMPT_B)]
    ids = {}
    for name, prompt in jobs:
        ids[name] = submit(name, prompt)
    (OUT / "jobs.json").write_text(json.dumps(ids, indent=2), encoding="utf-8")
    results = {}
    for name, rid in ids.items():
        data = poll(name, rid)
        results[name] = data
        outputs = data.get("outputs") or data.get("output") or []
        if isinstance(outputs, str):
            outputs = [outputs]
        if not outputs:
            parsed = data.get("result") or {}
            outputs = parsed.get("outputs") or parsed.get("resultUrls") or []
        if not outputs:
            raise RuntimeError(f"no outputs: {data}")
        url = outputs[0] if isinstance(outputs[0], str) else outputs[0].get("url")
        download(url, OUT / f"facefix-{name}.png")
        (OUT / f"facefix-{name}.json").write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    (OUT / "results.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR", type(e).__name__, e, file=sys.stderr)
        sys.exit(1)
