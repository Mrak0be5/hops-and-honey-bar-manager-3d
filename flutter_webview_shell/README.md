# Хмель & Мёд — Flutter WebView shell

Тонкая Android/iOS-оболочка для оригинальной HTML5/Three.js-версии игры.
Игровая сцена, интерфейс, логика, звук и сохранения не переписаны: свежий
production-билд лежит в `assets/html5` и целиком исполняется внутри WebView.
Встроенный loopback-сервер сохраняет корректную работу ES modules и постоянный
origin для `localStorage`; интернет для игры не требуется.

## Локальная проверка

```powershell
C:\Users\hebp\flutter\bin\flutter.bat pub get
C:\Users\hebp\flutter\bin\cache\dart-sdk\bin\dart.exe analyze --fatal-infos
C:\Users\hebp\flutter\bin\flutter.bat test
C:\Users\hebp\flutter\bin\flutter.bat build apk --release
```

Android поддерживается с API 24, iOS — с 13.0. Прогресс хранится WebView в
`localStorage` приложения и не импортируется автоматически из Chrome или
Safari.

Для QA можно временно загрузить внешний стенд без изменения исходников:

```powershell
flutter run --dart-define=GAME_URL=https://example.test
```
