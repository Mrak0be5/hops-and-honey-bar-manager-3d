import 'package:flutter/material.dart';

import 'ui/core/app_theme.dart';
import 'ui/game_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HopsHoneyApp());
}

class HopsHoneyApp extends StatelessWidget {
  const HopsHoneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hops & Honey — Flutter 3D',
      debugShowCheckedModeBanner: false,
      theme: buildGameTheme(),
      home: const GameAppHost(),
    );
  }
}
