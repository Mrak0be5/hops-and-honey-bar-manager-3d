import 'package:flutter/material.dart';

import 'config/game_shell_config.dart';
import 'data/game_source_repository.dart';
import 'ui/game_shell/game_shell_screen.dart';

class HopsAndHoneyShellApp extends StatelessWidget {
  const HopsAndHoneyShellApp({super.key, required this.config});

  final GameShellConfig config;

  @override
  Widget build(BuildContext context) {
    final GameSourceRepository source = GameSourceRepository(config: config);

    return MaterialApp(
      title: 'Хмель & Мёд',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFFE99A3D),
        scaffoldBackgroundColor: const Color(0xFF071D22),
      ),
      home: GameShellScreen(source: source),
    );
  }
}

class GameBootstrapErrorApp extends StatelessWidget {
  const GameBootstrapErrorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: const Scaffold(
        backgroundColor: Color(0xFF071D22),
        body: SafeArea(
          minimum: EdgeInsets.all(24),
          child: Center(
            child: Text(
              'Не удалось запустить локальную версию игры. '
              'Полностью закройте приложение и откройте его снова.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18),
            ),
          ),
        ),
      ),
    );
  }
}
