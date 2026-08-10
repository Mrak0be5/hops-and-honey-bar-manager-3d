import 'dart:math' as math;

import 'game_config.dart';
import 'models.dart';

const navCellSize = 0.4;
const navMinX = -16.2;
const navMaxX = 16.2;
const navMinZ = -13.4;
const navMaxZ = 5.8;

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
        layout.center.x - layout.size.x / 2 + 0.28,
        layout.center.x + layout.size.x / 2 - 0.28,
        layout.center.z - layout.size.z / 2 + 0.28,
        layout.center.z + layout.size.z / 2 - 0.28,
      ),
    );
    if (layout.connectionSide == 'south') {
      result.add(
        WalkableZone(
          layout.barPortal.x - 1.12,
          layout.barPortal.x + 1.12,
          math.min(layout.barPortal.z, layout.roomPortal.z) - 0.1,
          math.max(layout.barPortal.z, layout.roomPortal.z) + 0.1,
        ),
      );
    } else {
      result.add(
        WalkableZone(
          math.min(layout.barPortal.x, layout.roomPortal.x) - 0.1,
          math.max(layout.barPortal.x, layout.roomPortal.x) + 0.1,
          layout.barPortal.z - 1.12,
          layout.barPortal.z + 1.12,
        ),
      );
    }
  }
  return List.unmodifiable(result);
}

final List<WalkableZone> levelWalkableZones = _makeWalkableZones();

const List<NavObstacle> staticObstacles = [
  RectObstacle(-3.65, 3.05, -4.28, -2.88),
  CircleObstacle(-6.9, -4.9, 0.68),
  CircleObstacle(6.7, -4.9, 0.62),
  CircleObstacle(-6.95, 5.05, 0.58),
  RectObstacle(-15.35, -9.05, -1.62, 0.25),
  RectObstacle(8.875, 14.125, -2.12, -0.76),
  CircleObstacle(14.75, 1.45, 0.66),
  RectObstacle(1.68, 3.12, -11.6, -8.82),
  RectObstacle(5.28, 6.72, -11.6, -8.82),
  CircleObstacle(1.1, -12.25, 0.45),
  CircleObstacle(7.3, -12.25, 0.45),
  RectObstacle(3.1, 5.3, -12.91, -12.29),
];

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
  if (!isWalkable(_toWorld(to), obstacles, allowedEndpoints: endpoints)) {
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

double _distance(Vec2 a, Vec2 b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));

double _cellDistance(_Cell a, _Cell b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));
