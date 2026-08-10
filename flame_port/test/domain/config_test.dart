import 'package:flutter_test/flutter_test.dart';
import 'package:hops_and_honey_flame/domain/bar_simulation.dart';

void main() {
  group('ported balance contract', () {
    test('room prices and upgrade bases match the TypeScript game', () {
      expect(roomDefinition(RoomId.karaoke).unlockCost, 230);
      expect(roomDefinition(RoomId.sauna).unlockCost, 750);
      expect(roomDefinition(RoomId.massage).unlockCost, 1500);

      expect(
        roomDefinition(
          RoomId.karaoke,
        ).upgradeBaseCosts[RoomUpgradeKey.capacity],
        140,
      );
      expect(
        roomDefinition(RoomId.sauna).upgradeBaseCosts[RoomUpgradeKey.capacity],
        320,
      );
      expect(
        roomDefinition(
          RoomId.massage,
        ).upgradeBaseCosts[RoomUpgradeKey.capacity],
        650,
      );
      expect(
        roomDefinition(
          RoomId.massage,
        ).upgradeBaseCosts[RoomUpgradeKey.staffSpeed],
        110,
      );
    });

    test('bar upgrade costs and exact action formulas match', () {
      expect(getUpgradeCost(UpgradeKey.moveSpeed, 1), 38);
      expect(getUpgradeCost(UpgradeKey.moveSpeed, 2), 58);
      expect(getUpgradeCost(UpgradeKey.orderSpeed, 1), 44);
      expect(getUpgradeCost(UpgradeKey.prepSpeed, 1), 52);
      expect(getUpgradeCost(UpgradeKey.cleanSpeed, 1), 35);
      expect(getUpgradeCost(UpgradeKey.assortment, 1), 92);
      expect(getUpgradeCost(UpgradeKey.advertising, 1), 4);

      expect(getBartenderMoveSpeed(1), closeTo(2.15, 1e-10));
      expect(getBartenderMoveSpeed(2), closeTo(2.494, 1e-10));
      expect(getOrderDuration(2), closeTo(2.15 * 0.83, 1e-10));
      expect(getPreparationDuration(2), closeTo(3.35 * 0.82, 1e-10));
      expect(getCleaningDuration(2), closeTo(2.65 * 0.8, 1e-10));
      expect(getArrivalInterval(2), closeTo(8.68, 1e-10));
    });

    test('room formulas retain growth, quality, and staff effects', () {
      expect(
        getRoomUpgradeCost(RoomId.karaoke, RoomUpgradeKey.capacity, 2),
        227,
      );
      expect(
        getRoomUpgradeCost(RoomId.karaoke, RoomUpgradeKey.quality, 2),
        102,
      );
      expect(getRoomProfit(RoomId.karaoke, 1, 3), 60);
      expect(getRoomProfit(RoomId.karaoke, 2, 3), 69);
      expect(
        getRoomSessionDuration(RoomId.sauna, 2),
        closeTo(42 * 0.85, 1e-10),
      );
      expect(getRoomGroupWindow(4), 14);
      expect(getDayBonus(400), 60);
    });

    test('all player-facing configuration text is valid UTF-8 Russian', () {
      final text = [
        ...drinks.map((item) => item.name),
        ...upgradeDefinitions.expand((item) => [item.name, item.description]),
        ...roomDefinitions.values.expand(
          (item) => [item.name, item.shortName, item.staffRole],
        ),
      ].join(' ');
      for (final marker in const ['РЎ', 'Рµ', 'Рѕ', 'Р°', 'СЃ', 'С‹']) {
        expect(
          text,
          isNot(contains(marker)),
          reason: 'mojibake marker: $marker',
        );
      }
      expect(text, contains('Солнечный лагер'));
      expect(text, contains('Караоке-зал'));
    });
  });
}
