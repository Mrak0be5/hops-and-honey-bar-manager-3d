import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_3d/domain/bar_simulation.dart';

void main() {
  final obstacles = makeLevelObstacles(
    tableLayout.map((table) => table.position),
  );

  test('A* reaches all room guest spots through connected walkable space', () {
    for (final entry in roomLayouts.entries) {
      for (final destination in entry.value.guestSpots) {
        final path = findGridPath(entrance, destination, obstacles);
        expect(path, isNotEmpty, reason: '${entry.key.name}: $destination');
        expect(path.last, destination);
        for (final point in path) {
          expect(
            isWalkable(
              point,
              obstacles,
              allowedEndpoints: [entrance, destination],
            ),
            isTrue,
            reason: '${entry.key.name}: non-walkable $point',
          );
        }
      }
    }
  });

  test('bar routes go around the counter and tables', () {
    final target = tableLayout.first.service;
    final path = findGridPath(barStation, target, obstacles);
    expect(path, isNotEmpty);
    final counter = staticObstacles.first as RectObstacle;
    expect(path.where((point) => counter.contains(point, 0.26)), isEmpty);
  });

  test('void between disconnected footprints is not walkable', () {
    expect(isInsideWalkableZone(const Vec2(-8.05, 4.9)), isFalse);
    expect(isInsideWalkableZone(const Vec2(9.0, -5.5)), isFalse);
  });
}
