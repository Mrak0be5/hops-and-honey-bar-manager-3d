import 'dart:math' as math;

import 'game_config.dart';
import 'models.dart';

const navCellSize = 0.4;
const roomNavigationInset = 0.28;
const _connectorLongitudinalPadding = 0.3;
const _connectorEdgeInset = 0.43;

class WalkableZone {
  const WalkableZone(this.minX, this.maxX, this.minZ, this.maxZ);

  final double minX;
  final double maxX;
  final double minZ;
  final double maxZ;

  bool contains(Vec2 point) =>
      point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ;
}

sealed class NavObstacle {
  const NavObstacle();

  bool contains(Vec2 point, double clearance);
}

class RectObstacle extends NavObstacle {
  const RectObstacle(this.minX, this.maxX, this.minZ, this.maxZ);

  final double minX;
  final double maxX;
  final double minZ;
  final double maxZ;

  @override
  bool contains(Vec2 point, double clearance) =>
      point.x > minX - clearance &&
      point.x < maxX + clearance &&
      point.z > minZ - clearance &&
      point.z < maxZ + clearance;
}

class CircleObstacle extends NavObstacle {
  const CircleObstacle(this.x, this.z, this.radius);

  final double x;
  final double z;
  final double radius;

  @override
  bool contains(Vec2 point, double clearance) =>
      math.sqrt(math.pow(point.x - x, 2) + math.pow(point.z - z, 2)) <
      radius + clearance;
}

const _mainBarZone = WalkableZone(-7.78, 7.78, -5.78, 5.78);

List<WalkableZone> _makeWalkableZones() {
  final result = <WalkableZone>[_mainBarZone];
  for (final layout in roomLayouts.values) {
    result.add(
      WalkableZone(
        layout.minX + roomNavigationInset,
        layout.maxX - roomNavigationInset,
        layout.minZ + roomNavigationInset,
        layout.maxZ - roomNavigationInset,
      ),
    );
    final connectorHalfWidth = layout.connectorWidth / 2 - _connectorEdgeInset;
    switch (layout.connectionSide) {
      case RoomConnectionSide.south:
        result.add(
          WalkableZone(
            math.min(layout.barPortal.x, layout.roomPortal.x) -
                connectorHalfWidth,
            math.max(layout.barPortal.x, layout.roomPortal.x) +
                connectorHalfWidth,
            math.min(layout.barPortal.z, layout.roomPortal.z) -
                _connectorLongitudinalPadding,
            math.max(layout.barPortal.z, layout.roomPortal.z) +
                _connectorLongitudinalPadding,
          ),
        );
      case RoomConnectionSide.east || RoomConnectionSide.west:
        result.add(
          WalkableZone(
            math.min(layout.barPortal.x, layout.roomPortal.x) -
                _connectorLongitudinalPadding,
            math.max(layout.barPortal.x, layout.roomPortal.x) +
                _connectorLongitudinalPadding,
            math.min(layout.barPortal.z, layout.roomPortal.z) -
                connectorHalfWidth,
            math.max(layout.barPortal.z, layout.roomPortal.z) +
                connectorHalfWidth,
          ),
        );
    }
  }
  return List.unmodifiable(result);
}

final List<WalkableZone> levelWalkableZones = _makeWalkableZones();

final double navMinX =
    levelWalkableZones.map((zone) => zone.minX).reduce(math.min) - navCellSize;
final double navMaxX =
    levelWalkableZones.map((zone) => zone.maxX).reduce(math.max) + navCellSize;
final double navMinZ =
    levelWalkableZones.map((zone) => zone.minZ).reduce(math.min) - navCellSize;
final double navMaxZ =
    levelWalkableZones.map((zone) => zone.maxZ).reduce(math.max) + navCellSize;

const List<NavObstacle> _barObstacles = [
  RectObstacle(-3.65, 3.05, -4.28, -2.88),
  CircleObstacle(-6.9, -4.9, 0.68),
  CircleObstacle(6.7, -4.9, 0.62),
  CircleObstacle(-6.95, 5.05, 0.58),
];

final Map<RoomId, List<NavObstacle>> roomFurnitureObstacles =
    Map<RoomId, List<NavObstacle>>.unmodifiable({
      RoomId.karaoke: List<NavObstacle>.unmodifiable(_karaokeObstacles()),
      RoomId.sauna: List<NavObstacle>.unmodifiable(_saunaObstacles()),
      RoomId.massage: List<NavObstacle>.unmodifiable(_massageObstacles()),
    });

final List<NavObstacle> staticObstacles = List.unmodifiable([
  ..._barObstacles,
  ...roomFurnitureObstacles.values.expand((obstacles) => obstacles),
]);

List<NavObstacle> _karaokeObstacles() {
  final layout = roomLayouts[RoomId.karaoke]!;
  return [
    _roomRect(layout, const Vec2(-0.35, -3.25), 5.7, 2.15),
    for (var index = 0; index < 3; index += 1)
      _roomRect(layout, Vec2(-2.3 + index * 2.25, 2.22), 1.72, 1.05),
    for (var index = 0; index < 5; index += 1)
      _roomCircle(
        layout,
        Vec2(index.isEven ? -3.65 : 3.2, -3.75 + (index ~/ 2) * 1.18),
        0.46,
      ),
  ];
}

List<NavObstacle> _saunaObstacles() {
  final layout = roomLayouts[RoomId.sauna]!;
  return [
    for (final z in [-3.7, -2.25]) _roomRect(layout, Vec2(0.3, z), 6.7, 1),
    _roomCircle(layout, const Vec2(-3.15, 2.9), 0.68),
  ];
}

List<NavObstacle> _massageObstacles() {
  final layout = roomLayouts[RoomId.massage]!;
  return [
    for (final x in [-1.85, 1.85]) _roomRect(layout, Vec2(x, -0.45), 1.45, 2.7),
    _roomRect(layout, const Vec2(0.1, -4.65), 2.4, 0.68),
    for (final x in [-3.35, 3.35]) _roomCircle(layout, Vec2(x, -3.85), 0.48),
  ];
}

RectObstacle _roomRect(
  RoomLayout layout,
  Vec2 localCenter,
  double width,
  double depth,
) {
  final center = Vec2(
    layout.center.x + localCenter.x,
    layout.center.z + localCenter.z,
  );
  return RectObstacle(
    center.x - width / 2,
    center.x + width / 2,
    center.z - depth / 2,
    center.z + depth / 2,
  );
}

CircleObstacle _roomCircle(
  RoomLayout layout,
  Vec2 localCenter,
  double radius,
) => CircleObstacle(
  layout.center.x + localCenter.x,
  layout.center.z + localCenter.z,
  radius,
);

List<NavObstacle> makeLevelObstacles(Iterable<Vec2> tablePositions) =>
    List.unmodifiable([
      ...staticObstacles,
      ...tablePositions.map(
        (position) => CircleObstacle(position.x, position.z, 0.82),
      ),
    ]);

bool isInsideWalkableZone(Vec2 point) =>
    levelWalkableZones.any((zone) => zone.contains(point));

bool isWalkable(
  Vec2 point,
  List<NavObstacle> obstacles, {
  double clearance = 0.26,
  List<Vec2> allowedEndpoints = const [],
}) {
  if (point.x < navMinX ||
      point.x > navMaxX ||
      point.z < navMinZ ||
      point.z > navMaxZ) {
    return false;
  }
  if (!isInsideWalkableZone(point)) return false;
  if (allowedEndpoints.any((endpoint) => _distance(endpoint, point) <= 0.05)) {
    return true;
  }
  return !obstacles.any((obstacle) => obstacle.contains(point, clearance));
}

List<Vec2> findGridPath(Vec2 start, Vec2 goal, List<NavObstacle> obstacles) {
  final endpoints = [start, goal];
  final startCell = _nearestWalkableCell(start, obstacles, endpoints);
  final goalCell = _nearestWalkableCell(goal, obstacles, endpoints);
  if (startCell == null || goalCell == null) return const [];

  final startKey = startCell.key;
  final open = <String>{startKey};
  final cells = <String, _Cell>{startKey: startCell};
  final cameFrom = <String, String>{};
  final gScore = <String, double>{startKey: 0};
  final fScore = <String, double>{startKey: _cellDistance(startCell, goalCell)};

  const directions = [
    _Cell(-1, -1),
    _Cell(0, -1),
    _Cell(1, -1),
    _Cell(-1, 0),
    _Cell(1, 0),
    _Cell(-1, 1),
    _Cell(0, 1),
    _Cell(1, 1),
  ];

  while (open.isNotEmpty) {
    var currentKey = open.first;
    for (final candidate in open) {
      if ((fScore[candidate] ?? double.infinity) <
          (fScore[currentKey] ?? double.infinity)) {
        currentKey = candidate;
      }
    }
    final current = cells[currentKey]!;
    if (current == goalCell) {
      final route = <String>[currentKey];
      while (cameFrom.containsKey(route.last)) {
        route.add(cameFrom[route.last]!);
      }
      final points = route.reversed
          .skip(1)
          .map((key) => _toWorld(cells[key]!))
          .toList();
      if (points.isEmpty || _distance(points.last, goal) > 0.01) {
        points.add(goal);
      } else {
        points[points.length - 1] = goal;
      }
      return List.unmodifiable(points);
    }

    open.remove(currentKey);
    for (final direction in directions) {
      final neighbor = _Cell(current.x + direction.x, current.z + direction.z);
      if (!_canTraverse(current, neighbor, obstacles, endpoints)) continue;
      final neighborKey = neighbor.key;
      cells[neighborKey] = neighbor;
      final stepCost = direction.x != 0 && direction.z != 0 ? math.sqrt2 : 1.0;
      final tentative = (gScore[currentKey] ?? double.infinity) + stepCost;
      if (tentative >= (gScore[neighborKey] ?? double.infinity)) continue;
      cameFrom[neighborKey] = currentKey;
      gScore[neighborKey] = tentative;
      fScore[neighborKey] = tentative + _cellDistance(neighbor, goalCell);
      open.add(neighborKey);
    }
  }
  return const [];
}

class _Cell {
  const _Cell(this.x, this.z);

  final int x;
  final int z;
  String get key => '$x,$z';

  @override
  bool operator ==(Object other) =>
      other is _Cell && other.x == x && other.z == z;

  @override
  int get hashCode => Object.hash(x, z);
}

_Cell _toCell(Vec2 point) => _Cell(
  ((point.x - navMinX) / navCellSize).round(),
  ((point.z - navMinZ) / navCellSize).round(),
);

Vec2 _toWorld(_Cell cell) =>
    Vec2(navMinX + cell.x * navCellSize, navMinZ + cell.z * navCellSize);

_Cell? _nearestWalkableCell(
  Vec2 point,
  List<NavObstacle> obstacles,
  List<Vec2> endpoints,
) {
  final origin = _toCell(point);
  for (var radius = 0; radius <= 12; radius += 1) {
    for (var dz = -radius; dz <= radius; dz += 1) {
      for (var dx = -radius; dx <= radius; dx += 1) {
        if (math.max(dx.abs(), dz.abs()) != radius) continue;
        final cell = _Cell(origin.x + dx, origin.z + dz);
        if (isWalkable(
          _toWorld(cell),
          obstacles,
          allowedEndpoints: endpoints,
        )) {
          return cell;
        }
      }
    }
  }
  return null;
}

bool _canTraverse(
  _Cell from,
  _Cell to,
  List<NavObstacle> obstacles,
  List<Vec2> endpoints,
) {
  final fromWorld = _toWorld(from);
  final toWorld = _toWorld(to);
  if (!_isWalkableSegment(fromWorld, toWorld, obstacles, endpoints)) {
    return false;
  }
  final dx = to.x - from.x;
  final dz = to.z - from.z;
  if (dx != 0 && dz != 0) {
    if (!isWalkable(
      _toWorld(_Cell(from.x + dx, from.z)),
      obstacles,
      allowedEndpoints: endpoints,
    )) {
      return false;
    }
    if (!isWalkable(
      _toWorld(_Cell(from.x, from.z + dz)),
      obstacles,
      allowedEndpoints: endpoints,
    )) {
      return false;
    }
  }
  return true;
}

bool _isWalkableSegment(
  Vec2 from,
  Vec2 to,
  List<NavObstacle> obstacles,
  List<Vec2> endpoints,
) {
  final distance = _distance(from, to);
  final samples = math.max(1, (distance / 0.05).ceil());
  for (var index = 1; index <= samples; index += 1) {
    final t = index / samples;
    if (!isWalkable(
      Vec2(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t),
      obstacles,
      allowedEndpoints: endpoints,
    )) {
      return false;
    }
  }
  return true;
}

double _distance(Vec2 a, Vec2 b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));

double _cellDistance(_Cell a, _Cell b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));
