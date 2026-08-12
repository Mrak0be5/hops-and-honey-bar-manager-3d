---
name: grok-imagine
description: "Generate and edit images with Grok Imagine (xAI). Use when the user asks to draw, generate, or edit an image via Grok Imagine / grok-imagine-image-2.0."
---

# Grok Imagine

Prefer live xAI Grok Imagine. Do not invent model IDs.

## Auth

Need one of:

- `XAI_API_KEY` — official xAI API
- `KIE_API_KEY` / existing kie.ai bearer key — Kie proxy
- Cursor MCP `grok-imagine` (`npx -y @runapi.ai/grok-imagine-mcp`) or `grok-image-mcp` (`tools/grok-image-mcp`)

If none are available, stop and ask for a key. Do not pretend generation succeeded.

## Official xAI (best)

Model for Image 2.0: `grok-imagine-image-2.0`

```bash
curl -sS https://api.x.ai/v1/images/generations \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine-image-2.0",
    "prompt": "PROMPT",
    "aspect_ratio": "2:3"
  }'
```

Fallbacks: `grok-imagine-image-quality`, `grok-imagine-image`.

Docs: https://docs.x.ai/developers/model-capabilities/imagine

## Kie.ai proxy

Kie does not expose a separate `grok-imagine-image-2` model id. Use:

- text-to-image: `grok-imagine/text-to-image`
- image-to-image: `grok-imagine/image-to-image`
- Image 2.0 quality mode: `"enable_pro": true`

```bash
curl -sS https://api.kie.ai/api/v1/jobs/createTask \
  -H "Authorization: Bearer $KIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-imagine/text-to-image",
    "input": {
      "prompt": "PROMPT",
      "aspect_ratio": "2:3",
      "enable_pro": true
    }
  }'
```

Poll: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=TASK_ID`

Kie `nsfw_checker: false` only disables Kie's own filter. Upstream Grok Imagine safety still applies.

## MCP in this repo

Configured in `.cursor/mcp.json`:

- `@runapi.ai/grok-imagine-mcp` — needs `RUNAPI_API_KEY`
- `tools/grok-image-mcp` — needs `XAI_API_KEY` (or `GROK_IMAGE_MOCK=1` for fake output)

These load in Cursor Desktop. Cloud agents do not hot-load new MCP servers.

## Rules

- Specify adult characters as adult when generating people.
- Download result images locally before reporting success.
- If the provider returns content-safety failure, report it. Do not jailbreak or retry with evasion prompts.
