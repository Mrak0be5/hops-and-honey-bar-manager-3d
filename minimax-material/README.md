# MiniMax material — Tigra handstand 10s

Готовый пакет для image-to-video в MiniMax (Hailuo / MiniMax-H3).

## Скилл

Скачан официальный агент-скилл MiniMax CLI:

- `skill/mmx-cli/` — основной skill (`mmx`)
- `skill/mmx-cli/h3-video/` — skill для MiniMax-H3 (4–15 сек)

Установка CLI на машине:

```bash
npm install -g mmx-cli
# или локально:
npm install --prefix ~/.local mmx-cli
export PATH="$HOME/.local/node_modules/.bin:$PATH"
```

Авторизация (нужен Pay-as-you-go API key с https://platform.minimax.io/ ):

```bash
mmx auth login --api-key "$MINIMAX_API_KEY"
mmx auth status --output json --quiet
```

## Правильный first-frame

MiniMax плохо ест multi-panel reference sheet. Нужен **один персонаж на белом фоне**.

| Файл | Назначение |
|------|------------|
| `frames/first-frame-standing-white.png` | **Основной first-frame** — 1080×1920 (9:16), соло, белый фон, запас сверху под стойку |
| `frames/first-frame-standing-1x1.png` | Квадратный вариант 2048×2048 |
| `frames/first-frame-source.png` | Исходный соло-кадр 2048×2048 |
| `frames/tigra_sheet_anatomy_best.png` | Character sheet (только как identity ref / H3 `--reference-image`, не как first-frame) |

Исходный sheet из вложения (несколько ракурсов + подписи) **нельзя** подавать как first-frame — модель будет путаться. Из него уже выведен соло standing кадр.

## Промпт (10 секунд)

- `prompts/handstand-10s-ru.txt` — полный storyboard для MiniMax-H3
- `prompts/handstand-10s-short.txt` — короткий вариант

Действие: стоит → руки на пол → стойка на руках (ноги вместе) → разводит ноги в шпагат/straddle → hold.

## Генерация

```bash
chmod +x minimax-material/scripts/generate_handstand.sh
./minimax-material/scripts/generate_handstand.sh
```

Или вручную:

```bash
mmx video generate \
  --model MiniMax-H3 \
  --prompt "$(cat minimax-material/prompts/handstand-10s-ru.txt)" \
  --image minimax-material/frames/first-frame-standing-white.png \
  --duration 10 \
  --ratio 9:16 \
  --download minimax-material/output/tigra-handstand-straddle-10s.mp4 \
  --poll-interval 10 \
  --timeout 1800 \
  --non-interactive
```

Альтернатива (legacy Hailuo-02, тоже 10s I2V):

```bash
mmx video generate \
  --model MiniMax-Hailuo-02 \
  --prompt "$(cat minimax-material/prompts/handstand-10s-short.txt)" \
  --image minimax-material/frames/first-frame-standing-white.png \
  --duration 10 \
  --download minimax-material/output/tigra-handstand-hailuo02.mp4 \
  --non-interactive
```

## Статус в этом cloud-агенте

- Скилл скачан, CLI установлен локально (`~/.local/node_modules/.bin/mmx`).
- First-frame и промпты подготовлены.
- **Генерация не запущена:** на этой машине нет MiniMax API key / Google login.
- Hailuo web (hailuoai.video) открывается, но Create требует OAuth.
- Private-worker агент «Minimax анимация стойки» упал в ERROR с пустым transcript — доступ к MiniMax на вашем ПК из этого cloud-рана недоступен.

Чтобы догенерировать: задайте `MINIMAX_API_KEY` в окружении агента / на ПК и перезапустите `scripts/generate_handstand.sh`, либо залогиньтесь в Hailuo и загрузите `first-frame-standing-white.png` + промпт вручную.
