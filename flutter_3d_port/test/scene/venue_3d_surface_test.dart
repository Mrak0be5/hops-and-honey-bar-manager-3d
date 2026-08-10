import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/domain/bar_simulation.dart';
import 'package:hops_and_honey_3d/scene/venue_3d_controller.dart';
import 'package:hops_and_honey_3d/scene/venue_3d_surface.dart';

import '../support/fake_scene_renderer.dart';

void main() {
  testWidgets('renderer ticker updates simulation exactly once per frame', (
    tester,
  ) async {
    final simulation = _CountingSimulation();
    final renderer = FakeSceneRenderer();
    final controller = Venue3DController(
      simulation: simulation,
      sceneFactory: () => renderer,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox(
            width: 390,
            height: 560,
            child: Venue3DSurface(controller: controller),
          ),
        ),
      ),
    );
    final before = simulation.updateCalls;

    renderer.emitFrame(const Duration(milliseconds: 16), 0.016);
    expect(simulation.updateCalls, before + 1);
    renderer.emitFrame(const Duration(milliseconds: 32), 0.016);
    expect(simulation.updateCalls, before + 2);
    expect(find.byKey(const Key('venue-3d-surface')), findsOneWidget);
    expect(renderer.viewport, const Size(390, 560));

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
    expect(renderer.disposed, isTrue);
  });

  testWidgets('animation frames do not rebuild the renderer widget subtree', (
    tester,
  ) async {
    final renderer = FakeSceneRenderer();
    final controller = Venue3DController(
      simulation: BarSimulation(),
      sceneFactory: () => renderer,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: SizedBox.expand(child: Venue3DSurface(controller: controller)),
      ),
    );
    final buildsAfterLayout = renderer.buildCount;

    renderer.emitFrame(const Duration(milliseconds: 16), 0.016);
    await tester.pump(const Duration(milliseconds: 16));
    renderer.emitFrame(const Duration(milliseconds: 32), 0.016);
    await tester.pump(const Duration(milliseconds: 16));
    renderer.emitFrame(const Duration(milliseconds: 48), 0.016);
    await tester.pump(const Duration(milliseconds: 16));

    expect(renderer.buildCount, buildsAfterLayout);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('shows a bounded diagnostic for unbounded constraints', (
    tester,
  ) async {
    final controller = Venue3DController(
      simulation: BarSimulation(),
      sceneFactory: FakeSceneRenderer.new,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Row(children: [Venue3DSurface(controller: controller)]),
      ),
    );

    expect(find.byKey(const Key('venue-3d-unbounded-error')), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('contains renderer construction errors and offers retry', (
    tester,
  ) async {
    final controller = Venue3DController(
      simulation: BarSimulation(),
      sceneFactory: () => throw StateError('GPU unavailable'),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: SizedBox(
          width: 390,
          height: 700,
          child: Venue3DSurface(controller: controller),
        ),
      ),
    );

    expect(find.byKey(const Key('venue-3d-render-error')), findsOneWidget);
    expect(find.text('Повторить'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('delegates a raycast selection synchronously to its owner', (
    tester,
  ) async {
    final renderer = FakeSceneRenderer(hitTestResult: SceneVenue.karaoke);
    final controller = Venue3DController(
      simulation: BarSimulation(),
      sceneFactory: () => renderer,
    );
    SceneVenue? selectedVenue;
    await tester.pumpWidget(
      MaterialApp(
        home: SizedBox(
          width: 390,
          height: 700,
          child: Venue3DSurface(
            controller: controller,
            onVenueSelected: (venue) {
              selectedVenue = venue;
              controller.setFocus(venue);
            },
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('venue-3d-surface')));

    expect(selectedVenue, SceneVenue.karaoke);
    expect(controller.focus, SceneVenue.karaoke);
    expect(renderer.focusedVenue, SceneVenue.karaoke);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}

class _CountingSimulation extends BarSimulation {
  int updateCalls = 0;

  @override
  void update(double realDelta) {
    updateCalls += 1;
    super.update(realDelta);
  }
}
