# Amber Club v2 — план реализации

Основание: `docs/superpowers/specs/2026-08-03-amber-club-v2-design.md`

## Принцип поставки

Новая игра строится рядом с v1. На ветке v2 новый runtime включается по умолчанию, а `?legacy=1` оставляет прежнюю игру доступной для сравнения. В production ничего не переключается до завершения критериев из спецификации.

Каждый этап заканчивается компилируемым build, автоматическими тестами и коротким ручным сценарием.

## Этап 1 — вертикальный срез

Цель: воспроизводимый путь `вход → бар → оплата → решение → караоке → выход` в новом здании.

### 1.1 Контент и уровень

Файлы:

- `src/v2/content/rooms.ts`
- `src/v2/level/venueBlueprint.ts`

Работа:

- описать комнаты через данные, без ветвления движка по конкретным ID;
- описать footprint здания, стен, мебели, порталы, очереди и interaction slots;
- добавить преобразование world ↔ cell;
- добавить build-time validation пересечений, порталов и недостижимых слотов.

Проверка:

- blueprint валиден;
- размеры главного бара и трёх крыльев соответствуют спецификации;
- каждый портал связывает две walkable-области.

### 1.2 Навигация

Файлы:

- `src/v2/navigation/NavGrid.ts`
- `src/v2/navigation/findPath.ts`
- `src/v2/navigation/CellReservations.ts`

Работа:

- bake bitset-сетки из VenueBlueprint;
- A* с binary heap и octile heuristic;
- clearance, запрет corner cutting и goal reservation policy;
- временные резервации клеток;
- диагностический маршрут и причина blocked.

Проверка:

- пути обходят все footprints;
- диагональ не проходит через угол;
- два агента не резервируют одну клетку;
- портал бара → караоке достижим.

### 1.3 Детерминированная симуляция

Файлы:

- `src/v2/simulation/SeededRandom.ts`
- `src/v2/simulation/Ledger.ts`
- `src/v2/simulation/types.ts`
- `src/v2/simulation/AmberClubSimulation.ts`

Работа:

- fixed tick 25 Hz и seeded RNG;
- последовательные guest/staff/navigation/service/room/economy systems;
- целочисленный ledger;
- состояния бара и караоке;
- запрет room decision до `barVisit.completed`;
- снимки для UI/render без мутации симуляции.

Проверка:

- одинаковый seed создаёт одинаковый state hash;
- guest никогда не входит в комнату до оплаты бара;
- деньги изменяются только ledger-транзакциями;
- заблокированный путь вызывает retry, не teleport.

### 1.4 Представление и интеграция

Файлы:

- `src/v2/view/model.ts`
- `src/v2/runtime/useAmberSimulation.ts`
- `src/v2/AppV2.tsx`
- `src/LegacyApp.tsx`
- `src/App.tsx`

Работа:

- адаптировать simulation snapshot в стабильную view-модель;
- обновлять симуляцию независимо от R3F Canvas;
- интерполировать координаты в render loop;
- оставить legacy fallback через query parameter;
- добавить test bridge только в dev/test.

Проверка:

- React не получает полный mutable world;
- Canvas не управляет временем симуляции;
- pause/speed/visibility работают;
- legacy и v2 запускаются независимо.

### 1.5 Новый Amber-зал

Файлы:

- `src/v2/render/AmberScene.tsx`
- `src/v2/render/AmberVenue.tsx`
- `src/v2/render/AmberCharacter.tsx`
- `src/v2/render/AmberEffects.tsx`
- `src/v2/render/materials.ts`

Работа:

- единое здание с центральным баром и крупными крыльями;
- stylized PBR материалы и зональное освещение;
- cutaway ближайших стен;
- камера общего плана и фокуса помещений;
- процедурный вертикальный rig с понятными состояниями;
- локальные event-driven VFX.

Проверка:

- интерактивные объекты не перекрыты стенами;
- двери совпадают с порталами;
- персонаж визуально следует авторитетному пути;
- нет постоянного чтения/записи DOM в `useFrame`.

### 1.6 HUD v2

Файлы:

- `src/v2/ui/AmberHud.tsx`
- `src/v2/ui/RoomRail.tsx`
- `src/v2/ui/DevelopmentDrawer.tsx`
- `src/v2/ui/amber-ui.css`

Работа:

- компактная верхняя панель;
- rail помещений;
- drawer ремонта, найма и улучшений;
- responsive bottom sheet на mobile;
- точные эффекты и payback на карточках.

Проверка:

- центральные 60% кадра свободны;
- touch targets ≥48 px;
- интерфейс работает от 320×568 до 2560×1440;
- состояние комнаты понятно без открытия drawer.

## Этап 2 — полный lifecycle помещений

- добавить разрешение, ремонт, оснащение и запуск;
- добавить назначаемый персонал и зарплаты;
- реализовать sauna/massage sessions;
- реализовать три upgrade tracks и визуальные уровни;
- добавить room utility, очереди и capacity;
- проверить баланс headless-прогонами.

## Этап 3 — производственный 3D и анимации

- заменить временные модели на общий оптимизированный asset pipeline;
- добавить полный набор animation states и sockets;
- синхронизировать animation events с симуляцией;
- instancing, LOD и lazy loading комнат;
- добавить quality presets и reduced motion.

## Этап 4 — экономика, saves и полный UI

- ledger всех доходов и расходов;
- prestige XP вместо расходуемой репутации;
- реклама за деньги;
- save schema v2, backup и idempotent migration v1;
- onboarding, milestones, отчёт смены и прогноз окупаемости.

## Этап 5 — эффекты и звук

- общий пул VFX;
- уникальные эффекты оплаты, ремонта и комнат;
- event-driven audio с rate limiting;
- ACES, AO и ограниченный emissive bloom;
- мобильные лимиты частиц.

## Этап 6 — проверка и публикация

- unit/property-like tests;
- 500–1000 seeded смен;
- 20 000 маршрутов;
- E2E desktop/mobile;
- pixel-diff screenshots;
- performance budgets;
- ручной плейтест;
- preview deployment и проверка iframe;
- после успеха — production deployment, commit и push.

## Команды проверки

```powershell
npm test
npm run build
npm run test:e2e
```

Специализированные long-run тесты будут добавлены отдельными npm scripts после появления test bridge.
