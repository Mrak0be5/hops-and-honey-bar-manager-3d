import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/domain/bar_simulation.dart';
import 'package:hops_and_honey_flame/game/isometric_geometry.dart';
import 'package:hops_and_honey_flame/game/venue_scene_renderer.dart';

void main() {
  group('IsoProjector', () {
    const projector = IsoProjector();

    test('projects grid axes and height consistently', () {
      expect(projector.project(const IsoWorldPoint(0, 0)), Offset.zero);
      expect(
        projector.project(const IsoWorldPoint(1, 0)),
        const Offset(28, 14),
      );
      expect(
        projector.project(const IsoWorldPoint(0, 1)),
        const Offset(-28, 14),
      );
      expect(
        projector.project(const IsoWorldPoint(0, 0, 1)),
        const Offset(0, -28),
      );
    });

    test('fitScale keeps projected bounds inside the viewport', () {
      final bounds = projector.projectedBounds(
        const IsoWorldRect(left: -8, top: -6, right: 8, bottom: 6),
        wallHeight: 3,
      );
      const viewport = Size(390, 844);
      final scale = projector.fitScale(
        bounds,
        viewport,
        horizontalPadding: 16,
        verticalPadding: 72,
      );

      expect(bounds.width * scale, lessThanOrEqualTo(390 - 32));
      expect(bounds.height * scale, lessThanOrEqualTo(844 - 144));
    });
  });

  group('VenueSceneRenderer camera', () {
    test('uses a readable bar frame in portrait and overview on desktop', () {
      final renderer = VenueSceneRenderer();
      final simulation = BarSimulation()..start();
      renderer.sync(simulation.snapshot, 0);

      renderer.updateCamera(const Size(390, 844), 0);
      expect(renderer.focus, SceneVenue.bar);
      expect(renderer.cameraState.scale, greaterThan(.3));

      renderer.setFocus(null);
      renderer.updateCamera(const Size(1280, 720), 0);
      expect(renderer.focus, SceneVenue.overview);
      expect(renderer.cameraState.scale, greaterThan(.25));
    });

    test('manual room focus survives viewport changes', () {
      final renderer = VenueSceneRenderer()..setFocus(SceneVenue.massage);
      renderer.updateCamera(const Size(390, 844), 0);
      final portraitScale = renderer.cameraState.scale;
      renderer.updateCamera(const Size(1180, 720), 0);

      expect(renderer.focus, SceneVenue.massage);
      expect(renderer.cameraState.scale, greaterThan(portraitScale));
    });
  });
}
