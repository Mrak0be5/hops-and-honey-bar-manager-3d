import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'config/game_shell_config.dart';
import 'data/bundled_game_server.dart';

BundledGameServer? _gameServer;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(const <DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  try {
    const String overrideUrl = String.fromEnvironment('GAME_URL');
    final Uri gameUri;
    if (overrideUrl.isNotEmpty) {
      gameUri = Uri.parse(overrideUrl);
    } else {
      _gameServer = BundledGameServer(assetPrefix: 'assets/html5', port: 48763);
      gameUri = await _gameServer!.start();
    }
    runApp(HopsAndHoneyShellApp(config: GameShellConfig(gameUri: gameUri)));
  } on Object catch (error, stackTrace) {
    debugPrint('Unable to start the bundled HTML5 game: $error');
    debugPrintStack(stackTrace: stackTrace);
    runApp(const GameBootstrapErrorApp());
  }
}
