# First-frame source

Wan 2.7 I2V uses the **same** solo first-frame as MiniMax:

- Default: `../minimax-material/frames/first-frame-standing-white.png` (1080×1920, pure white)
- Optional identity sheet (NOT as first_frame): `../minimax-material/frames/tigra_sheet_anatomy_best.png`

Rebuild 9:16 headroom frame:

```bash
python3 ../minimax-material/scripts/prepare_first_frame.py
```

Optional: place a custom solo PNG here as `first-frame-standing-white.png` to override the MiniMax default (scripts check this folder first).
