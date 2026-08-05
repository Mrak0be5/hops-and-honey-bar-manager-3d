#!/usr/bin/env bash
# Generate 10s handstand animation with MiniMax-H3 (image-to-video).
# Prerequisites:
#   npm install -g mmx-cli   OR use local: ~/.local/node_modules/.bin/mmx
#   mmx auth login --api-key "$MINIMAX_API_KEY"
#   OR: export MINIMAX_API_KEY=sk-... && mmx config set --key api_key --value "$MINIMAX_API_KEY"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MMX="${MMX:-$(command -v mmx || true)}"
if [[ -z "${MMX}" && -x "$HOME/.local/node_modules/.bin/mmx" ]]; then
  MMX="$HOME/.local/node_modules/.bin/mmx"
fi
if [[ -z "${MMX}" ]]; then
  echo "mmx CLI not found. Install: npm install -g mmx-cli" >&2
  exit 1
fi

FRAME="${1:-$ROOT/frames/first-frame-standing-white.png}"
PROMPT_FILE="${2:-$ROOT/prompts/handstand-10s-ru.txt}"
OUT="${3:-$ROOT/output/tigra-handstand-straddle-10s.mp4}"
DURATION="${DURATION:-10}"
RATIO="${RATIO:-9:16}"

if [[ ! -f "$FRAME" ]]; then
  echo "Missing first frame: $FRAME" >&2
  exit 1
fi
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Missing prompt: $PROMPT_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
PROMPT="$(cat "$PROMPT_FILE")"

echo "Model: MiniMax-H3"
echo "Frame: $FRAME"
echo "Duration: ${DURATION}s  Ratio: $RATIO"
echo "Output: $OUT"
echo "Auth status:"
"$MMX" auth status --output json --quiet || {
  echo "No MiniMax credentials. Run: mmx auth login --api-key sk-..." >&2
  exit 1
}

"$MMX" video generate \
  --model MiniMax-H3 \
  --prompt "$PROMPT" \
  --image "$FRAME" \
  --duration "$DURATION" \
  --ratio "$RATIO" \
  --download "$OUT" \
  --poll-interval 10 \
  --timeout 1800 \
  --non-interactive

echo "Done: $OUT"
