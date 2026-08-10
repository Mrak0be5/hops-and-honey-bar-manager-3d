import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/domain/bar_simulation.dart';
import 'package:hops_and_honey_3d/scene/venue_3d_controller.dart';

import '../support/fake_scene_renderer.dart';

void main() {
  group('Venue3DController', () {
    test('advances gameplay once and syncs once for every frame', () {
      final simulation = _CountingSimulation();
      final renderer = FakeSceneRenderer();
      final controller = Venue3DController(
        simulation: simulation,
        sceneFactory: () => renderer,
      );
      final owner = Object();
      controller.attachSurface(owner);
      final syncsAfterAttach = renderer.syncCount;

      controller.advanceFrame(const Duration(milliseconds: 16), 0.016);
      controller.advanceFrame(const Duration(milliseconds: 32), 0.016);

      expect(simulation.updateCalls, 2);
      expect(simulation.deltas, [0.016, 0.016]);
      expect(renderer.syncCount - syncsAfterAttach, 2);
      expect(controller.frameCount, 2);
      controller.dispose();
    });

    test('uses adaptive focus until a manual room is selected', () {
      final renderer = FakeSceneRenderer();
      final controller = Venue3DController(
        simulation: BarSimulation(),
        sceneFactory: () => renderer,
      );
      controller.attachSurface(Object());

      expect(controller.focus, SceneVenue.bar);
      controller.resize(const Size(1200, 700));
      expect(controller.focus, SceneVenue.overview);
      expect(renderer.focusedVenue, SceneVenue.overview);

      controller.setFocus(SceneVenue.karaoke);
      controller.resize(const Size(390, 844));
      expect(controller.focus, SceneVenue.karaoke);
      expect(renderer.focusedVenue, SceneVenue.karaoke);

      controller.setFocus(null);
      expect(controller.focus, SceneVenue.bar);
      expect(renderer.focusedVenue, SceneVenue.bar);

      controller.resize(const Size(1200, 700));
      expect(controller.focus, SceneVenue.overview);
      expect(renderer.focusedVenue, SceneVenue.overview);
      controller.dispose();
    });

    test('rejects two simultaneous surfaces and disposes idempotently', () {
      final renderer = FakeSceneRenderer();
      final controller = Venue3DController(
        simulation: BarSimulation(),
        sceneFactory: () => renderer,
      );
      final firstOwner = Object();
      controller.attachSurface(firstOwner);

      expect(
        () => controller.attachSurface(Object()),
        throwsA(isA<StateError>()),
      );
      controller.detachSurface(firstOwner);
      expect(() => controller.attachSurface(Object()), returnsNormally);

      controller.dispose();
      controller.dispose();
      expect(renderer.disposed, isTrue);
    });
  });

  test('SceneVenue maps rooms without renderer dependencies', () {
    expect(SceneVenue.karaoke.roomId, RoomId.karaoke);
    expect(SceneVenue.sauna.roomId, RoomId.sauna);
    expect(SceneVenue.massage.roomId, RoomId.massage);
    expect(SceneVenue.overview.roomId, isNull);
    expect(SceneVenueRoom.fromRoom(RoomId.sauna), SceneVenue.sauna);
  });
}

class _CountingSimulation extends BarSimulation {
  int updateCalls = 0;
  final List<double> deltas = [];

  @override
  void update(double realDelta) {
    updateCalls += 1;
    deltas.add(realDelta);
    super.update(realDelta);
  }
}
