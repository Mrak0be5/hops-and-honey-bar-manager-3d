#!/usr/bin/env bash
# Cloud / mmx path: MiniMax-H3 max duration is 15s (not 20).
# For exact 20s use local ComfyUI:
#   python minimax-material/scripts/inspect_and_run_city_blogger_20s.py
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
PROMPT_FILE="${2:-$ROOT/prompts/handstand-city-blogger-15s-h3.txt}"
OUT="${3:-$ROOT/output/tigra-city-blogger-handstand-15s.mp4}"
DURATION="${DURATION:-15}"
RATIO="${RATIO:-9:16}"

PROMPT="$(cat "$PROMPT_FILE")"
mkdir -p "$(dirname "$OUT")"

echo "Auth:"
"$MMX" auth status --output json --quiet || {
  echo "No credentials. Set MINIMAX_API_KEY and: mmx auth login --api-key \"\$MINIMAX_API_KEY\"" >&2
  exit 1
}

REF_ARGS=()
if [[ -f "$ROOT/frames/tigra_sheet_with_dilator.png" ]]; then
  REF_ARGS+=(--reference-image "$ROOT/frames/tigra_sheet_with_dilator.png")
elif [[ -f "$ROOT/frames/tigra_sheet_anatomy_best.png" ]]; then
  REF_ARGS+=(--reference-image "$ROOT/frames/tigra_sheet_anatomy_best.png")
fi

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
echo "Note: H3 API capped at 15s. For 20s run inspect_and_run_city_blogger_20s.py on the PC."
