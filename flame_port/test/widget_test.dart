import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/ui/core/app_theme.dart';
import 'package:hops_and_honey_flame/ui/game_controller.dart';
import 'package:hops_and_honey_flame/ui/game_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<GameController> pumpGame(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = await GameController.create();
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGameTheme(),
        home: GameScreen(controller: controller),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    return controller;
  }

  Future<void> disposeGame(
    WidgetTester tester,
    GameController controller,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
    await tester.pump();
  }

  testWidgets('start, speed and exact development values work', (tester) async {
    final controller = await pumpGame(tester);

    expect(find.byKey(const Key('start-game')), findsOneWidget);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump(const Duration(milliseconds: 150));

    expect(find.byKey(const Key('speed-button')), findsOneWidget);
    expect(find.text('×1'), findsOneWidget);
    await tester.tap(find.byKey(const Key('speed-button')));
    await tester.pump();
    expect(find.text('×2'), findsOneWidget);

    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('development-title')), findsOneWidget);
    expect(find.textContaining('Скорость 2,15 → 2,49 м/с'), findsOneWidget);
    expect(find.byKey(const Key('bar-upgrade-moveSpeed')), findsOneWidget);
    await disposeGame(tester, controller);
  });

  testWidgets('settings owns sound and in-game reset confirmation', (
    tester,
  ) async {
    final controller = await pumpGame(tester);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.byKey(const Key('settings-button')));
    await tester.pump(const Duration(milliseconds: 150));
    expect(find.byKey(const Key('settings-title')), findsOneWidget);
    expect(find.byKey(const Key('sound-setting')), findsOneWidget);

    await tester.tap(find.byType(Switch).first);
    await tester.pump();
    expect(controller.soundEnabled, isFalse);

    await tester.tap(find.byKey(const Key('reset-progress')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('confirm-reset')), findsOneWidget);
    await tester.tap(find.byKey(const Key('confirm-reset')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('start-game')), findsOneWidget);
    expect(controller.snapshot.started, isFalse);
    await disposeGame(tester, controller);
  });

  testWidgets('portrait development panel scrolls without overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final controller = await pumpGame(tester);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.byKey(const Key('bar-upgrade-list')), findsOneWidget);
    for (final venue in ['bar', 'karaoke', 'sauna', 'massage']) {
      final tab = find.byKey(Key('venue-tab-$venue'));
      expect(tab, findsOneWidget);
      final bounds = tester.getRect(tab);
      expect(bounds.left, greaterThanOrEqualTo(0));
      expect(bounds.right, lessThanOrEqualTo(390));
    }
    await tester.ensureVisible(
      find.byKey(const Key('bar-upgrade-advertising')),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byKey(const Key('bar-upgrade-advertising')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await disposeGame(tester, controller);
  });
}
