# Hops & Honey — Flutter 3D

Полностью трёхмерный порт менеджера бара на Flutter без Flame. Рендеринг
выполняет `flutter_scene`: процедурные PBR-модели, перспективная камера,
динамический свет и тени. Экономика, A* навигация, сохранения и адаптивный HUD
остаются чистыми Dart/Flutter слоями.

Проект использует закреплённый `flutter_scene 0.20.0` и отдельный Flutter master
SDK, потому что Flutter GPU ещё не входит в stable channel. Проверенная ревизия
SDK: Flutter `3.47.0-0.4.pre`, commit `467ec59b25`, Dart
`3.14.0-110.0.dev`.

```powershell
C:\Users\hebp\flutter_master\bin\flutter.bat pub get
C:\Users\hebp\flutter_master\bin\flutter.bat run -d chrome
C:\Users\hebp\flutter_master\bin\flutter.bat test
C:\Users\hebp\flutter_master\bin\flutter.bat build web --release
```

Web-релиз создаётся в `build/web`.
