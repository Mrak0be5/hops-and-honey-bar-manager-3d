import 'package:flutter/widgets.dart';
import 'package:hops_and_honey_3d/domain/models.dart';
import 'package:hops_and_honey_3d/scene/scene_contract.dart';

/// Lightweight renderer used by widget tests so they never initialize a GPU.
class FakeSceneRenderer implements SceneVenueRenderer {
  FakeSceneRenderer({this.hitTestResult});

  SceneVenue focusedVenue = SceneVenue.bar;
  SceneVenue? hitTestResult;
  Size viewport = Size.zero;
  int syncCount = 0;
  bool disposed = false;

  @override
  Widget buildView() => const ColoredBox(color: Color(0xFF041D26));

  @override
  void focus(SceneVenue venue) {
    focusedVenue = venue;
  }

  @override
  SceneVenue? hitTest(Offset localPosition, Size viewport) => hitTestResult;

  @override
  void resize(Size viewport) {
    this.viewport = viewport;
  }

  @override
  void sync(GameSnapshot snapshot, double deltaSeconds) {
    syncCount += 1;
  }

  @override
  void dispose() {
    disposed = true;
  }
}
