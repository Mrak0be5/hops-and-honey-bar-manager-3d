# Руководство по генерации v2 (Tigra Gym NSFW - Anal/Oral)

В данном руководстве зафиксированы оптимальные настройки, LoRA и веса для стабильной генерации качественных изображений с фурри-тигрицей в спортзале, избегая типичных дефектов (человеческое лицо при оральном сексе, слияние тренажеров с кроватями, сломанная анатомия при глубоком проникновении, и искривление пространства на тренажерах).

## 1. Базовый сетап (Модель и Основные LoRA)
- **Checkpoint:** `boleromixPony_v210.safetensors`
- **Tigra Base:** 
  - `WtP_Style_-_TTM.safetensors` (Weight: 0.18)
  - `Anthro_Tiger_Mk_2.safetensors` (Weight: 0.72-0.88, для орала CLIP повышается до 1.0)
- **Окружение (Gym):** 
  - `m0d3rn_gym-p.safetensors` (Weight: 0.6)
  - `GymEquipmentV2.safetensors` (Weight: 0.6)
  - Веса этих лор повышены для лучшего сохранения геометрии штанги и скамьи.

## 2. Корректировка орального секса (Исправление морды)
**Проблема:** При сильном контакте (deepthroat) модель навязывает человеческое лицо из-за доминирования аниме-датасетов. Некорректные позы (вроде doggystyle для орала) ломают шею.
**Решение:** 
- Уменьшить вес `facefuck_pony` (0.25 Model / 0.40 CLIP).
- Подключить `Female_Tongue_Mouth_and_Teeth_-_PONY-v2.safetensors` (0.60 / 0.60).
- **Ракурс:** Принудительно задать `(side view of face:1.2)` или `(profile view:1.3)`.
- **Исключить Doggystyle:** Орал должен выполняться только в позах kneeling, sitting, lying_back или standing_oral.

## 3. Корректировка анального секса (Взаимодействие со средой)
**Проблема:** Дефолтные позы тянут фон спальни (кровати). А при сексе на жимовой скамье модель пытается "пробить" скамью членом.
**Решение:**
- Использовать `doggystyle-ponyxl-lora-nochekaiser` и `sex_from_behind_pony_V1.0` **только** для поз стоя или на четвереньках. Для скамьи эти лоры отключаются!
- **Жим лежа (Bench Press):** Обязательно использовать модификаторы миссионерской позы: `(missionary position:1.3), lying on back on weightlifting bench, raised legs, spread legs, feet in air, human male standing between legs`. Это позволяет избежать искривления пространства.
- **Negative:** Обязательный блок `bed, bedroom, mattress, desk, office, floating, standing on nothing`.

## 4. Специфика поз (Позиционные словари скрипта v2)

### Только для Anal:
1. **Bench Press:** `(missionary position:1.3), lying on back on weightlifting bench, raised legs, spread legs, feet in air, human male standing between legs, (straight metal barbell, perfect geometry)`
2. **Doggystyle:** `doggystyle, bent over, from behind, all fours on gym mat`
3. **Squatting:** `deep squatting on gym mat, spread legs, animal crouch, riding`
4. **Cowgirl:** `straddling, cowgirl position, sitting on lap, riding cock, male lying down on gym mat`
5. **Standing:** `standing sex, bent over forward, leaning against squat rack, from behind`
6. **Dumbbell Press:** `(missionary position:1.3), sitting on gym bench leaning back, spread legs, holding dumbbells, raised legs`

### Только для Oral:
1. **Kneeling:** `kneeling on gym floor, looking up, hands on his thighs, (side view of face:1.2)`
2. **Sitting on Bench:** `sitting on gym bench, leaning forward, (profile view of face:1.3)`
3. **Lying Back:** `lying on back on gym mat, looking up at him, (side view of face:1.2)`
4. **Standing Oral:** `standing, bending knees slightly, holding dumbbells, (profile view of face:1.3)`

## 5. Исправление общих дефектов анатомии
- **Фикс партнера:** Добавить `(muscular human man visible:1.2), male torso, male hands holding her hips` в позитивный промпт. В негативный: `(floating penis:1.4), (disembodied penis:1.4)`.
- **Фикс хвоста:** `(single tiger tail:1.3)` (в позитив), `(multiple tails:1.4), (two tails:1.4), (tail merged with penis:1.4)` (в негатив).

## 6. Настройки генерации
- **Steps:** 100
- **CFG Scale:** 6.5
- **Sampler:** `dpmpp_3m_sde_gpu`
- **Scheduler:** `karras`
- **Разрешение:** 1024x1024
