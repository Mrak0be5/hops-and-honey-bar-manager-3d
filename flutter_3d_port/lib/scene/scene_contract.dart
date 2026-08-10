import 'package:flutter/widgets.dart';

import '../domain/models.dart';

/// Camera destinations shared by the HUD and the renderer.
enum SceneVenue { overview, bar, karaoke, sauna, massage }

extension SceneVenueRoom on SceneVenue {
  RoomId? get roomId => switch (this) {
    SceneVenue.karaoke => RoomId.karaoke,
    SceneVenue.sauna => RoomId.sauna,
    SceneVenue.massage => RoomId.massage,
    SceneVenue.overview || SceneVenue.bar => null,
  };

  static SceneVenue fromRoom(RoomId room) => switch (room) {
    RoomId.karaoke => SceneVenue.karaoke,
    RoomId.sauna => SceneVenue.sauna,
    RoomId.massage => SceneVenue.massage,
  };
}

/// Renderer-neutral factory seam. Tests can provide a widget-only fake and
/// therefore do not need a Flutter GPU context.
typedef SceneVenueFactory = SceneVenueRenderer Function();

/// Small lifecycle contract between the simulation/controller and a concrete
/// 3D backend.
///
/// [sync] advances renderer-owned interpolation and visual state, but must not
/// advance the gameplay simulation. The surface/controller does that once per
/// frame before calling [sync].
abstract interface class SceneVenueRenderer {
  Widget buildView();

  void focus(SceneVenue venue);

  void sync(GameSnapshot snapshot, double deltaSeconds);

  void resize(Size size);

  SceneVenue? hitTest(Offset localPosition, Size viewport);

  void dispose();
}
