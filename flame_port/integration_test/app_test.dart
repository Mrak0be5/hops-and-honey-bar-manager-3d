import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/main.dart' as app;
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('golden path: start, speed, development and settings', (
    tester,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.clear();

    app.main();
    for (var attempt = 0; attempt < 30; attempt += 1) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.byKey(const Key('start-game')).evaluate().isNotEmpty) break;
    }

    expect(find.byKey(const Key('start-game')), findsOneWidget);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byKey(const Key('speed-button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('speed-button')));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('×2'), findsOneWidget);

    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('development-title')), findsOneWidget);
    expect(find.textContaining('Скорость 2,15 → 2,49 м/с'), findsOneWidget);

    await tester.tap(find.byKey(const Key('development-close')));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byKey(const Key('settings-button')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('sound-setting')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
