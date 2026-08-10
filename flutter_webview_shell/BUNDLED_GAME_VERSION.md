# Зафиксированная HTML5-версия

Оболочка содержит production-билд корневой HTML5/Three.js-игры из чистого
коммита `6a524908a18583a090bc4e812078181bcda9b8cb`.

Сборка выполнена 11 августа 2026 года командой:

```powershell
npm.cmd run build
```

Каталог `dist/client` скопирован в `assets/html5` без изменения файлов:
26 файлов, 8 715 469 байт, расхождений SHA-256 — 0.

Контрольные суммы основных runtime-файлов:

```text
F39272F061052BC37BFE5D52156767E1272DA16061F055F931B92E2E3BFDC9F2  index.html
922EAFDF3BDB0C40CEE32A377F77ED7ABD3177FEC9857146800BEF4BAA179A7E  index-CNzZbiaV.js
08392DDF30E76472FCBDF154A2EEC7115BE97B84927CD97986C2C9704C1CA0AB  index-lqYl2uIa.css
```

Flutter не воспроизводит игровую логику: он только запускает эти файлы на
постоянном loopback-origin `http://127.0.0.1:48763/` внутри системного WebView.
