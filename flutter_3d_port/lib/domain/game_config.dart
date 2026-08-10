import 'dart:math' as math;

import 'models.dart';

const entrance = Vec2(7.15, 4.5);
const entryAisle = Vec2(5.35, 3.45);
const barStation = Vec2(-1.25, -4.72);
const serviceGate = Vec2(3.55, -3.2);

const shiftDuration = 150.0;
const dayBonusCap = 60;
const dayBonusRate = 0.2;
const roomMinWelcomeDuration = 0.8;
const roomResetDuration = 1.15;
const roomCooldownDuration = 2.4;
const roomStaffTimeFactor = 0.85;
const barActionMaxLevel = 6;
const guestChairOffset = 1.16;

int getDayBonus(int shiftOperatingRevenue) => math.min(
  dayBonusCap,
  math.max(0, (shiftOperatingRevenue * dayBonusRate).round()),
);

class TableSeed {
  const TableSeed({
    required this.id,
    required this.position,
    required this.seat,
    required this.service,
  });

  final int id;
  final Vec2 position;
  final Vec2 seat;
  final Vec2 service;
}

TableSeed _table(int id, double x, double z) => TableSeed(
  id: id,
  position: Vec2(x, z),
  seat: Vec2(x, z + guestChairOffset),
  service: Vec2(x + 1.18, z - 0.08),
);

final List<TableSeed> tableLayout = List.unmodifiable([
  _table(0, -4.75, -0.45),
  _table(1, -1.35, -0.45),
  _table(2, 2.05, -0.45),
  _table(3, -4.75, 3.15),
  _table(4, -1.35, 3.15),
  _table(5, 2.05, 3.15),
]);

const List<DrinkDefinition> drinks = [
  DrinkDefinition(
    id: 'sunny-lager',
    name: 'Солнечный лагер',
    level: 1,
    price: 12,
    color: 0xFFF6AD2F,
    drinkTime: 7.2,
  ),
  DrinkDefinition(
    id: 'pear-cider',
    name: 'Грушевый сидр',
    level: 2,
    price: 17,
    color: 0xFFDFF25B,
    drinkTime: 7.8,
  ),
  DrinkDefinition(
    id: 'velvet-stout',
    name: 'Бархатный стаут',
    level: 3,
    price: 23,
    color: 0xFF5D2B27,
    drinkTime: 8.4,
  ),
  DrinkDefinition(
    id: 'berry-ale',
    name: 'Ягодный эль',
    level: 4,
    price: 31,
    color: 0xFFD43C72,
    drinkTime: 9.2,
  ),
  DrinkDefinition(
    id: 'aurora-ipa',
    name: 'Аврора IPA',
    level: 5,
    price: 42,
    color: 0xFFF06D38,
    drinkTime: 10,
  ),
];

const List<UpgradeDefinition> upgradeDefinitions = [
  UpgradeDefinition(
    key: UpgradeKey.moveSpeed,
    name: 'Ловкие ноги',
    description: 'Скорость бармена: +0,34 м/с за уровень.',
    currency: Currency.coins,
    baseCost: 38,
    maxLevel: barActionMaxLevel,
  ),
  UpgradeDefinition(
    key: UpgradeKey.orderSpeed,
    name: 'Быстрый заказ',
    description: 'Приём заказа: −17% времени за уровень.',
    currency: Currency.coins,
    baseCost: 44,
    maxLevel: barActionMaxLevel,
  ),
  UpgradeDefinition(
    key: UpgradeKey.prepSpeed,
    name: 'Шустрый кран',
    description: 'Приготовление: −18% времени за уровень.',
    currency: Currency.coins,
    baseCost: 52,
    maxLevel: barActionMaxLevel,
  ),
  UpgradeDefinition(
    key: UpgradeKey.cleanSpeed,
    name: 'Чистая стойка',
    description: 'Уборка: −20% времени за уровень.',
    currency: Currency.coins,
    baseCost: 35,
    maxLevel: barActionMaxLevel,
  ),
  UpgradeDefinition(
    key: UpgradeKey.assortment,
    name: 'Новые напитки',
    description: 'Открывает напиток и повышает средний чек.',
    currency: Currency.coins,
    baseCost: 92,
    maxLevel: 5,
  ),
  UpgradeDefinition(
    key: UpgradeKey.advertising,
    name: 'Реклама бара',
    description: 'Интервал прихода: −0,82 секунды за уровень.',
    currency: Currency.reputation,
    baseCost: 4,
    maxLevel: 8,
  ),
];

final Map<RoomId, RoomDefinition> roomDefinitions = Map.unmodifiable({
  RoomId.karaoke: const RoomDefinition(
    id: RoomId.karaoke,
    name: 'Караоке-зал',
    shortName: 'Караоке',
    staffRole: 'Ведущий караоке',
    unlockCost: 230,
    baseProfit: 20,
    sessionDuration: 36,
    maxCapacity: 3,
    upgradeBaseCosts: {
      RoomUpgradeKey.staffSpeed: 60,
      RoomUpgradeKey.capacity: 140,
      RoomUpgradeKey.quality: 70,
    },
    color: 0xFF7357D9,
    accent: 0xFFFF74BF,
  ),
  RoomId.sauna: const RoomDefinition(
    id: RoomId.sauna,
    name: 'Финская сауна',
    shortName: 'Сауна',
    staffRole: 'Банщик',
    unlockCost: 750,
    baseProfit: 42,
    sessionDuration: 42,
    maxCapacity: 4,
    upgradeBaseCosts: {
      RoomUpgradeKey.staffSpeed: 110,
      RoomUpgradeKey.capacity: 320,
      RoomUpgradeKey.quality: 130,
    },
    color: 0xFFD97839,
    accent: 0xFFFFD36A,
  ),
  RoomId.massage: const RoomDefinition(
    id: RoomId.massage,
    name: 'Массажный кабинет',
    shortName: 'Массаж',
    staffRole: 'Массажист',
    unlockCost: 1500,
    baseProfit: 70,
    sessionDuration: 45,
    maxCapacity: 2,
    upgradeBaseCosts: {
      RoomUpgradeKey.staffSpeed: 110,
      RoomUpgradeKey.capacity: 650,
      RoomUpgradeKey.quality: 200,
    },
    color: 0xFF2BA99A,
    accent: 0xFFA9F0D8,
  ),
});

final Map<RoomId, RoomLayout> roomLayouts = Map.unmodifiable({
  RoomId.karaoke: RoomLayout(
    center: const Vec2(-14.1, 1.5),
    size: const Vec2(11.2, 11),
    connectionSide: RoomConnectionSide.east,
    barPortal: const Vec2(-7.86, 1.5),
    roomPortal: const Vec2(-8.6, 1.5),
    connectorWidth: 3.1,
    guestSpots: const [
      Vec2(-12.25, 1.2),
      Vec2(-14.05, 1.35),
      Vec2(-15.85, 1.5),
    ],
    staffSpot: const Vec2(-10.55, 3.9),
  ),
  RoomId.sauna: RoomLayout(
    center: const Vec2(14.1, 1),
    size: const Vec2(11.2, 11),
    connectionSide: RoomConnectionSide.west,
    barPortal: const Vec2(7.86, 1),
    roomPortal: const Vec2(8.6, 1),
    connectorWidth: 3.1,
    guestSpots: const [
      Vec2(12.05, 1.45),
      Vec2(13.4, 1.6),
      Vec2(14.75, 1.55),
      Vec2(15.9, 2.55),
    ],
    staffSpot: const Vec2(16.65, 3.4),
  ),
  RoomId.massage: RoomLayout(
    center: const Vec2(4.6, -12),
    size: const Vec2(11.2, 10.8),
    connectionSide: RoomConnectionSide.south,
    barPortal: const Vec2(4.8, -5.86),
    roomPortal: const Vec2(5.2, -6.7),
    connectorWidth: 3.2,
    guestSpots: const [Vec2(2.8, -10.45), Vec2(6.4, -10.45)],
    staffSpot: const Vec2(4.85, -9.6),
  ),
});

UpgradeDefinition upgradeDefinition(UpgradeKey key) =>
    upgradeDefinitions.firstWhere((definition) => definition.key == key);

RoomDefinition roomDefinition(RoomId id) => roomDefinitions[id]!;

int getUpgradeCost(UpgradeKey key, int currentLevel) {
  final definition = upgradeDefinition(key);
  if (currentLevel >= definition.maxLevel) return 0;
  final growth = definition.currency == Currency.coins ? 1.52 : 1.45;
  return (definition.baseCost * math.pow(growth, currentLevel - 1)).ceil();
}

int getRoomUpgradeCost(RoomId roomId, RoomUpgradeKey key, int currentLevel) {
  final growth = key == RoomUpgradeKey.capacity ? 1.62 : 1.45;
  return (roomDefinition(roomId).upgradeBaseCosts[key]! *
          math.pow(growth, currentLevel - 1))
      .ceil();
}

int getRoomProfit(RoomId roomId, int qualityLevel, int guests) =>
    (roomDefinition(roomId).baseProfit *
            guests *
            (1 + (qualityLevel - 1) * 0.15))
        .round();

int _normalizedLevel(int level, [int? maxLevel]) =>
    math.min(maxLevel ?? 0x7fffffff, math.max(1, level));

double getBartenderMoveSpeed(int level) =>
    2.15 * (1 + (_normalizedLevel(level, barActionMaxLevel) - 1) * 0.16);

double getOrderDuration(int level) =>
    2.15 * math.pow(0.83, _normalizedLevel(level, barActionMaxLevel) - 1);

double getPreparationDuration(int level) =>
    3.35 * math.pow(0.82, _normalizedLevel(level, barActionMaxLevel) - 1);

double getCleaningDuration(int level) =>
    2.65 * math.pow(0.8, _normalizedLevel(level, barActionMaxLevel) - 1);

double _roomStaffTimeMultiplier(int level) =>
    math.pow(roomStaffTimeFactor, _normalizedLevel(level, 5) - 1).toDouble();

double getRoomSessionDuration(RoomId roomId, int staffLevel) =>
    roomDefinition(roomId).sessionDuration *
    _roomStaffTimeMultiplier(staffLevel);

double getRoomResetDuration(int staffLevel) =>
    roomResetDuration * _roomStaffTimeMultiplier(staffLevel);

double getRoomCooldownDuration(int staffLevel) =>
    roomCooldownDuration * _roomStaffTimeMultiplier(staffLevel);

double getRoomGroupWindow(int capacity) =>
    8 + (math.min(4, math.max(1, capacity)) - 1) * 2;

List<DrinkDefinition> getUnlockedDrinks(int assortmentLevel) =>
    List.unmodifiable(drinks.where((drink) => drink.level <= assortmentLevel));

double getAverageDrinkPrice(int assortmentLevel) {
  final unlocked = getUnlockedDrinks(
    _normalizedLevel(assortmentLevel, drinks.length),
  );
  final count = unlocked.length;
  if (count == 0) return drinks.first.price.toDouble();
  const inverseBias = 1 / 0.72;
  var average = 0.0;
  for (var index = 0; index < count; index += 1) {
    final upper = math.pow((index + 1) / count, inverseBias);
    final lower = math.pow(index / count, inverseBias);
    average += unlocked[index].price * (upper - lower);
  }
  return average;
}

double getArrivalInterval(int advertisingLevel) =>
    math.max(3.4, 9.5 - (advertisingLevel - 1) * 0.82);
