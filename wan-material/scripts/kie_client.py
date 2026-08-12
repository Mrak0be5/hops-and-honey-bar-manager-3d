#!/usr/bin/env python3
"""Kie.ai client helpers for Wan 2.7 / Seedream uploads and jobs."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API = os.environ.get("KIE_API_BASE", "https://api.kie.ai").rstrip("/")
UPLOAD = os.environ.get(
    "KIE_UPLOAD_BASE", "https://kieai.redpandaai.co"
).rstrip("/")


def api_key() -> str:
    for name in ("KIE_API_KEY", "KIE_KEY", "KIE_AI_API_KEY"):
        v = os.environ.get(name, "").strip()
        if v:
            return v
    raise SystemExit(
        "Missing KIE_API_KEY. Set it from https://kie.ai/api-key "
        "(User env on Windows private worker, or cloud agent secrets)."
    )


def _request(
    method: str,
    url: str,
    *,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {url}: {err}") from e
    if not body:
        return {}
    return json.loads(body)


def upload_file(path: Path, upload_path: str = "wan-2-7/tigra") -> str:
    """Upload local file; return public downloadUrl."""
    path = path.resolve()
    if not path.is_file():
        raise SystemExit(f"Missing file: {path}")
    boundary = "----CursorWanBoundary7MA4YWxkTrZu0gW"
    file_bytes = path.read_bytes()
    filename = path.name
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        )
        parts.append(value.encode())
        parts.append(b"\r\n")

    add_field("uploadPath", upload_path)
    add_field("fileName", filename)
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        (
            f'Content-Disposition: form-data; name="file"; '
            f'filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
    )
    parts.append(file_bytes)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    result = _request(
        "POST",
        f"{UPLOAD}/api/file-stream-upload",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        timeout=180,
    )
    if not result.get("success") and result.get("code") not in (200, None):
        raise SystemExit(f"Upload failed: {json.dumps(result, ensure_ascii=False)}")
    data = result.get("data") or {}
    url = data.get("downloadUrl") or data.get("fileUrl") or data.get("url")
    if not url:
        raise SystemExit(f"Upload response missing URL: {json.dumps(result)}")
    print(f"Uploaded {path.name} -> {url}", file=sys.stderr)
    return url


def create_task(model: str, input_obj: dict[str, Any]) -> str:
    payload = {"model": model, "input": input_obj}
    result = _request(
        "POST",
        f"{API}/api/v1/jobs/createTask",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": "application/json",
        },
    )
    if result.get("code") not in (200, None) and "data" not in result:
        raise SystemExit(f"createTask failed: {json.dumps(result, ensure_ascii=False)}")
    data = result.get("data") or {}
    task_id = data.get("taskId") or data.get("task_id")
    if not task_id:
        raise SystemExit(f"No taskId in response: {json.dumps(result)}")
    print(f"Created task {task_id} model={model}", file=sys.stderr)
    return task_id


def get_task(task_id: str) -> dict[str, Any]:
    q = urllib.parse.urlencode({"taskId": task_id})
    result = _request(
        "GET",
        f"{API}/api/v1/jobs/recordInfo?{q}",
        headers={"Authorization": f"Bearer {api_key()}"},
    )
    return result


def poll_task(
    task_id: str,
    *,
    interval: float = 8.0,
    timeout: float = 1800.0,
) -> dict[str, Any]:
    start = time.time()
    while True:
        result = get_task(task_id)
        data = result.get("data") or {}
        state = (data.get("state") or data.get("status") or "").lower()
        print(f"[{task_id}] state={state or '?'}", file=sys.stderr)
        if state in ("success", "succeed", "succeeded", "completed"):
            return data
        if state in ("fail", "failed", "error", "canceled", "cancelled"):
            raise SystemExit(
                f"Task failed: {json.dumps(data, ensure_ascii=False)[:2000]}"
            )
        if time.time() - start > timeout:
            raise SystemExit(f"Timeout waiting for task {task_id}")
        time.sleep(interval)


def result_urls(task_data: dict[str, Any]) -> list[str]:
    raw = task_data.get("resultJson") or "{}"
    if isinstance(raw, dict):
        obj = raw
    else:
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            obj = {}
    urls = obj.get("resultUrls") or obj.get("result_urls") or []
    if isinstance(urls, str):
        urls = [urls]
    return list(urls)


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())
    print(f"Saved {dest}", file=sys.stderr)
    return dest


def credits() -> dict[str, Any]:
    return _request(
        "GET",
        f"{API}/api/v1/chat/credit",
        headers={"Authorization": f"Bearer {api_key()}"},
    )
