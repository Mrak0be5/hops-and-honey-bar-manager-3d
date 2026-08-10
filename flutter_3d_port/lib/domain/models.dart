import 'dart:collection';

enum PatronState {
  walkingIn,
  waitingOrder,
  ordering,
  waitingDrink,
  drinking,
  readyToPay,
  paying,
  walkingToRoom,
  waitingRoom,
  inRoom,
  leaving,
}

enum BartenderState {
  idle,
  toOrder,
  takingOrder,
  toBar,
  preparing,
  toDeliver,
  delivering,
  toPayment,
  takingPayment,
  toCleanup,
  cleaning,
  returningDirty,
}

enum UpgradeKey {
  moveSpeed,
  orderSpeed,
  prepSpeed,
  cleanSpeed,
  assortment,
  advertising,
}

enum Currency { coins, reputation }

enum RoomId { karaoke, sauna, massage }

enum RoomUpgradeKey { staffSpeed, capacity, quality }

enum RoomStaffState { locked, waiting, welcoming, serving, resetting }

enum RoomConnectionSide { east, west, south }

enum BarBottleneck { none, orders, drinks, payments, cleaning, tables }

enum GameEventKind {
  payment,
  reputation,
  upgrade,
  day,
  full,
  roomIncome,
  roomUnlock,
}

enum RecommendationKind { barUpgrade, roomUnlock, roomUpgrade }

extension EnumSaveName on Enum {
  String get saveName => name;
}

T enumByName<T extends Enum>(Iterable<T> values, Object? raw, T fallback) {
  if (raw is! String) return fallback;
  return values.where((value) => value.name == raw).firstOrNull ?? fallback;
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}

class Vec2 {
  const Vec2(this.x, this.z);

  final double x;
  final double z;

  Map<String, Object> toJson() => {'x': x, 'z': z};

  factory Vec2.fromJson(Map<String, dynamic> json) => Vec2(
    (json['x'] as num?)?.toDouble() ?? 0,
    (json['z'] as num?)?.toDouble() ?? 0,
  );

  @override
  bool operator ==(Object other) =>
      other is Vec2 && other.x == x && other.z == z;

  @override
  int get hashCode => Object.hash(x, z);

  @override
  String toString() => 'Vec2($x, $z)';
}

class DrinkDefinition {
  const DrinkDefinition({
    required this.id,
    required this.name,
    required this.level,
    required this.price,
    required this.color,
    required this.drinkTime,
  });

  final String id;
  final String name;
  final int level;
  final int price;
  final int color;
  final double drinkTime;
}

class UpgradeDefinition {
  const UpgradeDefinition({
    required this.key,
    required this.name,
    required this.description,
    required this.currency,
    required this.baseCost,
    required this.maxLevel,
  });

  final UpgradeKey key;
  final String name;
  final String description;
  final Currency currency;
  final int baseCost;
  final int maxLevel;
}

class RoomDefinition {
  const RoomDefinition({
    required this.id,
    required this.name,
    required this.shortName,
    required this.staffRole,
    required this.unlockCost,
    required this.baseProfit,
    required this.sessionDuration,
    required this.maxCapacity,
    required this.upgradeBaseCosts,
    required this.color,
    required this.accent,
  });

  final RoomId id;
  final String name;
  final String shortName;
  final String staffRole;
  final int unlockCost;
  final int baseProfit;
  final double sessionDuration;
  final int maxCapacity;
  final Map<RoomUpgradeKey, int> upgradeBaseCosts;
  final int color;
  final int accent;
}

class RoomLayout {
  RoomLayout({
    required this.center,
    required this.size,
    required this.connectionSide,
    required this.barPortal,
    required this.roomPortal,
    required this.connectorWidth,
    required List<Vec2> guestSpots,
    required this.staffSpot,
  }) : guestSpots = List.unmodifiable(guestSpots);

  final Vec2 center;
  final Vec2 size;
  final RoomConnectionSide connectionSide;
  final Vec2 barPortal;
  final Vec2 roomPortal;
  final double connectorWidth;
  final List<Vec2> guestSpots;
  final Vec2 staffSpot;

  double get minX => center.x - size.x / 2;
  double get maxX => center.x + size.x / 2;
  double get minZ => center.z - size.z / 2;
  double get maxZ => center.z + size.z / 2;

  Vec2 toLocal(Vec2 point) => Vec2(point.x - center.x, point.z - center.z);
}

class UpgradeLevels {
  const UpgradeLevels({
    this.moveSpeed = 1,
    this.orderSpeed = 1,
    this.prepSpeed = 1,
    this.cleanSpeed = 1,
    this.assortment = 1,
    this.advertising = 1,
  });

  final int moveSpeed;
  final int orderSpeed;
  final int prepSpeed;
  final int cleanSpeed;
  final int assortment;
  final int advertising;

  int levelFor(UpgradeKey key) => switch (key) {
    UpgradeKey.moveSpeed => moveSpeed,
    UpgradeKey.orderSpeed => orderSpeed,
    UpgradeKey.prepSpeed => prepSpeed,
    UpgradeKey.cleanSpeed => cleanSpeed,
    UpgradeKey.assortment => assortment,
    UpgradeKey.advertising => advertising,
  };

  UpgradeLevels withLevel(UpgradeKey key, int value) => UpgradeLevels(
    moveSpeed: key == UpgradeKey.moveSpeed ? value : moveSpeed,
    orderSpeed: key == UpgradeKey.orderSpeed ? value : orderSpeed,
    prepSpeed: key == UpgradeKey.prepSpeed ? value : prepSpeed,
    cleanSpeed: key == UpgradeKey.cleanSpeed ? value : cleanSpeed,
    assortment: key == UpgradeKey.assortment ? value : assortment,
    advertising: key == UpgradeKey.advertising ? value : advertising,
  );

  Map<String, Object> toJson() => {
    'moveSpeed': moveSpeed,
    'orderSpeed': orderSpeed,
    'prepSpeed': prepSpeed,
    'cleanSpeed': cleanSpeed,
    'assortment': assortment,
    'advertising': advertising,
  };

  factory UpgradeLevels.fromJson(Map<String, dynamic> json) => UpgradeLevels(
    moveSpeed: _positiveInt(json['moveSpeed']),
    orderSpeed: _positiveInt(json['orderSpeed']),
    prepSpeed: _positiveInt(json['prepSpeed']),
    cleanSpeed: _positiveInt(json['cleanSpeed']),
    assortment: _positiveInt(json['assortment']),
    advertising: _positiveInt(json['advertising']),
  );
}

class RoomUpgradeLevels {
  const RoomUpgradeLevels({
    this.staffSpeed = 1,
    this.capacity = 1,
    this.quality = 1,
  });

  final int staffSpeed;
  final int capacity;
  final int quality;

  int levelFor(RoomUpgradeKey key) => switch (key) {
    RoomUpgradeKey.staffSpeed => staffSpeed,
    RoomUpgradeKey.capacity => capacity,
    RoomUpgradeKey.quality => quality,
  };

  RoomUpgradeLevels withLevel(RoomUpgradeKey key, int value) =>
      RoomUpgradeLevels(
        staffSpeed: key == RoomUpgradeKey.staffSpeed ? value : staffSpeed,
        capacity: key == RoomUpgradeKey.capacity ? value : capacity,
        quality: key == RoomUpgradeKey.quality ? value : quality,
      );

  Map<String, Object> toJson() => {
    'staffSpeed': staffSpeed,
    'capacity': capacity,
    'quality': quality,
  };

  factory RoomUpgradeLevels.fromJson(Map<String, dynamic> json) =>
      RoomUpgradeLevels(
        staffSpeed: _positiveInt(json['staffSpeed']),
        capacity: _positiveInt(json['capacity']),
        quality: _positiveInt(json['quality']),
      );
}

class TableSnapshot {
  const TableSnapshot({
    required this.id,
    required this.position,
    required this.seat,
    required this.service,
    required this.occupantId,
    required this.dirty,
  });

  final int id;
  final Vec2 position;
  final Vec2 seat;
  final Vec2 service;
  final String? occupantId;
  final bool dirty;
}

class PatronSnapshot {
  const PatronSnapshot({
    required this.id,
    required this.tableId,
    required this.state,
    required this.position,
    required this.target,
    required this.patience,
    required this.happiness,
    required this.drink,
    required this.barServed,
    required this.roomId,
    required this.roomSlot,
  });

  final String id;
  final int tableId;
  final PatronState state;
  final Vec2 position;
  final Vec2 target;
  final double patience;
  final double happiness;
  final DrinkDefinition? drink;
  final bool barServed;
  final RoomId? roomId;
  final int? roomSlot;
}

class BartenderSnapshot {
  const BartenderSnapshot({
    required this.position,
    required this.target,
    required this.state,
    required this.targetPatronId,
    required this.targetTableId,
    required this.carryingDrink,
    required this.carryingDirty,
  });

  final Vec2 position;
  final Vec2 target;
  final BartenderState state;
  final String? targetPatronId;
  final int? targetTableId;
  final DrinkDefinition? carryingDrink;
  final bool carryingDirty;
}

class RoomSessionSample {
  const RoomSessionSample({
    required this.guests,
    required this.capacity,
    required this.revenue,
  });

  final int guests;
  final int capacity;
  final int revenue;

  Map<String, Object> toJson() => {
    'guests': guests,
    'capacity': capacity,
    'revenue': revenue,
  };

  factory RoomSessionSample.fromJson(Map<String, dynamic> json) {
    final capacity = _positiveInt(json['capacity']);
    return RoomSessionSample(
      guests: _nonNegativeInt(json['guests']).clamp(0, capacity),
      capacity: capacity,
      revenue: _nonNegativeInt(json['revenue']),
    );
  }
}

class RoomSnapshot {
  RoomSnapshot({
    required this.id,
    required this.unlocked,
    required this.awaitingFirstGuest,
    required this.staffState,
    required this.guests,
    required this.capacity,
    required this.progress,
    required this.completedSessions,
    required this.revenue,
    required this.perGuestProfit,
    required this.maxSessionProfit,
    required List<RoomSessionSample> recentSessions,
    required this.recentUtilization,
    required this.realizedRevenuePerSession,
    required this.recentAverageRevenuePerSession,
    required this.upgrades,
  }) : recentSessions = List.unmodifiable(recentSessions);

  final RoomId id;
  final bool unlocked;
  final bool awaitingFirstGuest;
  final RoomStaffState staffState;
  final int guests;
  final int capacity;
  final double progress;
  final int completedSessions;
  final int revenue;
  final int perGuestProfit;
  final int maxSessionProfit;
  final List<RoomSessionSample> recentSessions;
  final double recentUtilization;
  final double realizedRevenuePerSession;
  final double recentAverageRevenuePerSession;
  final RoomUpgradeLevels upgrades;
}

class BarDiagnostics {
  const BarDiagnostics({
    required this.waitingOrders,
    required this.waitingDrinks,
    required this.waitingPayments,
    required this.occupiedTables,
    required this.dirtyTables,
    required this.openTables,
    required this.blockedArrivals,
    required this.primaryBottleneck,
  });

  final int waitingOrders;
  final int waitingDrinks;
  final int waitingPayments;
  final int occupiedTables;
  final int dirtyTables;
  final int openTables;
  final int blockedArrivals;
  final BarBottleneck primaryBottleneck;
}

class ShiftSummary {
  const ShiftSummary({
    required this.dayNumber,
    required this.operatingRevenue,
    required this.servedThisShift,
    required this.roomRevenueThisShift,
    required this.blockedArrivals,
    required this.bonus,
  });

  final int dayNumber;
  final int operatingRevenue;
  final int servedThisShift;
  final int roomRevenueThisShift;
  final int blockedArrivals;
  final int bonus;

  Map<String, Object> toJson() => {
    'dayNumber': dayNumber,
    'operatingRevenue': operatingRevenue,
    'servedThisShift': servedThisShift,
    'roomRevenueThisShift': roomRevenueThisShift,
    'blockedArrivals': blockedArrivals,
    'bonus': bonus,
  };

  factory ShiftSummary.fromJson(Map<String, dynamic> json) => ShiftSummary(
    dayNumber: _positiveInt(json['dayNumber']),
    operatingRevenue: _nonNegativeInt(json['operatingRevenue']),
    servedThisShift: _nonNegativeInt(json['servedThisShift']),
    roomRevenueThisShift: _nonNegativeInt(json['roomRevenueThisShift']),
    blockedArrivals: _nonNegativeInt(json['blockedArrivals']),
    bonus: _nonNegativeInt(json['bonus']),
  );
}

class GameEvent {
  const GameEvent({
    required this.id,
    required this.kind,
    required this.message,
    this.amount,
    this.roomId,
  });

  final int id;
  final GameEventKind kind;
  final String message;
  final int? amount;
  final RoomId? roomId;
}

class UpgradeRecommendation {
  const UpgradeRecommendation({
    required this.kind,
    required this.key,
    required this.title,
    required this.reason,
    required this.cost,
    required this.currency,
    required this.affordable,
    this.roomId,
  });

  final RecommendationKind kind;
  final String key;
  final String title;
  final String reason;
  final int cost;
  final Currency currency;
  final bool affordable;
  final RoomId? roomId;
}

class GameSnapshot {
  GameSnapshot({
    required this.started,
    required this.speedMultiplier,
    required this.coins,
    required this.reputation,
    required this.served,
    required this.day,
    required this.shiftProgress,
    required List<PatronSnapshot> patrons,
    required List<TableSnapshot> tables,
    required this.bartender,
    required this.upgrades,
    required List<RoomSnapshot> rooms,
    required this.roomRevenue,
    required this.totalOperatingRevenue,
    required this.totalDayBonus,
    required this.lastShiftSummary,
    required this.queueCount,
    required this.barDiagnostics,
    required List<DrinkDefinition> unlockedDrinks,
    required List<UpgradeRecommendation> recommendations,
    required this.lastEvent,
  }) : patrons = List.unmodifiable(patrons),
       tables = List.unmodifiable(tables),
       rooms = List.unmodifiable(rooms),
       unlockedDrinks = List.unmodifiable(unlockedDrinks),
       recommendations = List.unmodifiable(recommendations);

  final bool started;
  final int speedMultiplier;
  final int coins;
  final int reputation;
  final int served;
  final int day;
  final double shiftProgress;
  final List<PatronSnapshot> patrons;
  final List<TableSnapshot> tables;
  final BartenderSnapshot bartender;
  final UpgradeLevels upgrades;
  final List<RoomSnapshot> rooms;
  final int roomRevenue;
  final int totalOperatingRevenue;
  final int totalDayBonus;
  final ShiftSummary? lastShiftSummary;
  final int queueCount;
  final BarDiagnostics barDiagnostics;
  final List<DrinkDefinition> unlockedDrinks;
  final List<UpgradeRecommendation> recommendations;
  final GameEvent? lastEvent;

  RoomSnapshot room(RoomId id) => rooms.firstWhere((room) => room.id == id);
}

class RoomSave {
  RoomSave({
    required this.unlocked,
    required this.awaitingFirstGuest,
    required this.completedSessions,
    required this.revenue,
    required this.upgrades,
    required List<RoomSessionSample> recentSessions,
  }) : recentSessions = List.unmodifiable(recentSessions);

  final bool unlocked;
  final bool awaitingFirstGuest;
  final int completedSessions;
  final int revenue;
  final RoomUpgradeLevels upgrades;
  final List<RoomSessionSample> recentSessions;

  Map<String, Object> toJson() => {
    'unlocked': unlocked,
    'awaitingFirstGuest': awaitingFirstGuest,
    'completedSessions': completedSessions,
    'revenue': revenue,
    'upgrades': upgrades.toJson(),
    'recentSessions': recentSessions.map((item) => item.toJson()).toList(),
  };

  factory RoomSave.fromJson(Map<String, dynamic> json) => RoomSave(
    unlocked: json['unlocked'] == true,
    awaitingFirstGuest: json['awaitingFirstGuest'] == true,
    completedSessions: _nonNegativeInt(json['completedSessions']),
    revenue: _nonNegativeInt(json['revenue']),
    upgrades: RoomUpgradeLevels.fromJson(_jsonMap(json['upgrades'])),
    recentSessions: _jsonList(json['recentSessions'])
        .whereType<Map>()
        .map(
          (item) => RoomSessionSample.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .toList(),
  );
}

class GameSave {
  GameSave({
    this.version = 1,
    required this.coins,
    required this.reputation,
    required this.served,
    required this.day,
    required this.upgrades,
    required this.totalOperatingRevenue,
    required this.totalDayBonus,
    required this.blockedArrivals,
    required this.lastShiftSummary,
    required Map<RoomId, RoomSave> rooms,
  }) : rooms = UnmodifiableMapView(Map.of(rooms));

  final int version;
  final int coins;
  final int reputation;
  final int served;
  final int day;
  final UpgradeLevels upgrades;
  final int totalOperatingRevenue;
  final int totalDayBonus;
  final int blockedArrivals;
  final ShiftSummary? lastShiftSummary;
  final Map<RoomId, RoomSave> rooms;

  Map<String, Object?> toJson() => {
    'version': version,
    'coins': coins,
    'reputation': reputation,
    'served': served,
    'day': day,
    'upgrades': upgrades.toJson(),
    'totalOperatingRevenue': totalOperatingRevenue,
    'totalDayBonus': totalDayBonus,
    'blockedArrivals': blockedArrivals,
    'lastShiftSummary': lastShiftSummary?.toJson(),
    'rooms': {
      for (final entry in rooms.entries) entry.key.name: entry.value.toJson(),
    },
  };

  factory GameSave.fromJson(Map<String, dynamic> json) {
    final roomJson = _jsonMap(json['rooms']);
    return GameSave(
      version: _positiveInt(json['version']),
      coins: _nonNegativeInt(json['coins']),
      reputation: _nonNegativeInt(json['reputation']),
      served: _nonNegativeInt(json['served']),
      day: _positiveInt(json['day']),
      upgrades: UpgradeLevels.fromJson(_jsonMap(json['upgrades'])),
      totalOperatingRevenue: _nonNegativeInt(json['totalOperatingRevenue']),
      totalDayBonus: _nonNegativeInt(json['totalDayBonus']),
      blockedArrivals: _nonNegativeInt(json['blockedArrivals']),
      lastShiftSummary: json['lastShiftSummary'] is Map
          ? ShiftSummary.fromJson(_jsonMap(json['lastShiftSummary']))
          : null,
      rooms: {
        for (final id in RoomId.values)
          if (roomJson[id.name] is Map)
            id: RoomSave.fromJson(_jsonMap(roomJson[id.name])),
      },
    );
  }
}

Map<String, dynamic> _jsonMap(Object? value) {
  if (value is! Map) return <String, dynamic>{};
  return value.map((key, value) => MapEntry(key.toString(), value));
}

List<dynamic> _jsonList(Object? value) => value is List ? value : const [];

int _positiveInt(Object? value) {
  final number = value is num ? value.toInt() : 1;
  return number < 1 ? 1 : number;
}

int _nonNegativeInt(Object? value) {
  final number = value is num ? value.toInt() : 0;
  return number < 0 ? 0 : number;
}
