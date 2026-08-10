import 'dart:convert';
import 'dart:math' as math;

import 'game_config.dart';
import 'grid_navigation.dart';
import 'models.dart';

export 'game_config.dart';
export 'grid_navigation.dart';
export 'models.dart';

const _recentRoomSessionLimit = 10;
const _firstRoomGuestSpawnDelay = 0.1;
const _openingServiceMoveFactor = 1.35;
const _openingServiceTimeFactor = 0.78;
const _openingDrinkTimeFactor = 0.75;
const _openingRoomWalkFactor = 1.5;

class BarSimulation {
  BarSimulation({int seed = 1337, GameSave? save}) : _seed = seed {
    _random = math.Random(seed);
    _resetAll();
    if (save != null) restore(save);
  }

  final int _seed;
  late math.Random _random;
  late List<_Table> _tables;
  late List<_Patron> _patrons;
  late _Bartender _bartender;
  late Map<RoomId, _Room> _rooms;

  bool _started = false;
  int _speedMultiplier = 1;
  int _coins = 64;
  int _reputation = 3;
  int _served = 0;
  int _day = 1;
  double _shiftElapsed = 0;
  double _spawnTimer = 1.3;
  int _patronSequence = 0;
  int _eventSequence = 0;
  GameEvent? _lastEvent;
  UpgradeLevels _upgrades = const UpgradeLevels();
  int _totalOperatingRevenue = 0;
  int _totalDayBonus = 0;
  int _shiftOperatingRevenue = 0;
  int _shiftServed = 0;
  int _shiftRoomRevenue = 0;
  int _shiftBlockedArrivals = 0;
  int _blockedArrivals = 0;
  ShiftSummary? _lastShiftSummary;
  List<RoomId> _priorityRoomQueue = [];
  String? _openingPriorityPatronId;

  GameSnapshot get snapshot => _buildSnapshot();

  void start() {
    if (_started) return;
    _started = true;
    _pushEvent(GameEventKind.day, 'День $_day: бар открыт!');
  }

  void reset() {
    _random = math.Random(_seed);
    _resetAll();
  }

  int toggleSpeed() {
    _speedMultiplier = _speedMultiplier == 1 ? 2 : 1;
    return _speedMultiplier;
  }

  bool purchaseUpgrade(UpgradeKey key) {
    final definition = upgradeDefinition(key);
    final level = _upgrades.levelFor(key);
    if (level >= definition.maxLevel) return false;
    final cost = getUpgradeCost(key, level);
    final balance = definition.currency == Currency.coins
        ? _coins
        : _reputation;
    if (balance < cost) return false;
    if (definition.currency == Currency.coins) {
      _coins -= cost;
    } else {
      _reputation -= cost;
    }
    _upgrades = _upgrades.withLevel(key, level + 1);
    _pushEvent(GameEventKind.upgrade, '${definition.name} · ур. ${level + 1}');
    return true;
  }

  bool purchaseRoom(RoomId roomId) {
    final room = _rooms[roomId]!;
    final definition = roomDefinition(roomId);
    if (room.unlocked || _coins < definition.unlockCost) return false;
    _coins -= definition.unlockCost;
    room
      ..unlocked = true
      ..awaitingFirstGuest = true
      ..staffState = RoomStaffState.waiting
      ..cooldown = 0
      ..progress = 0;
    _priorityRoomQueue = [
      roomId,
      ..._priorityRoomQueue.where((candidate) => candidate != roomId),
    ];
    _openingPriorityPatronId ??= _findOpeningPriorityPatron()?.id;
    _spawnTimer = math.min(_spawnTimer, _firstRoomGuestSpawnDelay);
    final verb = roomId == RoomId.sauna ? 'открыта' : 'открыт';
    _pushEvent(
      GameEventKind.roomUnlock,
      '${definition.name} $verb!',
      roomId: roomId,
    );
    return true;
  }

  bool purchaseRoomUpgrade(RoomId roomId, RoomUpgradeKey key) {
    final room = _rooms[roomId]!;
    final definition = roomDefinition(roomId);
    if (!room.unlocked) return false;
    final currentLevel = room.upgrades.levelFor(key);
    final maxLevel = key == RoomUpgradeKey.capacity
        ? definition.maxCapacity
        : 5;
    if (currentLevel >= maxLevel) return false;
    final cost = getRoomUpgradeCost(roomId, key, currentLevel);
    if (_coins < cost) return false;
    _coins -= cost;
    room.upgrades = room.upgrades.withLevel(key, currentLevel + 1);
    room.capacity = math.min(definition.maxCapacity, room.upgrades.capacity);
    _pushEvent(
      GameEventKind.upgrade,
      '${definition.shortName}: ${_roomUpgradeName(key)} · ур. ${currentLevel + 1}',
      roomId: roomId,
    );
    return true;
  }

  void update(double realDelta) {
    if (!_started || !realDelta.isFinite || realDelta <= 0) return;
    var remaining = math.min(realDelta, 0.5) * _speedMultiplier;
    while (remaining > 0) {
      final delta = math.min(remaining, 0.05);
      _step(delta);
      remaining -= delta;
    }
  }

  GameSave createSave() => GameSave(
    coins: _coins,
    reputation: _reputation,
    served: _served,
    day: _day,
    upgrades: _upgrades,
    totalOperatingRevenue: _totalOperatingRevenue,
    totalDayBonus: _totalDayBonus,
    blockedArrivals: _blockedArrivals,
    lastShiftSummary: _lastShiftSummary,
    rooms: {
      for (final entry in _rooms.entries)
        entry.key: RoomSave(
          unlocked: entry.value.unlocked,
          awaitingFirstGuest: entry.value.awaitingFirstGuest,
          completedSessions: entry.value.completedSessions,
          revenue: entry.value.revenue,
          upgrades: entry.value.upgrades,
          recentSessions: entry.value.recentSessions,
        ),
    },
  );

  String exportSaveJson() => jsonEncode(createSave().toJson());

  bool importSaveJson(String source) {
    try {
      final decoded = jsonDecode(source);
      if (decoded is! Map) return false;
      restore(
        GameSave.fromJson(
          decoded.map((key, value) => MapEntry(key.toString(), value)),
        ),
      );
      return true;
    } on FormatException {
      return false;
    } on TypeError {
      return false;
    }
  }

  void restore(GameSave save) {
    _resetAll();
    _coins = math.max(0, save.coins);
    _reputation = math.max(0, save.reputation);
    _served = math.max(0, save.served);
    _day = math.max(1, save.day);
    _totalOperatingRevenue = math.max(0, save.totalOperatingRevenue);
    _totalDayBonus = math.max(0, save.totalDayBonus);
    _blockedArrivals = math.max(0, save.blockedArrivals);
    _lastShiftSummary = save.lastShiftSummary;

    var levels = const UpgradeLevels();
    for (final definition in upgradeDefinitions) {
      levels = levels.withLevel(
        definition.key,
        save.upgrades.levelFor(definition.key).clamp(1, definition.maxLevel),
      );
    }
    _upgrades = levels;

    for (final id in RoomId.values) {
      final roomSave = save.rooms[id];
      if (roomSave == null) continue;
      final definition = roomDefinition(id);
      final room = _rooms[id]!;
      room
        ..unlocked = roomSave.unlocked
        ..awaitingFirstGuest = roomSave.unlocked && roomSave.awaitingFirstGuest
        ..staffState = roomSave.unlocked
            ? RoomStaffState.waiting
            : RoomStaffState.locked
        ..completedSessions = math.max(0, roomSave.completedSessions)
        ..revenue = math.max(0, roomSave.revenue)
        ..upgrades = RoomUpgradeLevels(
          staffSpeed: roomSave.upgrades.staffSpeed.clamp(1, 5),
          capacity: roomSave.upgrades.capacity.clamp(1, definition.maxCapacity),
          quality: roomSave.upgrades.quality.clamp(1, 5),
        )
        ..recentSessions = roomSave.recentSessions
            .skip(
              math.max(
                0,
                roomSave.recentSessions.length - _recentRoomSessionLimit,
              ),
            )
            .toList(growable: true);
      room.capacity = room.upgrades.capacity;
      room.cooldown = room.unlocked
          ? getRoomCooldownDuration(room.upgrades.staffSpeed)
          : 0;
    }
    _priorityRoomQueue = RoomId.values
        .where((id) => _rooms[id]!.awaitingFirstGuest)
        .toList();
  }

  void _resetAll() {
    _started = false;
    _speedMultiplier = 1;
    _coins = 64;
    _reputation = 3;
    _served = 0;
    _day = 1;
    _shiftElapsed = 0;
    _spawnTimer = 1.3;
    _patronSequence = 0;
    _eventSequence = 0;
    _lastEvent = null;
    _upgrades = const UpgradeLevels();
    _totalOperatingRevenue = 0;
    _totalDayBonus = 0;
    _shiftOperatingRevenue = 0;
    _shiftServed = 0;
    _shiftRoomRevenue = 0;
    _shiftBlockedArrivals = 0;
    _blockedArrivals = 0;
    _lastShiftSummary = null;
    _priorityRoomQueue = [];
    _openingPriorityPatronId = null;
    _patrons = [];
    _tables = tableLayout.map(_Table.fromSeed).toList();
    _bartender = _Bartender();
    _rooms = {
      for (final definition in roomDefinitions.values)
        definition.id: _Room(definition),
    };
  }

  void _step(double delta) {
    _shiftElapsed += delta;
    if (_shiftElapsed >= shiftDuration) {
      _shiftElapsed -= shiftDuration;
      final completedDay = _day;
      _day += 1;
      final bonus = getDayBonus(_shiftOperatingRevenue);
      _coins += bonus;
      _totalDayBonus += bonus;
      _lastShiftSummary = ShiftSummary(
        dayNumber: completedDay,
        operatingRevenue: _shiftOperatingRevenue,
        servedThisShift: _shiftServed,
        roomRevenueThisShift: _shiftRoomRevenue,
        blockedArrivals: _shiftBlockedArrivals,
        bonus: bonus,
      );
      _shiftOperatingRevenue = 0;
      _shiftServed = 0;
      _shiftRoomRevenue = 0;
      _shiftBlockedArrivals = 0;
      _pushEvent(GameEventKind.day, 'День $_day · бонус $bonus', amount: bonus);
    }

    _spawnTimer -= delta;
    if (_spawnTimer <= 0) {
      _trySpawnPatron();
      _spawnTimer =
          getArrivalInterval(_upgrades.advertising) *
          (0.82 + _random.nextDouble() * 0.36);
    }

    _updatePatrons(delta);
    _updateBartender(delta);
    _updateRooms(delta);
  }

  void _updateRooms(double delta) {
    for (final definition in roomDefinitions.values) {
      final room = _rooms[definition.id]!;
      if (!room.unlocked) continue;
      room.capacity = math.min(definition.maxCapacity, room.upgrades.capacity);
      room.guestIds.removeWhere(
        (guestId) => !_patrons.any(
          (patron) =>
              patron.id == guestId && patron.state == PatronState.inRoom,
        ),
      );
      room.guests = room.guestIds.length;

      if (room.staffState == RoomStaffState.waiting) {
        room.progress = 0;
        room.cooldown = math.max(0, room.cooldown - delta);
        final arrived = _roomPatrons(definition.id, PatronState.waitingRoom);
        if (arrived.isNotEmpty && room.cooldown <= 0) {
          room.staffState = RoomStaffState.welcoming;
          room.phaseDuration = getRoomGroupWindow(room.capacity);
          room.timer = room.phaseDuration;
        }
        continue;
      }

      room.timer -= delta;
      room.progress = (1 - room.timer / math.max(0.01, room.phaseDuration))
          .clamp(0, 1);

      if (room.staffState == RoomStaffState.welcoming) {
        final arrived = _roomPatrons(definition.id, PatronState.waitingRoom);
        final welcomeElapsed = room.phaseDuration - room.timer;
        if (welcomeElapsed < roomMinWelcomeDuration) continue;
        final participants = arrived.take(room.capacity).toList();
        if (participants.isEmpty) {
          room
            ..staffState = RoomStaffState.waiting
            ..cooldown = 0.5
            ..progress = 0;
          continue;
        }
        room.guestIds = participants.map((patron) => patron.id).toList();
        room.guests = participants.length;
        for (final patron in participants) {
          patron
            ..state = PatronState.inRoom
            ..target = patron.position;
        }
        room
          ..staffState = RoomStaffState.serving
          ..sessionCapacity = room.capacity
          ..phaseDuration = getRoomSessionDuration(
            definition.id,
            room.upgrades.staffSpeed,
          );
        room
          ..timer = room.phaseDuration
          ..progress = 0;
        if (room.awaitingFirstGuest) {
          room.awaitingFirstGuest = false;
          _priorityRoomQueue.remove(definition.id);
        }
      } else if (room.staffState == RoomStaffState.serving) {
        if (room.timer > 0) continue;
        final participants = room.guestIds
            .map(
              (guestId) => _patrons.where((p) => p.id == guestId).firstOrNull,
            )
            .whereType<_Patron>()
            .toList();
        final income = getRoomProfit(
          definition.id,
          room.upgrades.quality,
          participants.length,
        );
        _coins += income;
        _totalOperatingRevenue += income;
        _shiftOperatingRevenue += income;
        _shiftRoomRevenue += income;
        room.revenue += income;
        room.completedSessions += 1;
        room.recentSessions =
            [
                  ...room.recentSessions,
                  RoomSessionSample(
                    guests: participants.length,
                    capacity: room.sessionCapacity,
                    revenue: income,
                  ),
                ]
                .skip(
                  math.max(
                    0,
                    room.recentSessions.length + 1 - _recentRoomSessionLimit,
                  ),
                )
                .toList();
        if (room.completedSessions % 3 == 0) _reputation += 1;
        _pushEvent(
          GameEventKind.roomIncome,
          '${definition.shortName} +$income',
          amount: income,
          roomId: definition.id,
        );
        for (final patron in participants) {
          _startPatronExit(patron);
        }
        room
          ..guestIds = []
          ..guests = 0
          ..staffState = RoomStaffState.resetting
          ..phaseDuration = getRoomResetDuration(room.upgrades.staffSpeed);
        room
          ..timer = room.phaseDuration
          ..progress = 0;
      } else if (room.staffState == RoomStaffState.resetting) {
        if (room.timer > 0) continue;
        room
          ..guests = 0
          ..staffState = RoomStaffState.waiting
          ..cooldown = getRoomCooldownDuration(room.upgrades.staffSpeed)
          ..progress = 0;
      }
    }
  }

  List<_Patron> _roomPatrons(RoomId id, PatronState state) => _patrons
      .where((patron) => patron.roomId == id && patron.state == state)
      .toList();

  int _countRoomAssignments(RoomId roomId) => _patrons
      .where(
        (patron) =>
            patron.roomId == roomId &&
            (patron.state == PatronState.walkingToRoom ||
                patron.state == PatronState.waitingRoom ||
                patron.state == PatronState.inRoom),
      )
      .length;

  _Patron? _findOpeningPriorityPatron() {
    final current = _patrons
        .where(
          (patron) =>
              patron.id == _bartender.targetPatronId && !patron.barServed,
        )
        .firstOrNull;
    if (current != null) return current;
    const priorities = [
      PatronState.paying,
      PatronState.readyToPay,
      PatronState.drinking,
      PatronState.waitingDrink,
      PatronState.ordering,
      PatronState.waitingOrder,
      PatronState.walkingIn,
    ];
    for (final state in priorities) {
      final candidates = _patrons
          .where((p) => p.state == state && !p.barServed)
          .toList();
      if (state == PatronState.drinking) {
        candidates.sort((a, b) => a.timer.compareTo(b.timer));
      }
      if (candidates.isNotEmpty) return candidates.first;
    }
    return null;
  }

  _Patron? _getOpeningPriorityPatron() {
    var patron = _patrons
        .where(
          (candidate) =>
              candidate.id == _openingPriorityPatronId && !candidate.barServed,
        )
        .firstOrNull;
    if (patron == null && _priorityRoomQueue.isNotEmpty) {
      patron = _findOpeningPriorityPatron();
      _openingPriorityPatronId = patron?.id;
    }
    return patron;
  }

  bool _trySendPatronToRoom(_Patron patron) {
    if (!patron.barServed) return false;
    final available =
        <({RoomDefinition definition, _Room room, int assignments})>[];
    for (final definition in roomDefinitions.values) {
      final room = _rooms[definition.id]!;
      final assignments = _countRoomAssignments(definition.id);
      if (room.unlocked &&
          room.staffState != RoomStaffState.locked &&
          assignments < room.capacity) {
        available.add((
          definition: definition,
          room: room,
          assignments: assignments,
        ));
      }
    }
    final visitChance = (0.38 + patron.happiness * 0.42).clamp(0.42, 0.8);
    final visitRoll = _random.nextDouble();
    final roomRoll = _random.nextDouble();
    if (available.isEmpty) return false;

    final priorityCandidates =
        <({RoomDefinition definition, _Room room, int assignments})>[];
    for (final id in _priorityRoomQueue) {
      final candidate = available
          .where((item) => item.definition.id == id)
          .firstOrNull;
      if (candidate != null) priorityCandidates.add(candidate);
    }
    if (priorityCandidates.isEmpty && visitRoll > visitChance) return false;

    final highestFill = available
        .map((candidate) => candidate.assignments)
        .reduce(math.max);
    final preferred = highestFill > 0
        ? available.where((item) => item.assignments == highestFill).toList()
        : List.of(available);
    final firstIndex = math.min(
      preferred.length - 1,
      (roomRoll * preferred.length).floor(),
    );
    final randomOrdered = [
      ...preferred.skip(firstIndex),
      ...preferred.take(firstIndex),
      ...available.where((candidate) => !preferred.contains(candidate)),
    ];
    final ordered = priorityCandidates.isNotEmpty
        ? [
            ...priorityCandidates,
            ...randomOrdered.where(
              (item) => !priorityCandidates.contains(item),
            ),
          ]
        : randomOrdered;

    for (final candidate in ordered) {
      final id = candidate.definition.id;
      final layout = roomLayouts[id]!;
      final reservedSlots = _patrons
          .where(
            (item) =>
                item.roomId == id &&
                item.roomSlot != null &&
                item.state != PatronState.leaving,
          )
          .map((item) => item.roomSlot)
          .toSet();
      var slot = -1;
      for (
        var index = 0;
        index < layout.guestSpots.length && index < _rooms[id]!.capacity;
        index += 1
      ) {
        if (!reservedSlots.contains(index)) {
          slot = index;
          break;
        }
      }
      if (slot < 0) continue;
      final destination = layout.guestSpots[slot];
      final route = _makeRoute(patron.position, destination, [
        layout.barPortal,
        layout.roomPortal,
        destination,
      ]);
      if (route == null) continue;
      patron
        ..roomId = id
        ..roomSlot = slot
        ..state = PatronState.walkingToRoom
        ..route = route
        ..target = route.firstOrNull ?? destination;
      _priorityRoomQueue.remove(id);
      return true;
    }
    return false;
  }

  void _startPatronExit(_Patron patron) {
    final layout = patron.roomId == null ? null : roomLayouts[patron.roomId!];
    final stops = layout == null
        ? const [entryAisle, entrance]
        : [layout.roomPortal, layout.barPortal, entryAisle, entrance];
    patron
      ..state = PatronState.leaving
      ..roomSlot = null
      ..route = _makeRoute(patron.position, entrance, stops) ?? [];
    patron.target = patron.route.firstOrNull ?? patron.position;
  }

  void _trySpawnPatron() {
    final openTables = _tables
        .where((table) => table.occupantId == null && !table.dirty)
        .toList();
    if (openTables.isEmpty) {
      _blockedArrivals += 1;
      _shiftBlockedArrivals += 1;
      return;
    }
    final table =
        openTables[(_random.nextDouble() * openTables.length).floor()];
    final id = 'guest-${++_patronSequence}';
    final initialPatience = 34 + _random.nextDouble() * 10;
    final route = _makeRoute(entrance, table.seat);
    if (route == null) return;
    final patron = _Patron(
      id: id,
      tableId: table.id,
      initialPatience: initialPatience,
      palette: _patronSequence % 6,
      route: route,
    );
    table.occupantId = id;
    _patrons.add(patron);
    if (_priorityRoomQueue.isNotEmpty && _openingPriorityPatronId == null) {
      _openingPriorityPatronId = id;
    }
  }

  void _updatePatrons(double delta) {
    final departed = <_Patron>[];
    for (final patron in _patrons) {
      if (patron.state == PatronState.walkingIn) {
        if (_moveAlongRoute(patron, 1.62, delta)) {
          patron
            ..state = PatronState.waitingOrder
            ..target = _tables[patron.tableId].position;
        }
      } else if (patron.state == PatronState.walkingToRoom) {
        final openingFactor =
            patron.roomId != null && _rooms[patron.roomId]!.awaitingFirstGuest
            ? _openingRoomWalkFactor
            : 1;
        if (_moveAlongRoute(patron, 1.68 * openingFactor, delta)) {
          patron
            ..state = PatronState.waitingRoom
            ..target = patron.position;
        }
      } else if (patron.state == PatronState.leaving) {
        if (_moveAlongRoute(patron, 1.76, delta)) departed.add(patron);
      } else if (patron.state == PatronState.drinking) {
        patron.timer -= delta;
        if (patron.timer <= 0) patron.state = PatronState.readyToPay;
      }

      if (patron.state == PatronState.waitingOrder) patron.patience -= delta;
      if (patron.state == PatronState.waitingDrink) {
        patron.patience -= delta * 0.72;
      }
      patron.patience = math.max(0, patron.patience);
      patron.happiness = (patron.patience / patron.initialPatience).clamp(
        0.18,
        1,
      );
    }

    if (departed.isNotEmpty) {
      for (final patron in departed) {
        final table = _tables[patron.tableId];
        if (table.occupantId == patron.id) table.occupantId = null;
        final earned = patron.happiness >= 0.82 ? 2 : 1;
        _reputation += earned;
        _pushEvent(
          GameEventKind.reputation,
          'Счастливый гость +$earned',
          amount: earned,
        );
      }
      _patrons.removeWhere(departed.contains);
    }
  }

  void _updateBartender(double delta) {
    final moving =
        _bartender.state.name.startsWith('to') ||
        _bartender.state == BartenderState.returningDirty;
    if (moving) {
      final openingFactor =
          _bartender.targetPatronId == _openingPriorityPatronId
          ? _openingServiceMoveFactor
          : 1;
      final speed = getBartenderMoveSpeed(_upgrades.moveSpeed) * openingFactor;
      if (_moveAlongRoute(_bartender, speed, delta)) _finishBartenderMove();
      return;
    }
    if (_bartender.state != BartenderState.idle) {
      _bartender.timer -= delta;
      if (_bartender.timer <= 0) _finishBartenderAction();
      return;
    }
    _chooseBartenderJob();
  }

  void _chooseBartenderJob() {
    final opening = _getOpeningPriorityPatron();
    final payment = opening?.state == PatronState.readyToPay
        ? opening
        : _patrons.where((p) => p.state == PatronState.readyToPay).firstOrNull;
    if (payment != null) {
      _bartender
        ..targetPatronId = payment.id
        ..targetTableId = payment.tableId;
      _startBartenderMove(
        BartenderState.toPayment,
        _tables[payment.tableId].service,
      );
      return;
    }
    if (opening?.state == PatronState.drinking) return;

    final order = opening?.state == PatronState.waitingOrder
        ? opening
        : _patrons
              .where((p) => p.state == PatronState.waitingOrder)
              .firstOrNull;
    if (order != null) {
      _bartender
        ..targetPatronId = order.id
        ..targetTableId = order.tableId;
      _startBartenderMove(
        BartenderState.toOrder,
        _tables[order.tableId].service,
      );
      return;
    }

    final dirty = _tables
        .where((table) => table.dirty && table.occupantId == null)
        .firstOrNull;
    if (dirty != null) {
      _bartender
        ..targetPatronId = null
        ..targetTableId = dirty.id;
      _startBartenderMove(BartenderState.toCleanup, dirty.service);
    }
  }

  void _startBartenderMove(
    BartenderState state,
    Vec2 destination, [
    List<Vec2>? explicitRoute,
  ]) {
    final route = _makeRoute(
      _bartender.position,
      destination,
      explicitRoute ?? const [],
    );
    if (route == null) {
      _setBartenderIdle();
      return;
    }
    _bartender
      ..state = state
      ..route = route
      ..target = route.firstOrNull ?? destination;
  }

  void _finishBartenderMove() {
    final patron = _patrons
        .where((item) => item.id == _bartender.targetPatronId)
        .firstOrNull;
    final table = _bartender.targetTableId == null
        ? null
        : _tables[_bartender.targetTableId!];
    final openingTimeFactor = patron?.id == _openingPriorityPatronId
        ? _openingServiceTimeFactor
        : 1;
    if (patron != null) {
      _bartender.target = patron.position;
    } else if (table != null) {
      _bartender.target = table.position;
    }

    switch (_bartender.state) {
      case BartenderState.toOrder:
        if (patron == null || patron.state != PatronState.waitingOrder) {
          _setBartenderIdle();
          return;
        }
        patron.state = PatronState.ordering;
        _bartender
          ..state = BartenderState.takingOrder
          ..timer = getOrderDuration(_upgrades.orderSpeed) * openingTimeFactor;
      case BartenderState.toBar:
        _bartender
          ..target = const Vec2(-1.25, -3.35)
          ..state = BartenderState.preparing
          ..timer =
              getPreparationDuration(_upgrades.prepSpeed) * openingTimeFactor;
      case BartenderState.toDeliver:
        if (patron == null || patron.state != PatronState.waitingDrink) {
          _setBartenderIdle();
          return;
        }
        _bartender
          ..state = BartenderState.delivering
          ..timer = 0.52 * openingTimeFactor;
      case BartenderState.toPayment:
        if (patron == null || patron.state != PatronState.readyToPay) {
          _setBartenderIdle();
          return;
        }
        patron.state = PatronState.paying;
        _bartender
          ..state = BartenderState.takingPayment
          ..timer = 0.82 * openingTimeFactor;
      case BartenderState.toCleanup:
        if (table == null || !table.dirty || table.occupantId != null) {
          _setBartenderIdle();
          return;
        }
        _bartender
          ..state = BartenderState.cleaning
          ..timer = getCleaningDuration(_upgrades.cleanSpeed);
      case BartenderState.returningDirty:
        _bartender.carryingDirty = false;
        _setBartenderIdle();
      default:
        _setBartenderIdle();
    }
  }

  void _finishBartenderAction() {
    final patron = _patrons
        .where((item) => item.id == _bartender.targetPatronId)
        .firstOrNull;
    final table = _bartender.targetTableId == null
        ? null
        : _tables[_bartender.targetTableId!];
    switch (_bartender.state) {
      case BartenderState.takingOrder:
        if (patron == null) return _setBartenderIdle();
        patron
          ..drink = _pickDrink()
          ..state = PatronState.waitingDrink;
        _startBartenderMove(BartenderState.toBar, barStation, const [
          serviceGate,
          barStation,
        ]);
      case BartenderState.preparing:
        if (patron?.drink == null) return _setBartenderIdle();
        _bartender.carryingDrink = patron!.drink;
        _startBartenderMove(
          BartenderState.toDeliver,
          _tables[patron.tableId].service,
          [serviceGate, _tables[patron.tableId].service],
        );
      case BartenderState.delivering:
        if (patron?.drink != null) {
          patron!
            ..state = PatronState.drinking
            ..timer =
                patron.drink!.drinkTime *
                (patron.id == _openingPriorityPatronId
                    ? _openingDrinkTimeFactor
                    : 1);
        }
        _bartender.carryingDrink = null;
        _setBartenderIdle();
      case BartenderState.takingPayment:
        if (patron?.drink != null && table != null) {
          final tip =
              (patron!.drink!.price *
                      math.max(0, patron.happiness - 0.38) *
                      0.32)
                  .round();
          final payment = patron.drink!.price + tip;
          _coins += payment;
          _totalOperatingRevenue += payment;
          _shiftOperatingRevenue += payment;
          _served += 1;
          _shiftServed += 1;
          patron.barServed = true;
          table
            ..dirty = true
            ..occupantId = null;
          final assigned = _trySendPatronToRoom(patron);
          if (!assigned) _startPatronExit(patron);
          if (assigned || patron.id == _openingPriorityPatronId) {
            _openingPriorityPatronId = null;
          }
          _pushEvent(
            GameEventKind.payment,
            '${patron.drink!.name} +$payment',
            amount: payment,
          );
        }
        _setBartenderIdle();
      case BartenderState.cleaning:
        if (table != null) table.dirty = false;
        _bartender.carryingDirty = true;
        _startBartenderMove(BartenderState.returningDirty, barStation, const [
          serviceGate,
          barStation,
        ]);
      default:
        _setBartenderIdle();
    }
  }

  void _setBartenderIdle() {
    _bartender
      ..state = BartenderState.idle
      ..route = []
      ..target = _bartender.position
      ..targetPatronId = null
      ..targetTableId = null
      ..timer = 0;
  }

  DrinkDefinition _pickDrink() {
    final unlocked = getUnlockedDrinks(_upgrades.assortment);
    final premiumBias = math.pow(_random.nextDouble(), 0.72);
    final index = math.min(
      unlocked.length - 1,
      (premiumBias * unlocked.length).floor(),
    );
    return unlocked[index];
  }

  bool _moveAlongRoute(_MovingEntity entity, double speed, double delta) {
    var remaining = speed * delta;
    while (entity.route.isNotEmpty && remaining > 0) {
      final destination = entity.route.first;
      final gap = _distance(entity.position, destination);
      if (gap <= remaining || gap < 0.001) {
        entity.position = destination;
        remaining -= gap;
        entity.route.removeAt(0);
      } else {
        entity.position = Vec2(
          entity.position.x +
              ((destination.x - entity.position.x) / gap) * remaining,
          entity.position.z +
              ((destination.z - entity.position.z) / gap) * remaining,
        );
        remaining = 0;
      }
    }
    entity.target = entity.route.firstOrNull ?? entity.position;
    return entity.route.isEmpty;
  }

  List<Vec2>? _makeRoute(
    Vec2 start,
    Vec2 destination, [
    List<Vec2> requiredStops = const [],
  ]) {
    final obstacles = makeLevelObstacles(
      _tables.map((table) => table.position),
    );
    final stops = requiredStops.isNotEmpty ? requiredStops : [destination];
    final route = <Vec2>[];
    var cursor = start;
    for (final stop in stops) {
      final segment = findGridPath(cursor, stop, obstacles);
      if (segment.isEmpty) return null;
      route.addAll(segment);
      cursor = stop;
    }
    return route;
  }

  BarDiagnostics _buildBarDiagnostics() {
    final waitingOrders = _patrons
        .where((p) => p.state == PatronState.waitingOrder)
        .length;
    final waitingDrinks = _patrons
        .where((p) => p.state == PatronState.waitingDrink)
        .length;
    final waitingPayments = _patrons
        .where((p) => p.state == PatronState.readyToPay)
        .length;
    final occupied = _tables.where((t) => t.occupantId != null).length;
    final dirty = _tables.where((t) => t.dirty && t.occupantId == null).length;
    final open = _tables.length - occupied - dirty;
    final queues = [
      (BarBottleneck.payments, waitingPayments),
      (BarBottleneck.drinks, waitingDrinks),
      (BarBottleneck.orders, waitingOrders),
    ];
    var largest = queues.first;
    for (final queue in queues.skip(1)) {
      if (queue.$2 > largest.$2) largest = queue;
    }
    final bottleneck = largest.$2 > 0
        ? largest.$1
        : open == 0 && dirty > 0
        ? BarBottleneck.cleaning
        : open == 0
        ? BarBottleneck.tables
        : BarBottleneck.none;
    return BarDiagnostics(
      waitingOrders: waitingOrders,
      waitingDrinks: waitingDrinks,
      waitingPayments: waitingPayments,
      occupiedTables: occupied,
      dirtyTables: dirty,
      openTables: open,
      blockedArrivals: _blockedArrivals,
      primaryBottleneck: bottleneck,
    );
  }

  List<UpgradeRecommendation> _buildRecommendations(
    BarDiagnostics diagnostics,
    List<RoomSnapshot> rooms,
  ) {
    final result = <UpgradeRecommendation>[];
    final barChoice = switch (diagnostics.primaryBottleneck) {
      BarBottleneck.orders => (
        UpgradeKey.orderSpeed,
        'Очередь на заказ: ${diagnostics.waitingOrders}',
      ),
      BarBottleneck.drinks => (
        UpgradeKey.prepSpeed,
        'Ждут напиток: ${diagnostics.waitingDrinks}',
      ),
      BarBottleneck.payments => (
        UpgradeKey.moveSpeed,
        'Ждут расчёт: ${diagnostics.waitingPayments}; путь бармена станет короче по времени.',
      ),
      BarBottleneck.cleaning => (
        UpgradeKey.cleanSpeed,
        'Грязных столов: ${diagnostics.dirtyTables}',
      ),
      BarBottleneck.tables => (
        UpgradeKey.assortment,
        'Все 6 столов заняты: увеличивайте доход с гостя, а не рекламу.',
      ),
      BarBottleneck.none => (
        UpgradeKey.assortment,
        'Очередей нет: рост среднего чека безопаснее роста потока.',
      ),
    };
    _addBarRecommendation(result, barChoice.$1, barChoice.$2);

    final nextLocked = RoomId.values
        .map((id) => roomDefinition(id))
        .where((definition) => !_rooms[definition.id]!.unlocked)
        .firstOrNull;
    if (nextLocked != null) {
      result.add(
        UpgradeRecommendation(
          kind: RecommendationKind.roomUnlock,
          key: nextLocked.id.name,
          roomId: nextLocked.id,
          title: 'Открыть ${nextLocked.shortName}',
          reason:
              'Новый независимый источник дохода: от ${nextLocked.baseProfit} монет за гостя.',
          cost: nextLocked.unlockCost,
          currency: Currency.coins,
          affordable: _coins >= nextLocked.unlockCost,
        ),
      );
    }

    for (final room in rooms.where((room) => room.unlocked)) {
      final definition = roomDefinition(room.id);
      RoomUpgradeKey key;
      String reason;
      if (room.recentSessions.isNotEmpty &&
          room.recentUtilization >= 0.7 &&
          room.capacity < definition.maxCapacity) {
        key = RoomUpgradeKey.capacity;
        reason =
            'Загрузка ${(room.recentUtilization * 100).round()}%: дополнительное место будет использоваться.';
      } else if (room.completedSessions >= 2 &&
          room.upgrades.staffSpeed < 5 &&
          room.recentUtilization >= 0.5) {
        key = RoomUpgradeKey.staffSpeed;
        reason = 'Комната востребована: персонал ускорит оборот на 15%.';
      } else {
        key = RoomUpgradeKey.quality;
        reason =
            'Доход с гостя вырастет с ${room.perGuestProfit} до ${getRoomProfit(room.id, room.upgrades.quality + 1, 1)}.';
      }
      final level = room.upgrades.levelFor(key);
      final max = key == RoomUpgradeKey.capacity ? definition.maxCapacity : 5;
      if (level >= max) continue;
      final cost = getRoomUpgradeCost(room.id, key, level);
      result.add(
        UpgradeRecommendation(
          kind: RecommendationKind.roomUpgrade,
          key: key.name,
          roomId: room.id,
          title: '${definition.shortName}: ${_roomUpgradeName(key)}',
          reason: reason,
          cost: cost,
          currency: Currency.coins,
          affordable: _coins >= cost,
        ),
      );
    }
    return result;
  }

  void _addBarRecommendation(
    List<UpgradeRecommendation> result,
    UpgradeKey key,
    String reason,
  ) {
    var definition = upgradeDefinition(key);
    var level = _upgrades.levelFor(key);
    if (level >= definition.maxLevel) {
      definition = upgradeDefinition(UpgradeKey.assortment);
      level = _upgrades.assortment;
    }
    if (level >= definition.maxLevel) return;
    final cost = getUpgradeCost(definition.key, level);
    final balance = definition.currency == Currency.coins
        ? _coins
        : _reputation;
    result.add(
      UpgradeRecommendation(
        kind: RecommendationKind.barUpgrade,
        key: definition.key.name,
        title: definition.name,
        reason: reason,
        cost: cost,
        currency: definition.currency,
        affordable: balance >= cost,
      ),
    );
  }

  GameSnapshot _buildSnapshot() {
    final diagnostics = _buildBarDiagnostics();
    final roomSnapshots = roomDefinitions.values.map((definition) {
      final room = _rooms[definition.id]!;
      final recentCapacity = room.recentSessions.fold<int>(
        0,
        (total, sample) => total + sample.capacity,
      );
      final recentGuests = room.recentSessions.fold<int>(
        0,
        (total, sample) => total + sample.guests,
      );
      final recentRevenue = room.recentSessions.fold<int>(
        0,
        (total, sample) => total + sample.revenue,
      );
      return RoomSnapshot(
        id: room.id,
        unlocked: room.unlocked,
        awaitingFirstGuest: room.awaitingFirstGuest,
        staffState: room.staffState,
        guests: room.guests,
        capacity: room.capacity,
        progress: room.progress,
        completedSessions: room.completedSessions,
        revenue: room.revenue,
        perGuestProfit: getRoomProfit(room.id, room.upgrades.quality, 1),
        maxSessionProfit: getRoomProfit(
          room.id,
          room.upgrades.quality,
          room.capacity,
        ),
        recentSessions: room.recentSessions,
        recentUtilization: recentCapacity > 0
            ? recentGuests / recentCapacity
            : 0,
        realizedRevenuePerSession: room.completedSessions > 0
            ? room.revenue / room.completedSessions
            : 0,
        recentAverageRevenuePerSession: room.recentSessions.isNotEmpty
            ? recentRevenue / room.recentSessions.length
            : 0,
        upgrades: room.upgrades,
      );
    }).toList();
    final roomRevenue = roomSnapshots.fold<int>(
      0,
      (total, room) => total + room.revenue,
    );
    return GameSnapshot(
      started: _started,
      speedMultiplier: _speedMultiplier,
      coins: _coins,
      reputation: _reputation,
      served: _served,
      day: _day,
      shiftProgress: _shiftElapsed / shiftDuration,
      patrons: _patrons.map((patron) => patron.snapshot).toList(),
      tables: _tables.map((table) => table.snapshot).toList(),
      bartender: _bartender.snapshot,
      upgrades: _upgrades,
      rooms: roomSnapshots,
      roomRevenue: roomRevenue,
      totalOperatingRevenue: _totalOperatingRevenue,
      totalDayBonus: _totalDayBonus,
      lastShiftSummary: _lastShiftSummary,
      queueCount:
          diagnostics.waitingOrders +
          diagnostics.waitingDrinks +
          diagnostics.waitingPayments,
      barDiagnostics: diagnostics,
      unlockedDrinks: getUnlockedDrinks(_upgrades.assortment),
      recommendations: _buildRecommendations(diagnostics, roomSnapshots),
      lastEvent: _lastEvent,
    );
  }

  void _pushEvent(
    GameEventKind kind,
    String message, {
    int? amount,
    RoomId? roomId,
  }) {
    _lastEvent = GameEvent(
      id: ++_eventSequence,
      kind: kind,
      message: message,
      amount: amount,
      roomId: roomId,
    );
  }
}

abstract class _MovingEntity {
  Vec2 get position;
  set position(Vec2 value);
  Vec2 get target;
  set target(Vec2 value);
  List<Vec2> get route;
  set route(List<Vec2> value);
}

class _Table {
  _Table.fromSeed(TableSeed seed)
    : id = seed.id,
      position = seed.position,
      seat = seed.seat,
      service = seed.service;

  final int id;
  final Vec2 position;
  final Vec2 seat;
  final Vec2 service;
  String? occupantId;
  bool dirty = false;

  TableSnapshot get snapshot => TableSnapshot(
    id: id,
    position: position,
    seat: seat,
    service: service,
    occupantId: occupantId,
    dirty: dirty,
  );
}

class _Patron implements _MovingEntity {
  _Patron({
    required this.id,
    required this.tableId,
    required this.initialPatience,
    required this.palette,
    required this.route,
  }) : position = entrance,
       target = entryAisle,
       patience = initialPatience;

  final String id;
  final int tableId;
  final double initialPatience;
  final int palette;
  PatronState state = PatronState.walkingIn;
  @override
  Vec2 position;
  @override
  Vec2 target;
  @override
  List<Vec2> route;
  double timer = 0;
  double patience;
  DrinkDefinition? drink;
  double happiness = 1;
  bool barServed = false;
  RoomId? roomId;
  int? roomSlot;

  PatronSnapshot get snapshot => PatronSnapshot(
    id: id,
    tableId: tableId,
    state: state,
    position: position,
    target: target,
    patience: patience,
    happiness: happiness,
    drink: drink,
    barServed: barServed,
    roomId: roomId,
    roomSlot: roomSlot,
  );
}

class _Bartender implements _MovingEntity {
  @override
  Vec2 position = barStation;
  @override
  Vec2 target = barStation;
  @override
  List<Vec2> route = [];
  BartenderState state = BartenderState.idle;
  String? targetPatronId;
  int? targetTableId;
  DrinkDefinition? carryingDrink;
  bool carryingDirty = false;
  double timer = 0;

  BartenderSnapshot get snapshot => BartenderSnapshot(
    position: position,
    target: target,
    state: state,
    targetPatronId: targetPatronId,
    targetTableId: targetTableId,
    carryingDrink: carryingDrink,
    carryingDirty: carryingDirty,
  );
}

class _Room {
  _Room(RoomDefinition definition)
    : id = definition.id,
      perGuestProfit = definition.baseProfit,
      maxSessionProfit = definition.baseProfit;

  final RoomId id;
  bool unlocked = false;
  bool awaitingFirstGuest = false;
  RoomStaffState staffState = RoomStaffState.locked;
  int guests = 0;
  int capacity = 1;
  double progress = 0;
  int completedSessions = 0;
  int revenue = 0;
  int perGuestProfit;
  int maxSessionProfit;
  List<RoomSessionSample> recentSessions = [];
  RoomUpgradeLevels upgrades = const RoomUpgradeLevels();
  double timer = 0;
  double phaseDuration = 1;
  double cooldown = 0;
  List<String> guestIds = [];
  int sessionCapacity = 1;
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}

double _distance(Vec2 a, Vec2 b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));

String _roomUpgradeName(RoomUpgradeKey key) => switch (key) {
  RoomUpgradeKey.staffSpeed => 'Мастерство персонала',
  RoomUpgradeKey.capacity => 'Дополнительное место',
  RoomUpgradeKey.quality => 'Премиум-сервис',
};
