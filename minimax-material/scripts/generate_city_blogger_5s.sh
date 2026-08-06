#!/usr/bin/env bash
# MiniMax-H3 cloud I2V — 5 seconds (within H3 4–15s range).
# Requires: MINIMAX_API_KEY saved via `mmx auth login`
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MMX="${MMX:-$(command -v mmx || true)}"
if [[ -z "${MMX}" && -x "$HOME/.local/node_modules/.bin/mmx" ]]; then
  MMX="$HOME/.local/node_modules/.bin/mmx"
fi
if [[ -z "${MMX}" ]]; then
  echo "mmx CLI not found" >&2
  exit 1
fi

FRAME="${1:-$ROOT/frames/first-frame-source.png}"
PROMPT_FILE="${2:-$ROOT/prompts/handstand-city-blogger-5s.txt}"
OUT="${3:-$ROOT/output/tigra-city-blogger-handstand-5s.mp4}"
DURATION="${DURATION:-5}"
RATIO="${RATIO:-9:16}"

if [[ ! -f "$FRAME" ]]; then
  echo "Missing first frame: $FRAME" >&2
  exit 1
fi
PROMPT="$(cat "$PROMPT_FILE")"
mkdir -p "$(dirname "$OUT")"

echo "Auth:"
"$MMX" auth status --output json --quiet || {
  echo "No credentials. On this machine run:" >&2
  echo "  export MINIMAX_API_KEY=sk-..." >&2
  echo "  mmx auth login --api-key \"\$MINIMAX_API_KEY\"" >&2
  exit 1
}

REF_ARGS=()
if [[ -f "$ROOT/frames/tigra_sheet_with_dilator.png" ]]; then
  REF_ARGS+=(--reference-image "$ROOT/frames/tigra_sheet_with_dilator.png")
elif [[ -f "$ROOT/frames/tigra_sheet_anatomy_best.png" ]]; then
  REF_ARGS+=(--reference-image "$ROOT/frames/tigra_sheet_anatomy_best.png")
fi

echo "Frame: $FRAME"
echo "Duration: ${DURATION}s  Ratio: $RATIO"
echo "Out: $OUT"

"$MMX" video generate \
  --model MiniMax-H3 \
  --prompt "$PROMPT" \
  --image "$FRAME" \
  "${REF_ARGS[@]}" \
  --duration "$DURATION" \
  --ratio "$RATIO" \
  --download "$OUT" \
  --poll-interval 10 \
  --timeout 1800 \
  --non-interactive

echo "Done: $OUT"
