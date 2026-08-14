# Руководство по генерации v4 (Tigra Gym NSFW — Полный фикс внешности и анатомии)

## Главная причина потери внешности Тигрицы в V3

При анализе результатов генерации V3 выявлены 3 ключевых фактора, которые искажали внешность Тигрицы и превращали её в обычную человеческую девушку/аниме-девочку:

1. **Ключевое слово `cheerleader` (Главный деструктор):**
   В промпте V3 использовались `(((cheerleader crop top))), (((cheerleader miniskirt)))`. В модели PonyXL слово `cheerleader` жестко связано с аниме-девушками человеком. Это выжигало морду фурри, навязывало человеческое лицо и даже спавнило посторонних девушек-черлидерш на заднем плане!
   - **Фикс:** Полный отказ от слова `cheerleader`. Возврат к каноничному топу: `(((black sports bra))), (((black crop top))), midriff, (((black choker)))`.

2. **Перегрузка второстепенных LoRA (Suppression of Character LoRA):**
   Веса `m0d3rn_gym-p` (0.6) + `GymEquipmentV2` (0.6) + `Female_Tongue_Mouth` (0.6) заглушали `Anthro_Tiger_Mk_2`.
   - **Фикс:** Снизить веса второстепенных лор до **0.30–0.35**, а веса `Anthro_Tiger_Mk_2` поднять до **Model 0.85 / CLIP 0.95**.

3. **Посторонние персонажи на фоне:**
   - **Фикс:** В негативный промпт обязательно добавить: `(human female:1.5), (2girls:1.5), (other girls:1.5), (extra characters:1.5), (crowd:1.5)`.

---

## Точные веса и параметры стека (Версия 4)

### 1. Стек LoRA и веса

| LoRA | Model | Clip | Применение |
|------|------:|-----:|------------|
| **WtP_Style_-_TTM** | 0.18 | 1.00 | Всегда (стиль) |
| **Anthro_Tiger_Mk_2** | **0.85** | **0.95** | Всегда (Фиксация морды, белого каре и полосок) |
| **BallsDeep-PN-V3.1** | 0.60 (a/v) | 0.35 (oral) | Глубина «по яйца» |
| **ponyxl-deep_penetration-concept** | 0.50 (a/v) | 0.35 (oral) | Доп. deep |
| **doggystyle-ponyxl-lora-nochekaiser** | 0.35 | 0.35 | Только anal doggystyle |
| **sex_from_behind_pony_V1.0** | 0.35 | 0.35 | Только anal doggystyle |
| **facefuck_pony** | 0.20 | 0.30 | Только oral |
| **Female_Tongue_Mouth_and_Teeth_PONY-v2** | 0.35 | 0.35 | Только oral |
| **m0d3rn_gym-p** | **0.30** | **0.30** | Окружение спортзала |

---

## Промпты

### Наряд (OUTFIT)
```
(((black sports bra))), (((black crop top))), bottomless, no panties, bare bottom, midriff, (((black choker)))
```

### Морда и Голова (FACE)
```
(((anthro tiger female face))), (((tiger muzzle))), (((tiger snout))), furry tiger face, NOT human face, animal nose, facial stripes, (((white bob hair))), (((tiger ears))), orange fur, white belly, black stripes, pink nose
```

### Мужчина (MALE)
```
(((human male))), (((1boy))), (((human skin))), (((real human male penis))), (human skin male:1.3), (smooth human skin male:1.3), muscular human male torso, male hands holding her hips, male hips, male thighs, pubic hair, human man body, no tiger male, no furry male
```

### Negative Prompt (BASE_NEG)
```
blue eyes, blur, glow, white glove, glove, bad anatomy, low quality, watermark, text, white tail, white legs, human face, men face, white ass, white butt, neuroslop, melted, extra limbs, fused fingers, deformed, (floating penis:1.4), (disembodied penis:1.4), dildo, butt plug, sex toy, soda can, looking at viewer, looking at camera, eye contact, human girl face, pretty human woman, anime human face, semi-human face, no muzzle, no snout, shallow, tip only, half inserted, long shaft outside, leather jacket, coat, no glasses, pillow on desk, bed, bedroom, mattress, desk, office, floating, standing on nothing, glasses, sunglasses, underwear, panties, male tiger, anthro male, furry male, tiger man, male with fur, male with stripes, male tail, character sheet, reference sheet, turnaround, multiple views, collage, inset, sprite sheet, futa, hermaphrodite, solo, (multiple tails:1.4), (two tails:1.4), (three legs:1.4), (tail merged with penis:1.4), bent barbell, melted metal, broken dumbbell, (cheerleader:1.5), (human female:1.5), (2girls:1.5), (other girls:1.5), (crowd:1.5), (extra characters:1.5), (male tiger:1.5), (furry male:1.5), (striped male:1.5)
```

---

## Результаты контрольного теста (PASS)

В тестовом прогоне (4 кадра с новыми настройками) получено 100% совпадение внешности:
- Вытянутая морда фурри (snout/muzzle) с тигриным носом и ушами.
- Белое короткое каре (white bob hair).
- Оранжевый мех с черными полосами.
- Черный спортивный топ и чокер.
- Отсутствие человеческих черт лица у Тигрицы и отсутствие полос/шерсти у мужчины.
