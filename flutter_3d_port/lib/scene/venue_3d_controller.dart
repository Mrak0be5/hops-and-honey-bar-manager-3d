import 'package:flutter/widgets.dart';

import '../domain/bar_simulation.dart';
import 'flutter_scene_venue.dart';
import 'scene_contract.dart';

export 'scene_contract.dart' show SceneVenue, SceneVenueRoom;

/// Owns the bridge between [BarSimulation] and one concrete venue renderer.
///
/// The controller deliberately owns no ticker. [Venue3DSurface] is the sole
/// frame source and calls [advanceFrame] once for every tick.
class Venue3DController {
  Venue3DController({required this.simulation, SceneVenueFactory? sceneFactory})
    : _sceneFactory = sceneFactory ?? FlutterSceneVenue.new;

  final BarSimulation simulation;
  final SceneVenueFactory _sceneFactory;

  SceneVenueRenderer? _renderer;
  Object? _surfaceOwner;
  SceneVenue? _manualFocus;
  Size _viewport = Size.zero;
  bool _disposed = false;
  int _frameCount = 0;

  SceneVenue get focus {
    final manual = _manualFocus;
    if (manual != null) return manual;
    if (_viewport.isEmpty) return SceneVenue.bar;
    return _viewport.width >= _viewport.height * 1.18
        ? SceneVenue.overview
        : SceneVenue.bar;
  }

  GameSnapshot get snapshot => simulation.snapshot;

  @visibleForTesting
  int get frameCount => _frameCount;

  @visibleForTesting
  SceneVenueRenderer? get debugRenderer => _renderer;

  void setFocus(SceneVenue? value) {
    _assertAlive();
    final previous = focus;
    _manualFocus = value;
    final next = focus;
    if (previous != next || value != null) {
      _renderer?.focus(next);
    }
  }

  /// Synchronizes a known snapshot without advancing gameplay.
  void sync(GameSnapshot snapshot, {double deltaSeconds = 0}) {
    _assertAlive();
    _renderer?.sync(snapshot, _safeDelta(deltaSeconds));
  }

  void resize(Size size) {
    _assertAlive();
    if (!_isUsableSize(size) || size == _viewport) return;
    final previousFocus = focus;
    _viewport = size;
    final renderer = _renderer;
    renderer?.resize(size);
    if (_manualFocus == null && previousFocus != focus) {
      renderer?.focus(focus);
    }
  }

  /// Called by the one ticker in [Venue3DSurface].
  ///
  /// There is intentionally exactly one [BarSimulation.update] invocation in
  /// this method. The simulation itself owns any fixed-step subdivision.
  void advanceFrame(Duration elapsed, double deltaSeconds) {
    _assertAlive();
    final delta = _safeDelta(deltaSeconds);
    simulation.update(delta);
    _frameCount += 1;
    _renderer?.sync(simulation.snapshot, delta);
  }

  SceneVenue? hitTest(Offset localPosition, Size viewport) {
    if (_disposed || !_isUsableSize(viewport)) return null;
    return _renderer?.hitTest(localPosition, viewport);
  }

  SceneVenueRenderer attachSurface(Object owner) {
    _assertAlive();
    final currentOwner = _surfaceOwner;
    if (currentOwner != null && !identical(currentOwner, owner)) {
      throw StateError(
        'A Venue3DController can be attached to only one Venue3DSurface.',
      );
    }
    _surfaceOwner = owner;
    final renderer = _renderer ??= _sceneFactory();
    if (_isUsableSize(_viewport)) renderer.resize(_viewport);
    renderer.focus(focus);
    renderer.sync(simulation.snapshot, 0);
    return renderer;
  }

  void detachSurface(Object owner) {
    if (identical(_surfaceOwner, owner)) _surfaceOwner = null;
  }

  SceneVenueRenderer retryRenderer(Object owner) {
    _assertAlive();
    if (!identical(_surfaceOwner, owner)) {
      throw StateError('Only the attached surface can retry its renderer.');
    }
    _renderer?.dispose();
    _renderer = null;
    return attachSurface(owner);
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _surfaceOwner = null;
    _renderer?.dispose();
    _renderer = null;
  }

  void _assertAlive() {
    if (_disposed) {
      throw StateError('Venue3DController has already been disposed.');
    }
  }

  static bool _isUsableSize(Size size) =>
      size.width.isFinite &&
      size.height.isFinite &&
      size.width > 0 &&
      size.height > 0;

  static double _safeDelta(double value) =>
      value.isFinite && value > 0 ? value : 0;
}
