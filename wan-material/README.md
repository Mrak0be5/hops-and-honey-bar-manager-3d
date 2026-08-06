# Wan 2.7 on kie.ai — Tigra material

Пакет для **Wan 2.7** через [kie.ai](https://kie.ai/wan-2-7-video).

## Модели на kie.ai

| Режим | Model ID | Docs |
|-------|----------|------|
| Image → Video (first frame) | `wan/2-7-image-to-video` | https://docs.kie.ai/market/wan/2-7-image-to-video |
| Text → Video | `wan/2-7-text-to-video` | https://docs.kie.ai/market/wan/2-7-text-to-video |
| Reference → Video | `wan/2-7-r2v` | https://docs.kie.ai/market/wan/2-7-r2v |
| First-frame helper | `seedream/5-pro-image-to-image` | https://docs.kie.ai/market/seedream/5-pro-image-to-image |

API: `POST https://api.kie.ai/api/v1/jobs/createTask`  
Upload: `POST https://kieai.redpandaai.co/api/file-stream-upload`  
Poll: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...`  
Auth: `Authorization: Bearer $KIE_API_KEY` ([получить ключ](https://kie.ai/api-key))

Для NSFW в `input` передаём `"nsfw_checker": false`.

## Сцена: красный диван

Тигрица лежит на спине на красном диване, голову свесила с края, рот широко открыт.

Пайплайн по умолчанию (`MODE=i2v`):

1. Upload character sheet → Seedream 5 Pro i2i → **first frame**
2. Wan 2.7 **image-to-video** from that first frame (idle breath / open mouth)

```bash
export KIE_API_KEY='...'   # https://kie.ai/api-key
chmod +x wan-material/scripts/generate_sofa_red.sh
./wan-material/scripts/generate_sofa_red.sh
```

Альтернативы:

```bash
# Только I2V из уже готового кадра
MODE=i2v-only FIRST_FRAME_URL='https://...' ./wan-material/scripts/generate_sofa_red.sh

# Reference-to-video по шиту (без Seedream)
MODE=r2v ./wan-material/scripts/generate_sofa_red.sh
```

Выход:

- `wan-material/output/tigra-sofa-red-first-frame.png` (при MODE=i2v)
- `wan-material/output/tigra-sofa-red-wan27.mp4`

## Кадры

| Файл | Назначение |
|------|------------|
| `frames/tigra_sheet_anatomy_best.png` | Character sheet (identity) |
| `frames/tigra-front-from-sheet.png` | Crop фронта с шита |
| `frames/first-frame-standing-white.png` | Solo standing (другой пайплайн / fallback) |

Промпты: `prompts/sofa-red-*.txt`.

## Ключ в cloud vs Windows

На Windows private worker ключ обычно в User env `KIE_API_KEY` (как в прошлых Seedream-агентах).  
В этом cloud-агенте ключ **не прокинут** — без `KIE_API_KEY` генерация не стартует. Добавьте secret в окружение cloud-агента или запустите скрипт локально / private worker.
