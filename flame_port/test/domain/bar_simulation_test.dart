import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/domain/bar_simulation.dart';

void main() {
  group('BarSimulation', () {
    test('starts with six tables and toggles only between 1x and 2x', () {
      final simulation = BarSimulation();
      expect(simulation.snapshot.started, isFalse);
      expect(simulation.snapshot.tables, hasLength(6));
      expect(simulation.snapshot.coins, 64);
      expect(simulation.toggleSpeed(), 2);
      expect(simulation.snapshot.speedMultiplier, 2);
      expect(simulation.toggleSpeed(), 1);
      simulation.start();
      expect(simulation.snapshot.started, isTrue);
    });

    test('same seed and update sequence produce identical simulation', () {
      final first = BarSimulation(seed: 72)..start();
      final second = BarSimulation(seed: 72)..start();
      _advanceBoth(first, second, 125);
      final a = first.snapshot;
      final b = second.snapshot;
      expect(a.coins, b.coins);
      expect(a.reputation, b.reputation);
      expect(a.served, b.served);
      expect(a.day, b.day);
      expect(a.patrons.length, b.patrons.length);
      expect(a.bartender.state, b.bartender.state);
      expect(a.bartender.position.x, closeTo(b.bartender.position.x, 1e-12));
      expect(a.bartender.position.z, closeTo(b.bartender.position.z, 1e-12));
      expect(a.served, greaterThan(0));
    });

    test('every room receives a real guest only after bar service', () {
      for (final roomId in RoomId.values) {
        final simulation = BarSimulation(seed: 91 + roomId.index);
        simulation.restore(_richSave());
        expect(simulation.purchaseRoom(roomId), isTrue);
        simulation.start();

        PatronSnapshot? assignedGuest;
        for (var step = 0; step < 5000 && assignedGuest == null; step += 1) {
          simulation.update(0.05);
          assignedGuest = simulation.snapshot.patrons
              .where((patron) => patron.roomId == roomId)
              .firstOrNull;
        }
        expect(assignedGuest, isNotNull, reason: roomId.name);
        expect(assignedGuest!.barServed, isTrue, reason: roomId.name);
        expect(simulation.snapshot.served, greaterThanOrEqualTo(1));

        for (
          var step = 0;
          step < 5000 &&
              simulation.snapshot.room(roomId).completedSessions == 0;
          step += 1
        ) {
          simulation.update(0.05);
        }
        final room = simulation.snapshot.room(roomId);
        expect(
          room.completedSessions,
          greaterThanOrEqualTo(1),
          reason: roomId.name,
        );
        expect(
          room.revenue,
          greaterThanOrEqualTo(roomDefinition(roomId).baseProfit),
          reason: roomId.name,
        );
        expect(room.awaitingFirstGuest, isFalse, reason: roomId.name);
      }
    });

    test('purchases use exact currency, limits, and room capacity', () {
      final simulation = BarSimulation()..restore(_richSave());
      final before = simulation.snapshot.coins;
      expect(simulation.purchaseUpgrade(UpgradeKey.moveSpeed), isTrue);
      expect(simulation.snapshot.coins, before - 38);
      expect(simulation.snapshot.upgrades.moveSpeed, 2);

      expect(simulation.purchaseRoom(RoomId.karaoke), isTrue);
      final afterRoom = simulation.snapshot.coins;
      expect(
        simulation.purchaseRoomUpgrade(RoomId.karaoke, RoomUpgradeKey.capacity),
        isTrue,
      );
      expect(simulation.snapshot.coins, afterRoom - 140);
      expect(simulation.snapshot.room(RoomId.karaoke).capacity, 2);
    });

    test('day transition records an honest shift summary', () {
      final simulation = BarSimulation(seed: 12)..start();
      _advance(simulation, 151);
      expect(simulation.snapshot.day, 2);
      final summary = simulation.snapshot.lastShiftSummary;
      expect(summary, isNotNull);
      expect(summary!.dayNumber, 1);
      expect(summary.operatingRevenue, greaterThan(0));
      expect(summary.bonus, getDayBonus(summary.operatingRevenue));
    });

    test('JSON save round-trip preserves durable progression', () {
      final source = BarSimulation()..restore(_richSave());
      expect(source.purchaseRoom(RoomId.karaoke), isTrue);
      expect(source.purchaseUpgrade(UpgradeKey.prepSpeed), isTrue);
      final json = source.exportSaveJson();

      final restored = BarSimulation(seed: 999);
      expect(restored.importSaveJson(json), isTrue);
      expect(restored.snapshot.started, isFalse);
      expect(restored.snapshot.coins, source.snapshot.coins);
      expect(restored.snapshot.reputation, source.snapshot.reputation);
      expect(restored.snapshot.upgrades.prepSpeed, 2);
      expect(restored.snapshot.room(RoomId.karaoke).unlocked, isTrue);
      expect(restored.importSaveJson('{broken'), isFalse);
    });

    test('snapshot telemetry and recommendations are actionable', () {
      final simulation = BarSimulation();
      final snapshot = simulation.snapshot;
      expect(snapshot.barDiagnostics.openTables, 6);
      expect(snapshot.barDiagnostics.primaryBottleneck, BarBottleneck.none);
      expect(snapshot.recommendations, isNotEmpty);
      expect(
        snapshot.recommendations.any(
          (item) =>
              item.kind == RecommendationKind.barUpgrade &&
              item.key == UpgradeKey.assortment.name,
        ),
        isTrue,
      );
      expect(
        snapshot.recommendations.any(
          (item) =>
              item.kind == RecommendationKind.roomUnlock &&
              item.roomId == RoomId.karaoke &&
              item.cost == 230,
        ),
        isTrue,
      );
    });

    test('reset restores the canonical new-game state', () {
      final simulation = BarSimulation()..restore(_richSave());
      simulation
        ..start()
        ..toggleSpeed()
        ..reset();
      expect(simulation.snapshot.started, isFalse);
      expect(simulation.snapshot.speedMultiplier, 1);
      expect(simulation.snapshot.coins, 64);
      expect(simulation.snapshot.reputation, 3);
      expect(simulation.snapshot.rooms.every((room) => !room.unlocked), isTrue);
    });
  });
}

GameSave _richSave() => GameSave(
  coins: 10000,
  reputation: 100,
  served: 0,
  day: 1,
  upgrades: const UpgradeLevels(),
  totalOperatingRevenue: 0,
  totalDayBonus: 0,
  blockedArrivals: 0,
  lastShiftSummary: null,
  rooms: {
    for (final id in RoomId.values)
      id: RoomSave(
        unlocked: false,
        awaitingFirstGuest: false,
        completedSessions: 0,
        revenue: 0,
        upgrades: const RoomUpgradeLevels(),
        recentSessions: const [],
      ),
  },
);

void _advance(BarSimulation simulation, double seconds) {
  for (var step = 0; step < (seconds / 0.05).ceil(); step += 1) {
    simulation.update(0.05);
  }
}

void _advanceBoth(BarSimulation first, BarSimulation second, double seconds) {
  for (var step = 0; step < (seconds / 0.05).ceil(); step += 1) {
    first.update(0.05);
    second.update(0.05);
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}
