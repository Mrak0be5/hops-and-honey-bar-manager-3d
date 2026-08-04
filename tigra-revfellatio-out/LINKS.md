# Tigra reverse fellatio — local SDXL batch

## Installed LoRAs
- `Reverse_Fellatio_LoRa__PonyXL.safetensors` (Civitai model 543154 / PonyXL v603935)
- `Reverse_Fellatio_LoRa__Illustrious.safetensors` (Illustrious v1431472) — installed, not used in final Pony batch
- Character stack from TIGRA BEST: `Anthro_Tiger_Mk_2.safetensors` + `wnw2-sdxl-000002.safetensors`
- Checkpoint: `boleromixPony_v210.safetensors`

## Winning recipe (v3)
| LoRA | strength_model | strength_clip |
|------|----------------|---------------|
| Anthro_Tiger_Mk_2 | 0.55–0.70 | +0.15 |
| wnw2-sdxl-000002 | 0.50–0.65 | same |
| Reverse_Fellatio_LoRa__PonyXL | 0.85–0.95 | same |

Sampler: `dpmpp_2m` / `karras`, steps 45–50, CFG 6.5–7, size 896×1152 (or 1024×1024).

Do **not** stack `hikari_fellatio` with reverse-fellatio — it breaks the pose (v2 failed).

Triggers: `reverse fellatio, upside-down, upside-down fellatio, head back, deepthroat` + white bob / green eyes looking at viewer.

## Best pick
- **BEST → v3e** — https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877288553-a0junfkdt3.png

## Top gallery
- v3e (best) → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877288553-a0junfkdt3.png
- v3b → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877291096-2va9xhi4372.png
- v3f → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877292627-wxxfuyzkc5a.png
- v3c → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877294200-k9qqzd7fr6b.png
- v3a → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877296947-vjousg2ifna.png
- v3d → https://tempfile.redpandaai.co/kieai/1335989/tigra-revfellatio/1785877298509-tvg5xeqtil.png

## Local
`ComfyUI/output/tigra-revfellatio/` and `tigra-revfellatio-out/`
API workflow: `ComfyUI/user/default/workflows/api/tigra_revfellatio_api.json`
