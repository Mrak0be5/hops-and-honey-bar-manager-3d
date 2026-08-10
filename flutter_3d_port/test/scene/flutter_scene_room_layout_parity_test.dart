import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/domain/bar_simulation.dart';
import 'package:hops_and_honey_3d/scene/flutter_scene_venue.dart';

void main() {
  test('3D renderer consumes the exact shared domain room layout map', () {
    expect(FlutterSceneVenue.roomLayoutSource, same(roomLayouts));
  });
}
