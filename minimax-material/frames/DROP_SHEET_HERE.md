# Куда положить шит с расширителем

Chat-вложения **не попадают** на диск cloud-агента. Чтобы нарезать панели и скормить H3 `--reference-image`, сохраните PNG шита сюда:

```text
minimax-material/frames/tigra_sheet_with_dilator.png
```

Ожидаемый шит (как в сообщении):
- верх: Вид спереди / Вид сзади / Вид сбоку
- низ: Голова / Лапы / **Анус с расширителем** (прозрачный dilator)

После дропа:

```bash
# только как identity/ref (НЕ как first-frame)
cp minimax-material/frames/tigra_sheet_with_dilator.png \
   minimax-material/frames/tigra_sheet_anatomy_best.png

# first-frame — только СОЛО. Если есть отдельный standing PNG:
python3 minimax-material/scripts/prepare_first_frame.py path/to/solo-standing.png

# если соло нет — грубый crop передней панели (хуже, чем настоящий solo):
python3 minimax-material/scripts/prepare_first_frame.py \
  minimax-material/frames/tigra_sheet_with_dilator.png --sheet
```

Текущий рабочий first-frame для I2V (уже подготовлен):
`first-frame-standing-white.png` — 1080×1920, белый фон, ~42% headroom под стойку.
