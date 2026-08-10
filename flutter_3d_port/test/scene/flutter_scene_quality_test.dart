import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/scene/flutter_scene_venue.dart';

void main() {
  test('Retina pixel ratio is capped for predictable mobile GPU cost', () {
    expect(FlutterSceneVenue.pixelRatioForDevice(1), 1);
    expect(FlutterSceneVenue.pixelRatioForDevice(2), 2);
    expect(FlutterSceneVenue.pixelRatioForDevice(3), 2);
  });

  test('compact viewport selects the mobile shadow budget', () {
    final mobile = FlutterSceneVenue.qualityForViewport(const Size(390, 844));
    final desktop = FlutterSceneVenue.qualityForViewport(const Size(1440, 900));

    expect(mobile.renderScale, 0.78);
    expect(mobile.shadowCascades, 2);
    expect(mobile.shadowResolution, 768);
    expect(desktop.renderScale, 0.92);
    expect(desktop.shadowCascades, 3);
    expect(desktop.shadowResolution, 1024);
  });
}
