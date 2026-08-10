# Зафиксированная HTML5-версия

Оболочка содержит production-билд корневой HTML5/Three.js-игры из исходников,
зафиксированных в том же Git-коммите, что и этот bundle. Базовая версия порта —
`6a524908a18583a090bc4e812078181bcda9b8cb`; текущий bundle также включает
проверенные исправления touch-ввода, клавиатурной навигации и Android Back.

Сборка выполнена 11 августа 2026 года командой:

```powershell
npm.cmd run build
```

Каталог `dist/client` скопирован в `assets/html5` без изменения файлов:
26 файлов, 8 726 741 байт, расхождений SHA-256 — 0.

Контрольные суммы основных runtime-файлов:

```text
9709B6BF8DBD7FFB7C2B6ECE986D4F68DBA559BB89ABA54DD8125280393737B4  index.html
BE9FF233FED15CF2EA5C24657969D5314D2C19E3E22900B3D12C30E3255AE7C5  index-BndV6CVq.js
3CBB04DAD1CB043B25D476FE6B9D162DFEC7E0982AC31AB3048491682B03CD6B  index-KbAqMJwJ.css
```

Flutter не воспроизводит игровую логику: он только запускает эти файлы на
постоянном loopback-origin `http://127.0.0.1:48763/` внутри системного WebView.
