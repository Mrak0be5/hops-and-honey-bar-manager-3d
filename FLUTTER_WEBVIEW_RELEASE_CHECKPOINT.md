# Flutter WebView release checkpoint — 2026-08-11

## Objective

Сохранить HTML5/Three.js-игру без визуального или механического переписывания внутри Flutter Android-оболочки, глубоко проверить игру и устранить найденные ошибки ввода, навигации и доступности.

## Decisions

- Flutter остаётся тонкой нативной оболочкой; игровая логика и 3D-рендер выполняются оригинальным HTML5-бандлом.
- Игра встроена в APK и обслуживается только через loopback-origin `http://127.0.0.1:48763/`, поэтому запуск не зависит от сети.
- Android Back сначала закрывает внутриигровое подтверждение/настройки/развитие, затем использует историю WebView и только после этого выходит.
- Во время открытия Development и подтверждения сброса повторные касания в точке исходной кнопки блокируются. После 3 секунд тишины или касания другой точки обычный ввод снова разрешён.
- Release version: `0.1.1+2`.

## Main changes

- `src/ui/Hud.tsx`, `src/styles.css`, `src/App.tsx` — touch guards, устойчивый focus, Escape/focus trap для Development и Settings.
- `src/ui/upgradeEffects.ts` — корректное русское склонение количества мест.
- `flutter_webview_shell/lib/data/game_browser_commands.dart` и `lib/ui/game_shell/*` — мост Android Back к внутриигровым окнам.
- `flutter_webview_shell/assets/html5/*` — точная копия финального `dist/client`.
- E2E и Flutter regression tests покрывают найденные ошибки.

## Verification

- `npm.cmd test -- --run`: 40/40 PASS.
- `npm.cmd run build`: PASS.
- `flutter test --reporter compact`: 10/10 PASS.
- `dart analyze --fatal-infos`: no issues.
- Playwright desktop focus/Escape: 2/2 PASS.
- Playwright mobile rapid taps/reset double-tap + recovery after quiet period: 2/2 PASS.
- Playwright full progression: PASS; все 6 веток бара и 9 веток комнат куплены до MAX.
- Android 16 / API 36: cold/warm/offline, background/resume, rotation lock, WebGL recovery, сохранение, все комнаты/прокачки и Back hierarchy проверены; новых P0/P1 нет.
- Встроенный HTML5-бандл: 26 файлов, 8 726 741 байт, 0 расхождений SHA-256 с `dist/client`.
- APK: `output/flutter-webview-shell/hops-and-honey-html5-in-flutter-0.1.1.apk`, 47 931 801 байт, SHA-256 `08F7F6F1BDB181291D923D566F9324F5CE287E378535BC87059C9311F808BB35`.
- APK metadata: package `com.hopsandhoney.hops_and_honey_shell`, versionName `0.1.1`, versionCode `2`, minSdk 24, targetSdk 36.
- Финальный APK установлен через `adb install -r`: cold launch 5,434 с, `index-BndV6CVq.js`, WebGL2 и HUD после Start работают; logcat содержит 0 FATAL/ANR/Uncaught/console error.

## Remaining notes

- iOS/WKWebView нельзя реально проверить на этой Windows-машине; для iOS release всё ещё нужен macOS/Xcode device pass.
- Vite сообщает только неблокирующее предупреждение о JS chunk около 1.18 MB; runtime и Android QA ошибок не показали.
- Пользовательский untracked-каталог `.superpowers/` не изменять и не добавлять в коммит.

## Exact next actions

1. Проверить git diff/status без `.superpowers/`.
2. Закоммитить и запушить `codex/restore-pre-remake`.
