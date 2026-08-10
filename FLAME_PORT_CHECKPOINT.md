# Flutter/Flame port checkpoint — 2026-08-10

## Objective

Создать самостоятельную Flutter Web + Flame версию «Хмель & Мёд», сохранить игровой цикл исходной версии, опубликовать отдельным Sites-проектом и проверить production-сборку вручную.

## Result

- Порт находится в `flame_port/`; исходная React/Three.js версия не заменена.
- Чистая Dart-симуляция поддерживает бар, караоке, сауну, массаж, все покупки, числовые эффекты прокачек, сохранение и сброс.
- A* навигация использует сетку препятствий и связанные переходы между баром и комнатами.
- Flame-сцена процедурно рисует четыре соединённые зоны, персонажей, предметы и эффекты.
- Flutter HUD адаптирован под desktop/mobile и имеет отдельный режим предпросмотра 9:16.
- Пауза отсутствует; скорость находится слева сверху; настройки справа сверху; звук и сброс находятся внутри настроек.
- Production Sites URL: `https://hops-and-honey-flame.aimc1.chatgpt.site`.
- Старый Sites-проект `hops-and-honey-3d-bar` не изменён.

## Verification

- `dart analyze --fatal-infos` — PASS.
- `flutter test --reporter compact` — PASS, 23/23.
- Chrome integration test — PASS, 2/2.
- `flutter build web --release --base-href /flame/` — PASS.
- Vinext Sites wrapper — PASS; `dist/server/index.js` и Flutter static assets присутствуют.
- Sites version 1 deployed successfully; anonymous HTTP check returns 200.
- Manual production playtest: start, service loop, development panel, settings, sound UI, room tabs and 9:16 mode verified.
- Representative captures: `output/flame-playtest/published-flame.png`, `published-running-2.png`, `published-development.png`, `published-settings.png`, `published-9x16.png`.

## Future improvements

- Увеличить портретный zoom сцены примерно на 10–15%.
- Добавить итог смены и небольшие управленческие цели без возврата больших quest-карточек.
- Сделать полноценный audio pass: ambience, шаги и музыка вместо только процедурных сигналов.
- Для магазинов приложений добавить Android/iOS platforms и signing; текущая публикация — Flutter Web.
