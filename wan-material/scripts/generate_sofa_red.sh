#!/usr/bin/env bash
# Wan 2.7 on kie.ai — Tigra on red sofa (first-frame I2V pipeline).
# Docs: https://docs.kie.ai/market/wan/2-7-image-to-video
#       https://kie.ai/wan-2-7-video
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${KIE_API_KEY:-}${KIE_KEY:-}${KIE_AI_API_KEY:-}" ]]; then
  echo "Set KIE_API_KEY from https://kie.ai/api-key" >&2
  exit 1
fi

MODE="${MODE:-i2v}"  # i2v | i2v-only | r2v
DURATION="${DURATION:-5}"
RESOLUTION="${RESOLUTION:-1080p}"
ASPECT_RATIO="${ASPECT_RATIO:-9:16}"
export MODE DURATION RESOLUTION ASPECT_RATIO

exec python3 "$ROOT/scripts/generate_sofa_red.py" --mode "$MODE" "$@"
