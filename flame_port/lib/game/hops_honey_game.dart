import 'dart:ui';

import 'package:flame/game.dart';

import '../domain/bar_simulation.dart';
import 'venue_scene_renderer.dart';

/// Flame host for the deterministic [BarSimulation].
///
/// The simulation remains independent of rendering and can be tested without
/// Flutter. This game advances it once per Flame tick and paints its immutable
/// snapshot. The HUD may keep the same [simulation] reference for purchases.
class HopsHoneyGame extends FlameGame {
  HopsHoneyGame({
    required this.simulation,
    this.soundEnabled = true,
    VenueSceneRenderer? sceneRenderer,
  }) : scene = sceneRenderer ?? VenueSceneRenderer();

  final BarSimulation simulation;
  final VenueSceneRenderer scene;
  bool soundEnabled;

  GameSnapshot get snapshot => simulation.snapshot;
  SceneVenue get venueFocus => scene.focus;
  SceneCameraState get cameraState => scene.cameraState;

  /// Audio is intentionally kept as a setting even though this procedural port
  /// ships without external sound assets. UI/audio services can use this flag
  /// before playing feedback, without coupling audio to the simulation.
  void setSoundEnabled(bool enabled) {
    soundEnabled = enabled;
  }

  /// Focus a room from the development panel. Pass null to restore responsive
  /// auto-framing (overview on desktop, bar on portrait screens).
  void setVenueFocus(SceneVenue? venue) => scene.setFocus(venue);

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    scene.sync(simulation.snapshot, 0);
    scene.updateCamera(Size(size.x, size.y), 0);
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    scene.updateCamera(Size(size.x, size.y), 0);
  }

  @override
  void update(double dt) {
    simulation.update(dt);
    scene.sync(simulation.snapshot, dt);
    scene.updateCamera(Size(size.x, size.y), dt);
    super.update(dt);
  }

  @override
  void render(Canvas canvas) {
    super.render(canvas);
    scene.render(canvas, Size(size.x, size.y));
  }

  @override
  Color backgroundColor() => const Color(0xff041d26);
}
