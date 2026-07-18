# Project checkpoint — 2026-07-18

## Objective

Сделать законченный первый playable HTML5-менеджер бара с изометрической 3D-графикой, автоматическим циклом посетителей и бармена, системой улучшений, сохранением и адаптивным интерфейсом.

## Decisions

- Отдельный проект: `C:\Users\hebp\OneDrive\Документы\Sorter\bar-manager-3d`.
- Стек: React + TypeScript + Vite + Three.js / React Three Fiber / Drei.
- Камера фиксированная ортографическая; low-poly окружение и персонажи строятся процедурно.
- Симуляция отделена от React и тестируется детерминированно.
- Все растровые UI-иконки сделаны встроенным GPT Image 2 одним согласованным атласом и нарезаны в WebP.
- Долговременный прогресс хранится в `localStorage`; transient-состояние смены не сохраняется.

## Implemented

- Полный цикл гостя: вход → ожидание → заказ → ожидание напитка → питьё → оплата → счастливый уход.
- Полный цикл бармена: путь к гостю → заказ → стойка → приготовление → подача → оплата → уборка кружки → мойка.
- Эмодзи-индикаторы всех состояний над гостями и барменом.
- Шесть столов, занятость, грязная посуда, очередь задач.
- Улучшения движения, заказа, приготовления, уборки, ассортимента и рекламы.
- Пять напитков с растущей ценой; две валюты; дневной бонус; ускорение, пауза, звук, reset.
- Адаптивный HUD и панель улучшений для desktop/mobile.
- WebGL fallback, автопауза при скрытии вкладки, локальное сохранение.

## Key files

- `src/game/GameEngine.ts` — симуляция и persistence.
- `src/components/BarScene.tsx` — WebGL-сцена и камера.
- `src/components/Character.tsx` — персонажи, анимация и emoji-state.
- `src/components/Environment.tsx` — интерьер бара.
- `src/ui/Hud.tsx` — HUD и улучшения.
- `art-source/bar-icon-atlas-source.png` — исходный GPT Image 2 atlas.
- `public/assets/ui/*.webp` — игровые иконки.
- `tests/game-engine.test.ts`, `tests/e2e/*.spec.ts` — проверки.

## Verification

- `npm.cmd test` — PASS, 4/4 симуляционных теста.
- `npm.cmd run build` — PASS, TypeScript и production Vite build.
- `npm.cmd run test:e2e` — PASS, 12/12 Playwright-тестов на desktop/mobile, включая keyboard focus, мобильный звук и landscape welcome.
- WebGL framebuffer визуально проверен на desktop/mobile; representative captures сохранены в `output/playwright`.
- `npm audit` после установки зависимостей: 0 vulnerabilities.
- Независимый code review завершён; найденные UX-замечания по скрытым focusable-кнопкам, мобильному звуку и landscape-компоновке исправлены и покрыты тестами.

## Unresolved / exact next actions

- Критических незавершённых задач нет.
- Неблокирующее предупреждение сборки: основной JS chunk около 1.09 MB (301 KB gzip). При дальнейшем росте проекта следующий шаг — lazy-load 3D runtime или разделить vendor chunks.
- Опционально: добавить новые помещения, второго сотрудника, больше напитков и отдельный tutorial.
