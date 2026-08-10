import 'dart:math' as math;

import 'package:flutter/painting.dart';

import '../domain/models.dart';
import 'isometric_geometry.dart';

/// Camera destinations exposed to the Flutter HUD.
enum SceneVenue { overview, bar, karaoke, sauna, massage }

extension SceneVenueRoom on SceneVenue {
  RoomId? get roomId => switch (this) {
    SceneVenue.karaoke => RoomId.karaoke,
    SceneVenue.sauna => RoomId.sauna,
    SceneVenue.massage => RoomId.massage,
    SceneVenue.overview || SceneVenue.bar => null,
  };
}

class SceneCameraState {
  const SceneCameraState({
    required this.center,
    required this.scale,
    required this.focus,
  });

  final Offset center;
  final double scale;
  final SceneVenue focus;
}

/// Procedural painter for the complete Hops & Honey venue.
///
/// One painter owns the static scene while a compact actor cache interpolates
/// simulation snapshots. This avoids hundreds of Flutter widgets/components in
/// the hot render loop and remains inexpensive on mobile web.
class VenueSceneRenderer {
  VenueSceneRenderer({IsoProjector? projector})
    : projector = projector ?? const IsoProjector();

  final IsoProjector projector;

  static const barBounds = IsoWorldRect(left: -8, top: -6, right: 8, bottom: 6);
  static const karaokeBounds = IsoWorldRect(
    left: -20,
    top: -5,
    right: -9,
    bottom: 6,
  );
  static const saunaBounds = IsoWorldRect(
    left: 9,
    top: -5,
    right: 20,
    bottom: 6,
  );
  static const massageBounds = IsoWorldRect(
    left: 0,
    top: -17,
    right: 11,
    bottom: -7,
  );
  static const overviewBounds = IsoWorldRect(
    left: -20.7,
    top: -17.7,
    right: 20.7,
    bottom: 6.8,
  );

  final Map<String, _ActorVisual> _actors = {};
  final Map<int, Paint> _solidPaints = {};
  GameSnapshot? _snapshot;
  SceneVenue? _manualFocus;
  double _time = 0;
  Offset _cameraCenter = Offset.zero;
  double _cameraScale = .6;
  bool _cameraInitialized = false;
  Size _lastViewport = Size.zero;

  SceneVenue get focus =>
      _manualFocus ??
      (_lastViewport.width >= _lastViewport.height * 1.25
          ? SceneVenue.overview
          : SceneVenue.bar);

  SceneCameraState get cameraState => SceneCameraState(
    center: _cameraCenter,
    scale: _cameraScale,
    focus: focus,
  );

  void setFocus(SceneVenue? value) {
    _manualFocus = value;
    _cameraInitialized = false;
  }

  void sync(GameSnapshot snapshot, double dt) {
    _snapshot = snapshot;
    _time += dt;

    final seen = <String>{'bartender'};
    final bartender = snapshot.bartender;
    final bartenderVisual = _actors.putIfAbsent(
      'bartender',
      () => _ActorVisual(
        id: 'bartender',
        x: bartender.position.x,
        z: bartender.position.z,
        targetX: bartender.position.x,
        targetZ: bartender.position.z,
        palette: 0,
        bartender: true,
      ),
    );
    bartenderVisual
      ..targetX = bartender.position.x
      ..targetZ = bartender.position.z
      ..state = bartender.state.name
      ..carrying = bartender.carryingDrink != null || bartender.carryingDirty
      ..opacity = 1;

    for (var index = 0; index < snapshot.patrons.length; index++) {
      final patron = snapshot.patrons[index];
      seen.add(patron.id);
      final visual = _actors.putIfAbsent(
        patron.id,
        () => _ActorVisual(
          id: patron.id,
          x: patron.position.x,
          z: patron.position.z,
          targetX: patron.position.x,
          targetZ: patron.position.z,
          palette: (patron.id.hashCode.abs() + index) % _patronPalettes.length,
        ),
      );
      visual
        ..targetX = patron.position.x
        ..targetZ = patron.position.z
        ..state = patron.state.name
        ..happiness = patron.happiness
        ..roomId = patron.roomId
        ..carrying =
            patron.drink != null && patron.state == PatronState.drinking
        ..opacity = 1;
    }

    final smoothing = 1 - math.exp(-dt * 11);
    for (final visual in _actors.values) {
      visual
        ..previousX = visual.x
        ..previousZ = visual.z
        ..x += (visual.targetX - visual.x) * smoothing
        ..z += (visual.targetZ - visual.z) * smoothing;
      if (!seen.contains(visual.id)) {
        visual.opacity = math.max(0, visual.opacity - dt * 3);
      }
    }
    _actors.removeWhere((_, visual) => visual.opacity <= 0);
  }

  void updateCamera(Size viewport, double dt) {
    _lastViewport = viewport;
    final currentFocus = focus;
    final bounds = _boundsFor(currentFocus);
    final projected = projector.projectedBounds(bounds, wallHeight: 3.1);
    final portrait = viewport.height > viewport.width * 1.18;
    final targetScale = projector.fitScale(
      projected,
      viewport,
      horizontalPadding: portrait ? 14 : 30,
      verticalPadding: portrait ? 72 : 30,
      maxScale: currentFocus == SceneVenue.overview ? .9 : 1.3,
    );
    final targetCenter = projected.center;
    if (!_cameraInitialized || dt <= 0) {
      _cameraCenter = targetCenter;
      _cameraScale = targetScale;
      _cameraInitialized = true;
      return;
    }
    final cameraBlend = 1 - math.exp(-dt * 5.5);
    _cameraCenter = Offset.lerp(_cameraCenter, targetCenter, cameraBlend)!;
    _cameraScale += (targetScale - _cameraScale) * cameraBlend;
  }

  void render(Canvas canvas, Size viewport) {
    final snapshot = _snapshot;
    _drawBackground(canvas, viewport);
    if (snapshot == null) return;

    canvas.save();
    canvas.translate(viewport.width * .5, viewport.height * .5 + 10);
    canvas.scale(_cameraScale);
    canvas.translate(-_cameraCenter.dx, -_cameraCenter.dy);

    _drawConnections(canvas);
    _drawRoomShell(
      canvas,
      barBounds,
      floor: const Color(0xffa85049),
      tile: const Color(0x24ffe2a5),
      wall: const Color(0xff087b81),
      trim: const Color(0xfff1bd61),
      label: 'ХМЕЛЬА И МЁД',
      door: _DoorSide.none,
      unlocked: true,
      northDoorCenter: 4.8,
      westDoorCenter: 1.5,
    );
    _drawRoomShell(
      canvas,
      karaokeBounds,
      floor: const Color(0xff32245f),
      tile: const Color(0x306ad7ff),
      wall: const Color(0xff65459e),
      trim: const Color(0xffff6eb4),
      label: 'КАРАОКЕ',
      door: _DoorSide.east,
      unlocked: _room(snapshot, RoomId.karaoke)?.unlocked ?? false,
    );
    _drawRoomShell(
      canvas,
      saunaBounds,
      floor: const Color(0xffb67b43),
      tile: const Color(0x30fff0bd),
      wall: const Color(0xff875634),
      trim: const Color(0xffffc96b),
      label: 'САУНА',
      door: _DoorSide.west,
      unlocked: _room(snapshot, RoomId.sauna)?.unlocked ?? false,
    );
    _drawRoomShell(
      canvas,
      massageBounds,
      floor: const Color(0xff6e927b),
      tile: const Color(0x30efffd9),
      wall: const Color(0xff47725f),
      trim: const Color(0xffffd59b),
      label: 'МАССАЖ',
      door: _DoorSide.south,
      unlocked: _room(snapshot, RoomId.massage)?.unlocked ?? false,
    );

    _drawBarFurniture(canvas, snapshot);
    _drawKaraoke(canvas, _room(snapshot, RoomId.karaoke));
    _drawSauna(canvas, _room(snapshot, RoomId.sauna));
    _drawMassage(canvas, _room(snapshot, RoomId.massage));
    _drawActors(canvas, snapshot);
    _drawRoomProgress(canvas, snapshot);
    _drawForegroundTrim(canvas);

    canvas.restore();
  }

  IsoWorldRect _boundsFor(SceneVenue venue) => switch (venue) {
    SceneVenue.overview => overviewBounds,
    SceneVenue.bar => const IsoWorldRect(
      left: -8.8,
      top: -6.8,
      right: 8.8,
      bottom: 6.8,
    ),
    SceneVenue.karaoke => const IsoWorldRect(
      left: -20.8,
      top: -6,
      right: -7.8,
      bottom: 7,
    ),
    SceneVenue.sauna => const IsoWorldRect(
      left: 7.8,
      top: -6,
      right: 20.8,
      bottom: 7,
    ),
    SceneVenue.massage => const IsoWorldRect(
      left: -.8,
      top: -17.8,
      right: 11.8,
      bottom: -5.8,
    ),
  };

  RoomSnapshot? _room(GameSnapshot snapshot, RoomId id) {
    for (final room in snapshot.rooms) {
      if (room.id == id) return room;
    }
    return null;
  }

  Paint _solid(Color color) =>
      _solidPaints.putIfAbsent(color.toARGB32(), () => Paint()..color = color);

  void _drawBackground(Canvas canvas, Size viewport) {
    final rect = Offset.zero & viewport;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xff092f38), Color(0xff041d26)],
        ).createShader(rect),
    );
    final glowCenter = Offset(viewport.width * .48, viewport.height * .46);
    canvas.drawCircle(
      glowCenter,
      math.max(viewport.width, viewport.height) * .55,
      Paint()
        ..shader =
            RadialGradient(
              colors: [
                const Color(0xff1d6d72).withValues(alpha: .32),
                const Color(0xff071f28).withValues(alpha: 0),
              ],
            ).createShader(
              Rect.fromCircle(
                center: glowCenter,
                radius: math.max(viewport.width, viewport.height) * .55,
              ),
            ),
    );
  }

  void _drawConnections(Canvas canvas) {
    _drawIsoFloor(
      canvas,
      const IsoWorldRect(left: -9.4, top: .1, right: -7.5, bottom: 2.9),
      const Color(0xffc66a54),
    );
    _drawIsoFloor(
      canvas,
      const IsoWorldRect(left: 7.5, top: -.5, right: 9.4, bottom: 2.5),
      const Color(0xffc68a55),
    );
    _drawIsoFloor(
      canvas,
      const IsoWorldRect(left: 3.7, top: -7.5, right: 6.5, bottom: -5.5),
      const Color(0xff81a17f),
    );
    for (final point in const [
      IsoWorldPoint(-8.5, 2),
      IsoWorldPoint(8.5, 1),
      IsoWorldPoint(5.1, -6.5),
    ]) {
      final center = projector.project(point);
      canvas.drawOval(
        Rect.fromCenter(center: center, width: 54, height: 18),
        _solid(const Color(0x55ffe59a)),
      );
    }
  }

  void _drawRoomShell(
    Canvas canvas,
    IsoWorldRect bounds, {
    required Color floor,
    required Color tile,
    required Color wall,
    required Color trim,
    required String label,
    required _DoorSide door,
    required bool unlocked,
    double? northDoorCenter,
    double? westDoorCenter,
  }) {
    _drawIsoFloor(
      canvas,
      bounds,
      unlocked ? floor : _mix(floor, const Color(0xff26333a), .56),
    );
    _drawTileGrid(canvas, bounds, tile);

    // North and west walls face the camera. East/south connections are open;
    // only a west-side connection needs a gap cut into a tall wall.
    final resolvedWestDoorCenter =
        westDoorCenter ?? (door == _DoorSide.west ? 1.0 : null);
    _drawSplitWallX(
      canvas,
      bounds.left,
      bounds.right,
      bounds.top,
      wall,
      trim,
      gapCenter: northDoorCenter,
      gapWidth: 2.7,
    );
    _drawSplitWallZ(
      canvas,
      bounds.left,
      bounds.top,
      bounds.bottom,
      wall,
      trim,
      gapCenter: resolvedWestDoorCenter,
      gapWidth: 2.8,
    );

    final labelPoint = projector.project(
      IsoWorldPoint(bounds.centerX, bounds.top + .16, 2.68),
    );
    _drawSign(canvas, labelPoint, label, trim, unlocked: unlocked);
    if (!unlocked) {
      final center = projector.project(
        IsoWorldPoint(bounds.centerX, bounds.centerZ, .12),
      );
      canvas.drawOval(
        Rect.fromCenter(center: center, width: 150, height: 62),
        _solid(const Color(0xaa132a33)),
      );
      _drawText(
        canvas,
        'НА РЕМОНТЕ',
        center + const Offset(0, -2),
        color: const Color(0xffffdda0),
        size: 15,
        weight: FontWeight.w800,
        center: true,
      );
    }
  }

  void _drawIsoFloor(Canvas canvas, IsoWorldRect rect, Color color) {
    final points = rect.corners().map(projector.project).toList();
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    path.close();
    canvas.drawPath(path, _solid(color));
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0x33000000)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  void _drawTileGrid(Canvas canvas, IsoWorldRect rect, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var x = rect.left + 1; x < rect.right; x += 1) {
      final a = projector.project(IsoWorldPoint(x, rect.top));
      final b = projector.project(IsoWorldPoint(x, rect.bottom));
      canvas.drawLine(a, b, paint);
    }
    for (var z = rect.top + 1; z < rect.bottom; z += 1) {
      final a = projector.project(IsoWorldPoint(rect.left, z));
      final b = projector.project(IsoWorldPoint(rect.right, z));
      canvas.drawLine(a, b, paint);
    }
  }

  void _drawSplitWallX(
    Canvas canvas,
    double from,
    double to,
    double z,
    Color wall,
    Color trim, {
    double? gapCenter,
    double gapWidth = 2.6,
  }) {
    if (gapCenter == null) {
      _drawBox(canvas, from, z, to - from, .28, 2.65, wall, top: trim);
      return;
    }
    final gapStart = gapCenter - gapWidth * .5;
    final gapEnd = gapCenter + gapWidth * .5;
    if (gapStart > from) {
      _drawBox(canvas, from, z, gapStart - from, .28, 2.65, wall, top: trim);
    }
    if (gapEnd < to) {
      _drawBox(canvas, gapEnd, z, to - gapEnd, .28, 2.65, wall, top: trim);
    }
    _drawDoorArch(canvas, gapCenter, z + .1, horizontal: true, color: trim);
  }

  void _drawSplitWallZ(
    Canvas canvas,
    double x,
    double from,
    double to,
    Color wall,
    Color trim, {
    double? gapCenter,
    double gapWidth = 2.6,
  }) {
    if (gapCenter == null) {
      _drawBox(canvas, x, from, .28, to - from, 2.65, wall, top: trim);
      return;
    }
    final gapStart = gapCenter - gapWidth * .5;
    final gapEnd = gapCenter + gapWidth * .5;
    if (gapStart > from) {
      _drawBox(canvas, x, from, .28, gapStart - from, 2.65, wall, top: trim);
    }
    if (gapEnd < to) {
      _drawBox(canvas, x, gapEnd, .28, to - gapEnd, 2.65, wall, top: trim);
    }
    _drawDoorArch(canvas, x + .1, gapCenter, horizontal: false, color: trim);
  }

  void _drawDoorArch(
    Canvas canvas,
    double x,
    double z, {
    required bool horizontal,
    required Color color,
  }) {
    if (horizontal) {
      _drawBox(canvas, x - 1.35, z, .18, .25, 2.3, color);
      _drawBox(canvas, x + 1.17, z, .18, .25, 2.3, color);
      _drawBox(canvas, x - 1.35, z, 2.7, .25, .18, color, baseHeight: 2.18);
    } else {
      _drawBox(canvas, x, z - 1.35, .25, .18, 2.3, color);
      _drawBox(canvas, x, z + 1.17, .25, .18, 2.3, color);
      _drawBox(canvas, x, z - 1.35, .25, 2.7, .18, color, baseHeight: 2.18);
    }
  }

  void _drawBox(
    Canvas canvas,
    double x,
    double z,
    double width,
    double depth,
    double height,
    Color color, {
    Color? top,
    double baseHeight = 0,
  }) {
    final floor = <Offset>[
      projector.project(IsoWorldPoint(x, z, baseHeight)),
      projector.project(IsoWorldPoint(x + width, z, baseHeight)),
      projector.project(IsoWorldPoint(x + width, z + depth, baseHeight)),
      projector.project(IsoWorldPoint(x, z + depth, baseHeight)),
    ];
    final roof = <Offset>[
      projector.project(IsoWorldPoint(x, z, baseHeight + height)),
      projector.project(IsoWorldPoint(x + width, z, baseHeight + height)),
      projector.project(
        IsoWorldPoint(x + width, z + depth, baseHeight + height),
      ),
      projector.project(IsoWorldPoint(x, z + depth, baseHeight + height)),
    ];
    _drawPolygon(canvas, [
      floor[1],
      floor[2],
      roof[2],
      roof[1],
    ], _shade(color, -.13));
    _drawPolygon(canvas, [
      floor[2],
      floor[3],
      roof[3],
      roof[2],
    ], _shade(color, -.24));
    _drawPolygon(canvas, roof, top ?? _shade(color, .13));
  }

  void _drawPolygon(Canvas canvas, List<Offset> points, Color color) {
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    path.close();
    canvas.drawPath(path, _solid(color));
  }

  void _drawSign(
    Canvas canvas,
    Offset center,
    String label,
    Color color, {
    required bool unlocked,
  }) {
    final signColor = unlocked
        ? const Color(0xee103944)
        : const Color(0xdd2a3438);
    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: center,
        width: label.length * 9.2 + 28,
        height: 34,
      ),
      const Radius.circular(10),
    );
    canvas.drawRRect(rect, _solid(signColor));
    canvas.drawRRect(
      rect,
      Paint()
        ..color = unlocked ? color : const Color(0xff718086)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
    _drawText(
      canvas,
      label,
      center,
      color: unlocked ? color : const Color(0xff9aa5a8),
      size: 16,
      weight: FontWeight.w900,
      center: true,
    );
  }

  void _drawBarFurniture(Canvas canvas, GameSnapshot snapshot) {
    // Rear display and bottles scale with assortment level.
    _drawBox(
      canvas,
      -3.25,
      -5.72,
      5.9,
      .5,
      2.05,
      const Color(0xff07545d),
      top: const Color(0xffe1ad58),
    );
    final bottleCount = 4 + (snapshot.upgrades.assortment - 1) * 2;
    const bottleColors = [
      Color(0xffe04f42),
      Color(0xffefb43f),
      Color(0xff2fbc91),
      Color(0xff61aee8),
      Color(0xffd86dc1),
    ];
    for (var index = 0; index < bottleCount; index++) {
      final row = index ~/ 7;
      final col = index % 7;
      _drawBottle(
        canvas,
        -2.75 + col * .78,
        -5.12 + row * .06,
        .9 + row * .72,
        bottleColors[index % bottleColors.length],
      );
    }
    if (snapshot.upgrades.assortment > 1) {
      _drawSparkles(
        canvas,
        -2.8,
        -4.95,
        count: 5 + snapshot.upgrades.assortment,
        color: const Color(0xffffda77),
        spread: 5,
      );
    }

    // Main counter and taps.
    _drawBox(
      canvas,
      -3.35,
      -3.85,
      6.7,
      1,
      1.15,
      const Color(0xffa9343d),
      top: const Color(0xfff0b65b),
    );
    final taps = math.min(3, 1 + (snapshot.upgrades.prepSpeed - 1) ~/ 2);
    for (var index = 0; index < taps; index++) {
      _drawTap(canvas, -1.05 + index * .7, -3.47, snapshot.upgrades.prepSpeed);
    }
    if (snapshot.upgrades.orderSpeed > 1) {
      _drawTerminal(canvas, 2.25, -3.28, snapshot.upgrades.orderSpeed);
    }
    if (snapshot.upgrades.cleanSpeed > 1) {
      _drawWasher(canvas, 2.35, -5.02, snapshot.upgrades.cleanSpeed);
    }

    for (final table in snapshot.tables) {
      _drawTable(canvas, table);
    }

    // Entrance and advertising upgrade become visible at the east door.
    _drawBox(
      canvas,
      7.46,
      3.35,
      .35,
      2.15,
      2.45,
      const Color(0xffe9654f),
      top: const Color(0xffffc45d),
    );
    if (snapshot.upgrades.advertising > 1) {
      final sign = projector.project(const IsoWorldPoint(7.6, 4.38, 3.15));
      _drawSign(
        canvas,
        sign,
        'ОТКРЫТО!',
        const Color(0xffffc950),
        unlocked: true,
      );
      _drawSparkles(
        canvas,
        7.5,
        4,
        count: 5 + snapshot.upgrades.advertising * 2,
        color: const Color(0xffffd256),
        spread: 2.2,
      );
    }
  }

  void _drawTable(Canvas canvas, TableSnapshot table) {
    final x = table.position.x;
    final z = table.position.z;
    final shadow = projector.project(IsoWorldPoint(x, z));
    canvas.drawOval(
      Rect.fromCenter(
        center: shadow + const Offset(0, 2),
        width: 74,
        height: 24,
      ),
      _solid(const Color(0x33091a1e)),
    );
    _drawBox(
      canvas,
      x - .75,
      z - .52,
      1.5,
      1.04,
      .76,
      table.dirty ? const Color(0xff775953) : const Color(0xff9a5541),
      top: table.dirty ? const Color(0xffb08873) : const Color(0xffefc37c),
    );
    for (final dz in [-.9, .9]) {
      _drawBox(
        canvas,
        x - .35,
        z + dz - .23,
        .7,
        .46,
        .36,
        const Color(0xff156c72),
        top: const Color(0xff30a1a0),
      );
    }
    if (table.dirty) {
      final plate = projector.project(IsoWorldPoint(x, z, .81));
      canvas.drawOval(
        Rect.fromCenter(center: plate, width: 23, height: 8),
        _solid(const Color(0xffd9e3db)),
      );
      _drawSparkles(
        canvas,
        x,
        z,
        count: 3,
        color: const Color(0xff9a8177),
        spread: .7,
        upward: true,
      );
    }
  }

  void _drawBottle(
    Canvas canvas,
    double x,
    double z,
    double height,
    Color color,
  ) {
    _drawBox(
      canvas,
      x,
      z,
      .23,
      .23,
      height * .48,
      color,
      top: const Color(0xffffd278),
    );
    _drawBox(
      canvas,
      x + .065,
      z + .065,
      .1,
      .1,
      height * .24,
      _shade(color, .06),
      baseHeight: height * .48,
    );
  }

  void _drawTap(Canvas canvas, double x, double z, int level) {
    _drawBox(canvas, x, z, .16, .16, .74, const Color(0xff38505a));
    _drawBox(
      canvas,
      x,
      z,
      .46,
      .15,
      .14,
      level >= 4 ? const Color(0xffffca53) : const Color(0xffe36d4f),
      baseHeight: .63,
    );
  }

  void _drawTerminal(Canvas canvas, double x, double z, int level) {
    _drawBox(
      canvas,
      x,
      z,
      .85,
      .62,
      .12,
      const Color(0xff173c45),
      top: const Color(0xff75eed5),
      baseHeight: 1.18,
    );
    if (level >= 4) {
      _drawSparkles(
        canvas,
        x + .4,
        z + .3,
        count: 4,
        color: const Color(0xff89ffe6),
        spread: .7,
      );
    }
  }

  void _drawWasher(Canvas canvas, double x, double z, int level) {
    _drawBox(
      canvas,
      x,
      z,
      1.25,
      .9,
      .76,
      const Color(0xff79a9a6),
      top: const Color(0xffd7f1eb),
    );
    final bubbles = 2 + level;
    for (var index = 0; index < bubbles; index++) {
      final phase = (_time * .7 + index * .83) % 1;
      final bubble = projector.project(
        IsoWorldPoint(
          x + .2 + (index % 3) * .32,
          z + .2 + (index % 2) * .28,
          .8 + phase * .9,
        ),
      );
      canvas.drawCircle(
        bubble,
        4 + index % 3,
        Paint()
          ..color = const Color(0x88bfffee)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }
  }

  void _drawKaraoke(Canvas canvas, RoomSnapshot? room) {
    if (room == null || !room.unlocked) return;
    final quality = room.upgrades.quality;
    final capacity = room.upgrades.capacity;
    _drawBox(
      canvas,
      -18.8,
      -3.8,
      4.7,
      2.2,
      .34,
      const Color(0xff3f286f),
      top: const Color(0xffcc4f93),
    );
    _drawBox(
      canvas,
      -19.45,
      -3.65,
      .35,
      2,
      2.2,
      const Color(0xff182d4f),
      top: const Color(0xff6bcff3),
    );
    final screen = projector.project(const IsoWorldPoint(-19.17, -2.68, 1.48));
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: screen, width: 82, height: 52),
        const Radius.circular(7),
      ),
      Paint()
        ..shader = LinearGradient(
          colors: [
            const Color(0xff52daf1),
            Color.lerp(
              const Color(0xffb25aff),
              const Color(0xffff65a6),
              (.5 + math.sin(_time * 2) * .5),
            )!,
          ],
        ).createShader(Rect.fromCenter(center: screen, width: 82, height: 52)),
    );
    _drawText(
      canvas,
      '♫',
      screen,
      color: const Color(0xffffffff),
      size: 27,
      weight: FontWeight.w800,
      center: true,
    );

    _drawSofa(canvas, -16.8, 2.75, const Color(0xff2b8eac));
    if (capacity >= 2) _drawSofa(canvas, -13.4, 3.8, const Color(0xffa44885));
    if (capacity >= 3) _drawSofa(canvas, -12.2, -.7, const Color(0xff504397));
    _drawMicrophone(canvas, -15.8, -1.1, quality);
    if (quality > 1) {
      _drawDiscoLights(canvas, -15, -.8, quality);
    }
    _drawRoomStaff(canvas, room, -10.5, 3.85, const Color(0xffff79b6));
  }

  void _drawSofa(Canvas canvas, double x, double z, Color color) {
    _drawBox(canvas, x, z, 2.6, 1.05, .62, color, top: _shade(color, .12));
    _drawBox(canvas, x, z + .72, 2.6, .34, .78, _shade(color, -.08));
    _drawBox(canvas, x - .2, z, .32, 1.08, .75, _shade(color, .08));
    _drawBox(canvas, x + 2.48, z, .32, 1.08, .75, _shade(color, .08));
  }

  void _drawMicrophone(Canvas canvas, double x, double z, int quality) {
    final base = projector.project(IsoWorldPoint(x, z));
    final top = projector.project(IsoWorldPoint(x, z, 1.65));
    canvas.drawOval(
      Rect.fromCenter(center: base, width: 35, height: 12),
      _solid(const Color(0xff172b3a)),
    );
    canvas.drawLine(
      base,
      top,
      Paint()
        ..color = const Color(0xffbac5d0)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(
      top + const Offset(5, -2),
      8,
      _solid(quality >= 3 ? const Color(0xffff6fb7) : const Color(0xff233746)),
    );
  }

  void _drawDiscoLights(Canvas canvas, double x, double z, int quality) {
    const colors = [Color(0xffff58ad), Color(0xff5ae5ff), Color(0xffffda4e)];
    for (var index = 0; index < math.min(quality, 3); index++) {
      final angle = _time * (.7 + index * .15) + index * 2.1;
      final origin = projector.project(
        IsoWorldPoint(x + index * .8, z - 1.5, 2.4),
      );
      final target = projector.project(
        IsoWorldPoint(x + math.sin(angle) * 2.8, z + math.cos(angle) * 2.4),
      );
      final path = Path()
        ..moveTo(origin.dx - 6, origin.dy)
        ..lineTo(target.dx - 22, target.dy)
        ..lineTo(target.dx + 22, target.dy)
        ..lineTo(origin.dx + 6, origin.dy)
        ..close();
      canvas.drawPath(path, _solid(colors[index].withValues(alpha: .13)));
    }
  }

  void _drawSauna(Canvas canvas, RoomSnapshot? room) {
    if (room == null || !room.unlocked) return;
    final capacity = room.upgrades.capacity;
    final quality = room.upgrades.quality;
    _drawBench(canvas, 11.1, -3.8, 5.5);
    _drawBench(canvas, 15.1, 2.8, 3.5);
    if (capacity >= 2) _drawBench(canvas, 12.2, .2, 3.8);
    if (capacity >= 3) _drawBench(canvas, 16.2, -.7, 2.5);
    _drawSaunaStove(canvas, 17.8, -3.3, quality);
    final steamCount = 4 + quality * 2;
    for (var index = 0; index < steamCount; index++) {
      final phase = (_time * .25 + index / steamCount) % 1;
      final x = 17.9 + math.sin(index * 2.4) * .45;
      final z = -3.15 + math.cos(index * 1.7) * .35;
      final steam = projector.project(IsoWorldPoint(x, z, 1.1 + phase * 2));
      canvas.drawCircle(
        steam,
        5 + phase * 12,
        Paint()
          ..color = const Color(0x66fff7dd).withValues(alpha: (1 - phase) * .34)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }
    _drawRoomStaff(canvas, room, 10.25, 3.7, const Color(0xffffcf77));
  }

  void _drawBench(Canvas canvas, double x, double z, double length) {
    _drawBox(
      canvas,
      x,
      z,
      length,
      1.05,
      .55,
      const Color(0xff9d633a),
      top: const Color(0xffe1a25f),
    );
    _drawBox(canvas, x, z + .82, length, .22, .75, const Color(0xffb67842));
  }

  void _drawSaunaStove(Canvas canvas, double x, double z, int quality) {
    _drawBox(
      canvas,
      x,
      z,
      1.05,
      1.05,
      .9,
      const Color(0xff354248),
      top: const Color(0xff5b6060),
    );
    for (var index = 0; index < 7; index++) {
      final stone = projector.project(
        IsoWorldPoint(
          x + .2 + index % 3 * .28,
          z + .2 + index ~/ 3 * .28,
          1 + (index % 2) * .1,
        ),
      );
      canvas.drawCircle(
        stone,
        6,
        _solid(
          quality >= 3 && index.isEven
              ? const Color(0xffff8d54)
              : const Color(0xff7b7770),
        ),
      );
    }
  }

  void _drawMassage(Canvas canvas, RoomSnapshot? room) {
    if (room == null || !room.unlocked) return;
    final capacity = room.upgrades.capacity;
    final quality = room.upgrades.quality;
    // The simulation guest spots sit directly on these beds, so customers do
    // not appear detached from the service furniture.
    _drawMassageBed(canvas, 1.2, -9.1, quality);
    if (capacity >= 2) _drawMassageBed(canvas, 5.25, -9.1, quality);
    _drawBox(
      canvas,
      3.1,
      -15.8,
      4.2,
      .75,
      1.25,
      const Color(0xff6c5140),
      top: const Color(0xffffdba6),
    );
    for (var index = 0; index < math.min(5, quality + 2); index++) {
      _drawBottle(
        canvas,
        3.55 + index * .63,
        -14.98,
        .75,
        index.isEven ? const Color(0xff9de2c2) : const Color(0xffffb37b),
      );
    }
    _drawPlant(canvas, 9.6, -15.5, quality);
    _drawPlant(canvas, 1, -15.3, quality);
    _drawRoomStaff(canvas, room, 9.7, -8.2, const Color(0xffb9efc7));
  }

  void _drawMassageBed(Canvas canvas, double x, double z, int quality) {
    _drawBox(
      canvas,
      x,
      z,
      3.2,
      1.42,
      .68,
      const Color(0xff715342),
      top: quality >= 3 ? const Color(0xffffe0b3) : const Color(0xffdcbf99),
    );
    _drawBox(
      canvas,
      x + .15,
      z + .2,
      .75,
      1,
      .18,
      const Color(0xfff4eee1),
      baseHeight: .66,
    );
    final candleCount = math.min(4, quality);
    for (var index = 0; index < candleCount; index++) {
      final point = projector.project(
        IsoWorldPoint(x + .6 + index * .6, z - .2, .35),
      );
      canvas.drawCircle(
        point,
        4 + math.sin(_time * 4 + index).abs() * 2,
        _solid(const Color(0x99ffd166)),
      );
    }
  }

  void _drawPlant(Canvas canvas, double x, double z, int quality) {
    _drawBox(
      canvas,
      x - .3,
      z - .3,
      .6,
      .6,
      .5,
      const Color(0xffe7cf9d),
      top: const Color(0xff644f37),
    );
    final leaves = 4 + math.min(quality, 4);
    for (var index = 0; index < leaves; index++) {
      final angle = index / leaves * math.pi * 2 + math.sin(_time * .6) * .05;
      final leaf = projector.project(
        IsoWorldPoint(
          x + math.cos(angle) * .35,
          z + math.sin(angle) * .35,
          .65 + (index % 3) * .28,
        ),
      );
      canvas.drawOval(
        Rect.fromCenter(center: leaf, width: 16, height: 9),
        _solid(
          index.isEven ? const Color(0xff48b576) : const Color(0xff277b58),
        ),
      );
    }
  }

  void _drawRoomStaff(
    Canvas canvas,
    RoomSnapshot room,
    double x,
    double z,
    Color accent,
  ) {
    final working =
        room.staffState == RoomStaffState.serving ||
        room.staffState == RoomStaffState.welcoming;
    final bob = working ? math.sin(_time * 5) * 3 : math.sin(_time * 1.4) * 1.5;
    _drawPerson(
      canvas,
      projector.project(IsoWorldPoint(x, z)),
      primary: accent,
      secondary: const Color(0xff153f48),
      skin: const Color(0xffffc99f),
      bob: bob,
      phase: _time * 3,
      opacity: 1,
      badge: working ? '★' : null,
    );
  }

  void _drawActors(Canvas canvas, GameSnapshot snapshot) {
    final visuals = _actors.values.toList()
      ..sort((a, b) => (a.x + a.z).compareTo(b.x + b.z));
    for (final visual in visuals) {
      final moving =
          (visual.x - visual.previousX).abs() +
              (visual.z - visual.previousZ).abs() >
          .002;
      final phase = _time * (moving ? 8 : 2.1) + visual.id.hashCode * .01;
      final bob = moving ? math.sin(phase) * 3.4 : math.sin(phase) * 1.1;
      final world = projector.project(IsoWorldPoint(visual.x, visual.z));

      if (visual.bartender) {
        final moveLevel = snapshot.upgrades.moveSpeed;
        if (moving && moveLevel > 1) {
          for (var index = 1; index <= math.min(moveLevel, 5); index++) {
            final trail = projector.project(
              IsoWorldPoint(
                visual.x - (visual.x - visual.previousX) * index * 7,
                visual.z - (visual.z - visual.previousZ) * index * 7,
              ),
            );
            canvas.drawCircle(
              trail + Offset(0, -25 - index * 2),
              5 - index * .55,
              _solid(const Color(0xff66ffe0).withValues(alpha: .24 / index)),
            );
          }
        }
        _drawPerson(
          canvas,
          world,
          primary: const Color(0xff0e7c82),
          secondary: const Color(0xffffc456),
          skin: const Color(0xffffc694),
          bob: bob,
          phase: phase,
          opacity: visual.opacity,
          badge: _bartenderBadge(visual.state, visual.carrying),
          apron: true,
        );
      } else {
        final palette = _patronPalettes[visual.palette];
        _drawPerson(
          canvas,
          world,
          primary: palette.$1,
          secondary: palette.$2,
          skin: palette.$3,
          bob: bob,
          phase: phase,
          opacity: visual.opacity,
          badge: _patronBadge(visual.state, visual.carrying),
        );
        if (visual.happiness < .35) {
          _drawPatience(canvas, world + const Offset(0, -81), visual.happiness);
        }
      }
    }
  }

  void _drawPerson(
    Canvas canvas,
    Offset floor, {
    required Color primary,
    required Color secondary,
    required Color skin,
    required double bob,
    required double phase,
    required double opacity,
    String? badge,
    bool apron = false,
  }) {
    Color faded(Color color) => color.withValues(alpha: color.a * opacity);
    canvas.drawOval(
      Rect.fromCenter(
        center: floor + const Offset(0, 3),
        width: 38,
        height: 14,
      ),
      _solid(const Color(0x44000000).withValues(alpha: .27 * opacity)),
    );
    final hip = floor + Offset(0, -25 + bob);
    final footSwing = math.sin(phase) * 5;
    final limbPaint = Paint()
      ..color = faded(const Color(0xff173a45))
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(hip, floor + Offset(-5 + footSwing, -2), limbPaint);
    canvas.drawLine(hip, floor + Offset(5 - footSwing, -2), limbPaint);
    final body = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: floor + Offset(0, -39 + bob),
        width: 27,
        height: 35,
      ),
      const Radius.circular(10),
    );
    canvas.drawRRect(body, _solid(faded(primary)));
    if (apron) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: floor + Offset(0, -34 + bob),
            width: 20,
            height: 22,
          ),
          const Radius.circular(5),
        ),
        _solid(faded(secondary)),
      );
    }
    final armPaint = Paint()
      ..color = faded(skin)
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;
    final armSwing = math.sin(phase) * 6;
    canvas.drawLine(
      floor + Offset(-13, -45 + bob),
      floor + Offset(-19, -32 + bob + armSwing),
      armPaint,
    );
    canvas.drawLine(
      floor + Offset(13, -45 + bob),
      floor + Offset(19, -32 + bob - armSwing),
      armPaint,
    );
    final head = floor + Offset(0, -67 + bob);
    canvas.drawCircle(head, 13, _solid(faded(skin)));
    final hairRect = RRect.fromRectAndCorners(
      Rect.fromLTWH(head.dx - 13, head.dy - 13, 26, 11),
      topLeft: const Radius.circular(12),
      topRight: const Radius.circular(12),
    );
    canvas.drawRRect(hairRect, _solid(faded(secondary)));
    canvas.drawCircle(
      head + const Offset(-4.5, 1),
      1.4,
      _solid(faded(const Color(0xff20323a))),
    );
    canvas.drawCircle(
      head + const Offset(4.5, 1),
      1.4,
      _solid(faded(const Color(0xff20323a))),
    );
    if (badge != null) {
      final bubble = head + const Offset(21, -19);
      canvas.drawCircle(bubble, 13, _solid(faded(const Color(0xfff8f1d3))));
      _drawText(
        canvas,
        badge,
        bubble,
        color: faded(const Color(0xff123944)),
        size: 14,
        weight: FontWeight.w800,
        center: true,
      );
    }
  }

  String? _bartenderBadge(String state, bool carrying) {
    if (carrying) return '★';
    if (state.contains('clean')) return '✦';
    if (state.contains('prepar')) return '⚗';
    if (state.contains('order')) return '✎';
    return null;
  }

  String? _patronBadge(String state, bool carrying) {
    if (state == PatronState.waitingOrder.name) return '…';
    if (state == PatronState.waitingDrink.name) return '⌛';
    if (state == PatronState.readyToPay.name ||
        state == PatronState.paying.name) {
      return '₽';
    }
    if (state == PatronState.walkingToRoom.name) return '→';
    if (state == PatronState.inRoom.name) return '♥';
    if (carrying) return '♦';
    return null;
  }

  void _drawPatience(Canvas canvas, Offset center, double happiness) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: center, width: 34, height: 7),
      const Radius.circular(4),
    );
    canvas.drawRRect(rect, _solid(const Color(0xaa1a2427)));
    final fillWidth = (30 * happiness.clamp(0, 1)).toDouble();
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(center.dx - 15, center.dy - 2, fillWidth, 4),
        const Radius.circular(3),
      ),
      _solid(
        happiness < .18 ? const Color(0xffff5a54) : const Color(0xffffb347),
      ),
    );
  }

  void _drawRoomProgress(Canvas canvas, GameSnapshot snapshot) {
    const centers = {
      RoomId.karaoke: IsoWorldPoint(-14.5, .9, 2.45),
      RoomId.sauna: IsoWorldPoint(14.5, .8, 2.45),
      RoomId.massage: IsoWorldPoint(5.5, -11.6, 2.45),
    };
    const accents = {
      RoomId.karaoke: Color(0xffff6daf),
      RoomId.sauna: Color(0xffffc467),
      RoomId.massage: Color(0xffbaf1c7),
    };
    for (final room in snapshot.rooms) {
      if (!room.unlocked || room.guests <= 0) continue;
      final center = projector.project(centers[room.id]!);
      final progressRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: center, width: 92, height: 14),
        const Radius.circular(8),
      );
      canvas.drawRRect(progressRect, _solid(const Color(0xdd0c3038)));
      final width = (84 * room.progress.clamp(0, 1)).toDouble();
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(center.dx - 42, center.dy - 4, width, 8),
          const Radius.circular(5),
        ),
        _solid(accents[room.id]!),
      );
      _drawText(
        canvas,
        '${room.guests}/${room.capacity}',
        center + const Offset(0, -14),
        color: const Color(0xffffffff),
        size: 12,
        weight: FontWeight.w800,
        center: true,
      );
    }
  }

  void _drawForegroundTrim(Canvas canvas) {
    // Low front edges define every room without hiding furniture.
    for (final entry in const [
      (barBounds, Color(0xfff2bd62)),
      (karaokeBounds, Color(0xffff6eb4)),
      (saunaBounds, Color(0xffffc96b)),
      (massageBounds, Color(0xffffd59b)),
    ]) {
      final rect = entry.$1;
      _drawBox(
        canvas,
        rect.left,
        rect.bottom - .14,
        rect.right - rect.left,
        .14,
        .14,
        entry.$2,
      );
      _drawBox(
        canvas,
        rect.right - .14,
        rect.top,
        .14,
        rect.bottom - rect.top,
        .14,
        entry.$2,
      );
    }
  }

  void _drawSparkles(
    Canvas canvas,
    double x,
    double z, {
    required int count,
    required Color color,
    required double spread,
    bool upward = false,
  }) {
    for (var index = 0; index < count; index++) {
      final phase = (_time * (upward ? .32 : .18) + index * .618) % 1;
      final angle = index * 2.399 + _time * .3;
      final point = projector.project(
        IsoWorldPoint(
          x + math.cos(angle) * spread * (.25 + phase * .75),
          z + math.sin(angle) * spread * (.25 + phase * .75),
          .7 + (upward ? phase * 1.8 : math.sin(phase * math.pi) * .8),
        ),
      );
      final radius = 2.2 + math.sin(phase * math.pi) * 2.8;
      canvas.drawCircle(
        point,
        radius,
        _solid(color.withValues(alpha: .2 + (1 - phase) * .55)),
      );
    }
  }

  void _drawText(
    Canvas canvas,
    String text,
    Offset position, {
    required Color color,
    required double size,
    FontWeight weight = FontWeight.w600,
    bool center = false,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: weight,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final offset = center
        ? position - Offset(painter.width * .5, painter.height * .5)
        : position;
    painter.paint(canvas, offset);
  }

  Color _shade(Color color, double amount) {
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withLightness((hsl.lightness + amount).clamp(0, 1).toDouble())
        .toColor();
  }

  Color _mix(Color a, Color b, double amount) => Color.lerp(a, b, amount)!;
}

enum _DoorSide { none, east, west, south }

class _ActorVisual {
  _ActorVisual({
    required this.id,
    required this.x,
    required this.z,
    required this.targetX,
    required this.targetZ,
    required this.palette,
    this.bartender = false,
  }) : previousX = x,
       previousZ = z;

  final String id;
  final int palette;
  final bool bartender;
  double x;
  double z;
  double targetX;
  double targetZ;
  double previousX;
  double previousZ;
  double opacity = 1;
  double happiness = 1;
  String state = '';
  bool carrying = false;
  RoomId? roomId;
}

const _patronPalettes = <(Color, Color, Color)>[
  (Color(0xffef6a55), Color(0xff52354d), Color(0xffffc89e)),
  (Color(0xff43a99d), Color(0xff243f55), Color(0xffa96d4b)),
  (Color(0xfff0b449), Color(0xff6b3c2f), Color(0xfff3b47e)),
  (Color(0xff8b76d8), Color(0xff2f3158), Color(0xff8a553d)),
  (Color(0xff4e9ed5), Color(0xff5b3043), Color(0xffffd0aa)),
  (Color(0xffdf6ca6), Color(0xff303b4b), Color(0xffc8865f)),
];
