import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/domain/bar_simulation.dart';

void main() {
  final obstacles = makeLevelObstacles(
    tableLayout.map((table) => table.position),
  );

  test('shared room layouts match the large 3D room footprints', () {
    expect(roomLayouts.keys, unorderedEquals(RoomId.values));

    _expectLayout(
      RoomId.karaoke,
      center: const Vec2(-14.1, 1.5),
      size: const Vec2(11.2, 11),
      guestSpots: const [
        Vec2(-12.25, 1.2),
        Vec2(-14.05, 1.35),
        Vec2(-15.85, 1.5),
      ],
      staffSpot: const Vec2(-10.55, 3.9),
    );
    _expectLayout(
      RoomId.sauna,
      center: const Vec2(14.1, 1),
      size: const Vec2(11.2, 11),
      guestSpots: const [
        Vec2(12.05, 1.45),
        Vec2(13.4, 1.6),
        Vec2(14.75, 1.55),
        Vec2(15.9, 2.55),
      ],
      staffSpot: const Vec2(16.65, 3.4),
    );
    _expectLayout(
      RoomId.massage,
      center: const Vec2(4.6, -12),
      size: const Vec2(11.2, 10.8),
      guestSpots: const [Vec2(2.8, -10.45), Vec2(6.4, -10.45)],
      staffSpot: const Vec2(4.85, -9.6),
    );
  });

  test('large rendered room interiors are inside navigation bounds', () {
    const representativeFloorPoints = [
      Vec2(-19.0, 6.0),
      Vec2(19.0, 5.8),
      Vec2(9.6, -16.8),
    ];

    for (final point in representativeFloorPoints) {
      expect(isInsideWalkableZone(point), isTrue, reason: '$point');
      expect(isWalkable(point, obstacles), isTrue, reason: '$point');
    }
  });

  test('room furniture blocks navigation while all actor spots stay clear', () {
    const renderedFurniturePoints = [
      Vec2(-14.45, -1.75), // Karaoke stage.
      Vec2(-16.4, 3.72), // Karaoke sofa.
      Vec2(14.4, -2.7), // Sauna benches.
      Vec2(10.95, 3.9), // Sauna stove.
      Vec2(2.75, -12.45), // Massage table.
      Vec2(4.7, -16.65), // Massage cabinet.
    ];

    for (final point in renderedFurniturePoints) {
      expect(isWalkable(point, obstacles), isFalse, reason: '$point');
    }

    for (final layout in roomLayouts.values) {
      for (final point in [...layout.guestSpots, layout.staffSpot]) {
        expect(isWalkable(point, obstacles), isTrue, reason: '$point');
      }
    }
  });

  test(
    'portal routes stay continuously inside floors and clear of furniture',
    () {
      for (final entry in roomLayouts.entries) {
        final layout = entry.value;
        for (final destination in [...layout.guestSpots, layout.staffSpot]) {
          var cursor = entrance;
          for (final stop in [
            layout.barPortal,
            layout.roomPortal,
            destination,
          ]) {
            final path = findGridPath(cursor, stop, obstacles);
            expect(
              path,
              isNotEmpty,
              reason: '${entry.key.name}: $cursor -> $stop',
            );
            _expectContinuousWalkableSegment(cursor, path, obstacles, [
              cursor,
              stop,
            ], reason: entry.key.name);
            cursor = stop;
          }
        }
      }
    },
  );
}

void _expectLayout(
  RoomId id, {
  required Vec2 center,
  required Vec2 size,
  required List<Vec2> guestSpots,
  required Vec2 staffSpot,
}) {
  final layout = roomLayouts[id]!;
  expect(layout.center, center, reason: '${id.name} center');
  expect(layout.size, size, reason: '${id.name} size');
  expect(layout.guestSpots, guestSpots, reason: '${id.name} guest spots');
  expect(layout.staffSpot, staffSpot, reason: '${id.name} staff spot');
}

void _expectContinuousWalkableSegment(
  Vec2 start,
  List<Vec2> path,
  List<NavObstacle> obstacles,
  List<Vec2> endpoints, {
  required String reason,
}) {
  var from = start;
  for (final to in path) {
    final distance = _distance(from, to);
    final samples = (distance / 0.05).ceil();
    for (var index = 1; index <= samples; index += 1) {
      final t = index / samples;
      final point = Vec2(
        from.x + (to.x - from.x) * t,
        from.z + (to.z - from.z) * t,
      );
      expect(
        isWalkable(point, obstacles, allowedEndpoints: endpoints),
        isTrue,
        reason: '$reason: $from -> $to clips at $point',
      );
    }
    from = to;
  }
}

double _distance(Vec2 a, Vec2 b) {
  final dx = b.x - a.x;
  final dz = b.z - a.z;
  return math.sqrt(dx * dx + dz * dz);
}
