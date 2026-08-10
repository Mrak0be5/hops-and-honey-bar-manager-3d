import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/scene/scene_contract.dart';
import 'package:hops_and_honey_3d/ui/core/app_theme.dart';
import 'package:hops_and_honey_3d/ui/development/development_panel.dart';
import 'package:hops_and_honey_3d/ui/game_controller.dart';
import 'package:hops_and_honey_3d/ui/game_screen.dart';
import 'package:hops_and_honey_3d/ui/settings/settings_panel.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_scene_renderer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<GameController> pumpGame(
    WidgetTester tester, {
    FakeSceneRenderer? renderer,
    MediaQueryData? mediaQuery,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final controller = await GameController.create();
    final game = GameScreen(
      controller: controller,
      sceneFactory: renderer == null ? FakeSceneRenderer.new : () => renderer,
    );
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGameTheme(),
        home: mediaQuery == null
            ? game
            : MediaQuery(data: mediaQuery, child: game),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('three-d-scene')), findsOneWidget);
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

  testWidgets('raycast room selection opens Development on that room', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final renderer = FakeSceneRenderer(hitTestResult: SceneVenue.karaoke);
    final controller = await pumpGame(tester, renderer: renderer);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump();

    await tester.tap(find.byKey(const Key('venue-3d-surface')));
    expect(renderer.focusedVenue, SceneVenue.karaoke);
    await tester.pump();
    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump();

    expect(find.byKey(const Key('locked-room-karaoke')), findsOneWidget);
    await disposeGame(tester, controller);
  });

  testWidgets('Bar selection clears manual focus back to wide overview', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final renderer = FakeSceneRenderer(hitTestResult: SceneVenue.karaoke);
    final controller = await pumpGame(tester, renderer: renderer);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('venue-3d-surface')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump();

    await tester.tap(find.byKey(const Key('venue-tab-bar')));

    expect(renderer.focusedVenue, SceneVenue.overview);
    await disposeGame(tester, controller);
  });

  testWidgets('compact overlays honor top and bottom view padding', (
    tester,
  ) async {
    const size = Size(390, 844);
    const insets = EdgeInsets.fromLTRB(0, 31, 0, 47);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = await pumpGame(
      tester,
      mediaQuery: const MediaQueryData(
        size: size,
        padding: insets,
        viewPadding: insets,
      ),
    );
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump();

    final developmentRect = tester.getRect(find.byType(DevelopmentPanel));
    expect(developmentRect.top, 35);
    expect(
      developmentRect.bottom,
      lessThanOrEqualTo(size.height - insets.bottom),
    );

    await tester.tap(find.byKey(const Key('development-close')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('settings-button')));
    await tester.pump();

    expect(
      find.ancestor(
        of: find.byType(SettingsPanel),
        matching: find.byType(SafeArea),
      ),
      findsOneWidget,
    );
    final settingsScroll = find.ancestor(
      of: find.byType(SettingsPanel),
      matching: find.byType(SingleChildScrollView),
    );
    final settingsRect = tester.getRect(settingsScroll);
    expect(settingsRect.top, greaterThanOrEqualTo(insets.top));
    expect(settingsRect.bottom, lessThanOrEqualTo(size.height - insets.bottom));
    await disposeGame(tester, controller);
  });

  testWidgets('desktop portrait toggle stays behind open menus', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = await pumpGame(tester);
    await tester.tap(find.byKey(const Key('start-game')));
    await tester.pump();
    expect(find.byKey(const Key('portrait-preview-toggle')), findsOneWidget);

    await tester.tap(find.byKey(const Key('development-button')));
    await tester.pump();
    expect(find.byKey(const Key('portrait-preview-toggle')), findsNothing);
    await tester.tap(find.byKey(const Key('development-close')));
    await tester.pump();
    expect(find.byKey(const Key('portrait-preview-toggle')), findsOneWidget);

    await tester.tap(find.byKey(const Key('settings-button')));
    await tester.pump();
    expect(find.byKey(const Key('portrait-preview-toggle')), findsNothing);
    await disposeGame(tester, controller);
  });
}
