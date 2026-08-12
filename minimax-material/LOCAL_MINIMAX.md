# Локальный MiniMax / ComfyUI — шпаргалка для агентов

Источник на Desktop ПК:
`C:\Users\hebp\OneDrive\Desktop\rab stol\sulphur-ai\COMFYUI_STABILITYMATRIX_QUICKREF.md`

Полный текст quickref с cloud-VM недоступен; ниже — рабочие правила из `local-paths.md` + skill на этом ПК.

## Правила

1. ComfyUI запускать **только через Stability Matrix** (не `main.py` напрямую).
2. API/UI: `http://127.0.0.1:8188`
3. Публичный доступ (для cloud-агента): `C:\cloudflare\сomfyui_cloudflared_8188.bat` → выдать URL агенту как `COMFY_URL`.
4. Модели: `C:\Users\hebp\AppData\Roaming\StabilityMatrix\Models\...`
5. Workflow H3 I2V: `C:\Users\hebp\OneDrive\Документы\Sorter\civitai-model-recovery\MiniMax_H3_I2V_workflow_saved_20260805.json`

## Генерация 5с (Тигрица, город, стойка)

### A) На ПК (предпочтительно по инструкции)

```powershell
# ComfyUI уже запущен через Stability Matrix
cd C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d
git pull
python minimax-material\scripts\inspect_and_run_city_blogger_5s.py
```

### B) Cloud-агент через Cloudflare tunnel

```powershell
# на ПК после старта ComfyUI:
C:\cloudflare\сomfyui_cloudflared_8188.bat
# скопировать https://….trycloudflare.com в чат агенту
```

```bash
# в cloud-агенте:
export COMFY_URL='https://XXXX.trycloudflare.com'
python minimax-material/scripts/inspect_and_run_city_blogger_5s.py
```

### C) Cloud MiniMax API (не локальный Comfy; нужен ключ)

```bash
export MINIMAX_API_KEY='sk-...'
mmx auth login --api-key "$MINIMAX_API_KEY"
./minimax-material/scripts/generate_city_blogger_5s.sh
```

## Проверка ComfyUI

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8188/system_stats" -TimeoutSec 3
```
