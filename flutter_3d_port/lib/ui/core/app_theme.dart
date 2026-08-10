import 'package:flutter/material.dart';

abstract final class GameColors {
  static const ink = Color(0xFF082F39);
  static const navy = Color(0xFF073F49);
  static const deepNavy = Color(0xFF032832);
  static const teal = Color(0xFF087E82);
  static const mint = Color(0xFF63DFBD);
  static const coral = Color(0xFFEE5C50);
  static const orange = Color(0xFFF59B38);
  static const gold = Color(0xFFFFC64B);
  static const cream = Color(0xFFFFF4D8);
  static const paper = Color(0xFFFFFAF0);
}

ThemeData buildGameTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: GameColors.teal,
    brightness: Brightness.light,
    primary: GameColors.teal,
    secondary: GameColors.orange,
    surface: GameColors.paper,
    error: GameColors.coral,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: GameColors.deepNavy,
    useMaterial3: true,
    fontFamily: 'Arial',
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        fontWeight: FontWeight.w900,
        letterSpacing: -1.3,
      ),
      headlineMedium: TextStyle(
        fontWeight: FontWeight.w900,
        letterSpacing: -0.8,
      ),
      titleLarge: TextStyle(fontWeight: FontWeight.w900),
      titleMedium: TextStyle(fontWeight: FontWeight.w900),
      bodyMedium: TextStyle(fontWeight: FontWeight.w700),
      labelLarge: TextStyle(fontWeight: FontWeight.w900),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        textStyle: const TextStyle(fontWeight: FontWeight.w900),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: GameColors.paper,
        foregroundColor: GameColors.ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      ),
    ),
  );
}
