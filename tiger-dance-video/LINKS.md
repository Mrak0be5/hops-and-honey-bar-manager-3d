# Tiger dance video — PixVerse V6 image-to-video

- reference (NSFW character sheet, original) → https://tempfile.redpandaai.co/kieai/1335989/comic-tigress/1785851950940-y7bb45dmkh.png
- SFW standing ref (Seedream 5 Pro i2i, clothed) → https://tempfile.aiquickdraw.com/seedream5pro/1785852745668-tgqo5y18d5m.png
- FINAL dance video (PixVerse V6 i2v, 5s, 1080p) → https://tempfile.aiquickdraw.com/pixverse-v6/1785852838637-dssukdzp47c.mp4

## Task IDs (kie.ai)
- seedream i2i (SFW ref): eff04bd9f27388075bb0c583e10ae060
- pixverse-v6 i2v (dance): 23455ea3c73966dff6ea367fd9735bad

## Notes
- The original character sheet is explicit (hermaphrodite anatomy) and was rejected by PixVerse moderation ("The uploaded image is not compliant").
- Workflow: generated a SFW clothed standing pose via Seedream 5 Pro i2i (strength 0.5) preserving identity, then animated that with PixVerse V6 image-to-video (5s, 1080p, no audio).
- PixVerse V6 image-to-video does NOT accept `aspect_ratio` (returns 422 "aspect_ratio is not supported"); aspect is derived from the input image (3:4 portrait here).
