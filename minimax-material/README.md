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

### Вариант: блогер + стойка + close-up (18+)

- `prompts/handstand-blogger-closeup-10s.txt` — полный storyboard
- `prompts/handstand-blogger-closeup-short.txt` — короткий вариант
- `scripts/generate_blogger_closeup.sh` — генерация этого варианта

Действие: лицом к камере (блогер) → поворот спиной → руки на пол → стойка жопой к камере → реплика «Полюбуйтесь моей жопой» → разводит ноги → зум камеры к анусу.

```bash
chmod +x minimax-material/scripts/generate_blogger_closeup.sh
./minimax-material/scripts/generate_blogger_closeup.sh
```

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
- **Генерация не запущена:** у cloud-агента нет доступа к вашему Windows-диску и нет MiniMax MCP.
- У desktop Cursor MiniMax обычно лежит в `C:\Users\<you>\.cursor\mcp.json` (сервер `MiniMax` / `uvx minimax-mcp` + `MINIMAX_API_KEY`). Этот файл **не монтируется** в cloud-ран.
- Private-worker агенты («Minimax анимация стойки», «Minimax анимация скилла») падали в ERROR с пустым transcript — конфиг с ПК оттуда тоже не восстановить.

### Как достать уже установленный MiniMax с ПК

На Windows (PowerShell в репо):

```powershell
powershell -ExecutionPolicy Bypass -File minimax-material/scripts/find_and_generate.ps1
```

Скрипт читает и маскирует ключи из:

- `%USERPROFILE%\.cursor\mcp.json`
- `%USERPROFILE%\.mmx\config.json`
- User/Machine env `MINIMAX_API_KEY`
- MiniMax Hub / `uvx` / `mmx` на PATH

Потом:

```powershell
mmx auth login --api-key $env:MINIMAX_API_KEY
bash minimax-material/scripts/generate_handstand.sh
```

Либо перезапустите задачу как **private worker / local agent** (он видит ваш `mcp.json`), либо вставьте `MINIMAX_API_KEY` в secrets окружения cloud-агента.
