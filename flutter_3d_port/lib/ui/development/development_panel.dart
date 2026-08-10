import 'package:flutter/material.dart';

import '../../domain/config.dart';
import '../../domain/models.dart';
import '../core/app_theme.dart';
import '../core/formatters.dart';
import '../core/game_widgets.dart';
import 'upgrade_effects.dart';

class DevelopmentPanel extends StatelessWidget {
  const DevelopmentPanel({
    super.key,
    required this.snapshot,
    required this.selectedRoom,
    required this.onClose,
    required this.onSelectRoom,
    required this.onBuyBarUpgrade,
    required this.onUnlockRoom,
    required this.onBuyRoomUpgrade,
  });

  final GameSnapshot snapshot;
  final RoomId? selectedRoom;
  final VoidCallback onClose;
  final ValueChanged<RoomId?> onSelectRoom;
  final ValueChanged<UpgradeKey> onBuyBarUpgrade;
  final ValueChanged<RoomId> onUnlockRoom;
  final void Function(RoomId roomId, RoomUpgradeKey key) onBuyRoomUpgrade;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: GamePanel(
        radius: 24,
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            _Header(onClose: onClose),
            _VenueTabs(
              snapshot: snapshot,
              selectedRoom: selectedRoom,
              onSelected: onSelectRoom,
            ),
            Expanded(
              child: selectedRoom == null
                  ? _BarDevelopment(snapshot: snapshot, onBuy: onBuyBarUpgrade)
                  : _RoomDevelopment(
                      snapshot: snapshot,
                      roomId: selectedRoom!,
                      onUnlock: onUnlockRoom,
                      onBuy: onBuyRoomUpgrade,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
      child: Row(
        children: [
          const GameAssetIcon('upgrades', size: 42),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionEyebrow('Управление бизнесом'),
                Text(
                  'Развитие',
                  key: Key('development-title'),
                  style: TextStyle(
                    color: GameColors.cream,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            key: const Key('development-close'),
            tooltip: 'Закрыть развитие',
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
    );
  }
}

class _VenueTabs extends StatelessWidget {
  const _VenueTabs({
    required this.snapshot,
    required this.selectedRoom,
    required this.onSelected,
  });

  final GameSnapshot snapshot;
  final RoomId? selectedRoom;
  final ValueChanged<RoomId?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: _VenueTab(
                key: const Key('venue-tab-bar'),
                label: 'Бар',
                icon: Icons.local_bar_rounded,
                selected: selectedRoom == null,
                onTap: () => onSelected(null),
              ),
            ),
            for (final roomId in RoomId.values) ...[
              const SizedBox(width: 4),
              Expanded(
                child: _VenueTab(
                  key: Key('venue-tab-${roomId.name}'),
                  label: roomName(roomId),
                  icon: roomIcon(roomId),
                  selected: selectedRoom == roomId,
                  locked: !snapshot.room(roomId).unlocked,
                  onTap: () => onSelected(roomId),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _VenueTab extends StatelessWidget {
  const _VenueTab({
    super.key,
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.locked = false,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: '$label${locked ? ', закрыто' : ''}',
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: selected
                ? GameColors.gold
                : GameColors.deepNavy.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? GameColors.cream : Colors.white24,
            ),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 17,
                  color: selected ? GameColors.ink : GameColors.cream,
                ),
                const SizedBox(width: 3),
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? GameColors.ink : GameColors.cream,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (locked) ...[
                  const SizedBox(width: 2),
                  Icon(
                    Icons.lock_rounded,
                    size: 11,
                    color: selected ? GameColors.ink : Colors.white70,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BarDevelopment extends StatelessWidget {
  const _BarDevelopment({required this.snapshot, required this.onBuy});

  final GameSnapshot snapshot;
  final ValueChanged<UpgradeKey> onBuy;

  @override
  Widget build(BuildContext context) {
    final recommendedKeys = snapshot.recommendations
        .where((item) => item.kind == RecommendationKind.barUpgrade)
        .map((item) => item.key)
        .toSet();
    return ListView(
      key: const Key('bar-upgrade-list'),
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 18),
      children: [
        _BusinessStatus(snapshot: snapshot),
        const SizedBox(height: 8),
        for (final definition in upgradeDefinitions) ...[
          _BarUpgradeCard(
            snapshot: snapshot,
            definition: definition,
            recommended: recommendedKeys.contains(definition.key.name),
            onBuy: () => onBuy(definition.key),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _BusinessStatus extends StatelessWidget {
  const _BusinessStatus({required this.snapshot});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final diagnostics = snapshot.barDiagnostics;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: GameColors.teal.withValues(alpha: 0.26),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: GameColors.mint.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          const Icon(Icons.analytics_rounded, color: GameColors.mint),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  bottleneckLabel(diagnostics.primaryBottleneck),
                  style: const TextStyle(
                    color: GameColors.cream,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'Столы ${diagnostics.occupiedTables}/6 · очередь ${snapshot.queueCount} · потеряно ${diagnostics.blockedArrivals}',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BarUpgradeCard extends StatelessWidget {
  const _BarUpgradeCard({
    required this.snapshot,
    required this.definition,
    required this.recommended,
    required this.onBuy,
  });

  final GameSnapshot snapshot;
  final UpgradeDefinition definition;
  final bool recommended;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final level = snapshot.upgrades.levelFor(definition.key);
    final maxed = level >= definition.maxLevel;
    final cost = getUpgradeCost(definition.key, level);
    final balance = definition.currency == Currency.coins
        ? snapshot.coins
        : snapshot.reputation;
    final effect = barUpgradeEffect(definition.key, level);
    return _UpgradeCard(
      key: Key('bar-upgrade-${definition.key.name}'),
      effect: effect,
      level: level,
      maxLevel: definition.maxLevel,
      cost: cost,
      currency: definition.currency,
      affordable: balance >= cost,
      recommended: recommended,
      maxed: maxed,
      onBuy: onBuy,
    );
  }
}

class _RoomDevelopment extends StatelessWidget {
  const _RoomDevelopment({
    required this.snapshot,
    required this.roomId,
    required this.onUnlock,
    required this.onBuy,
  });

  final GameSnapshot snapshot;
  final RoomId roomId;
  final ValueChanged<RoomId> onUnlock;
  final void Function(RoomId roomId, RoomUpgradeKey key) onBuy;

  @override
  Widget build(BuildContext context) {
    final room = snapshot.room(roomId);
    final definition = roomDefinition(roomId);
    if (!room.unlocked) {
      return _LockedRoom(
        snapshot: snapshot,
        room: room,
        definition: definition,
        onUnlock: () => onUnlock(roomId),
      );
    }
    return ListView(
      key: Key('room-upgrade-list-${roomId.name}'),
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 18),
      children: [
        _RoomStatus(room: room, definition: definition),
        const SizedBox(height: 8),
        for (final key in RoomUpgradeKey.values) ...[
          _RoomUpgradeCard(
            snapshot: snapshot,
            room: room,
            keyName: key,
            recommended: snapshot.recommendations.any(
              (item) =>
                  item.kind == RecommendationKind.roomUpgrade &&
                  item.roomId == roomId &&
                  item.key == key.name,
            ),
            onBuy: () => onBuy(roomId, key),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _LockedRoom extends StatelessWidget {
  const _LockedRoom({
    required this.snapshot,
    required this.room,
    required this.definition,
    required this.onUnlock,
  });

  final GameSnapshot snapshot;
  final RoomSnapshot room;
  final RoomDefinition definition;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    final missing = (definition.unlockCost - snapshot.coins).clamp(
      0,
      definition.unlockCost,
    );
    return ListView(
      key: Key('locked-room-${room.id.name}'),
      padding: const EdgeInsets.all(14),
      children: [
        const SizedBox(height: 8),
        Icon(roomIcon(room.id), color: Color(definition.accent), size: 68),
        const SizedBox(height: 8),
        Text(
          definition.name,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: GameColors.cream,
            fontSize: 25,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${definition.staffRole} · до ${definition.maxCapacity} гостей · от ${definition.baseProfit} мон. с гостя',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white70,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 18),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            minHeight: 12,
            value: (snapshot.coins / definition.unlockCost).clamp(0, 1),
            color: GameColors.gold,
            backgroundColor: Colors.white12,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          missing == 0
              ? 'Ремонт доступен'
              : 'До ремонта ещё ${formatInt(missing)} мон.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: GameColors.mint,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          key: Key('unlock-room-${room.id.name}'),
          onPressed: snapshot.coins >= definition.unlockCost ? onUnlock : null,
          icon: const Icon(Icons.construction_rounded),
          label: Text('Открыть за ${formatInt(definition.unlockCost)} мон.'),
        ),
        const SizedBox(height: 14),
        const Text(
          'После ремонта следующий подходящий гость сначала обслужится в баре, а затем пойдёт в новую комнату.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white60, fontSize: 12, height: 1.35),
        ),
      ],
    );
  }
}

class _RoomStatus extends StatelessWidget {
  const _RoomStatus({required this.room, required this.definition});

  final RoomSnapshot room;
  final RoomDefinition definition;

  @override
  Widget build(BuildContext context) {
    final utilization = (room.recentUtilization * 100).round();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Color(definition.color).withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(17),
        border: Border.all(
          color: Color(definition.accent).withValues(alpha: 0.7),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                roomIcon(room.id),
                color: Color(definition.accent),
                size: 27,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      definition.name,
                      style: const TextStyle(
                        color: GameColors.cream,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      roomStatus(room),
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${room.guests}/${room.capacity}',
                style: const TextStyle(
                  color: GameColors.gold,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              Text(
                'Выручка ${formatInt(room.revenue)} мон.',
                style: const TextStyle(
                  color: GameColors.cream,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'Сеансов ${room.completedSessions}',
                style: const TextStyle(
                  color: GameColors.cream,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'Загрузка $utilization%',
                style: TextStyle(
                  color: utilization < 70 ? GameColors.gold : GameColors.mint,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoomUpgradeCard extends StatelessWidget {
  const _RoomUpgradeCard({
    required this.snapshot,
    required this.room,
    required this.keyName,
    required this.recommended,
    required this.onBuy,
  });

  final GameSnapshot snapshot;
  final RoomSnapshot room;
  final RoomUpgradeKey keyName;
  final bool recommended;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final definition = roomDefinition(room.id);
    final level = room.upgrades.levelFor(keyName);
    final maxLevel = keyName == RoomUpgradeKey.capacity
        ? definition.maxCapacity
        : 5;
    final maxed = level >= maxLevel;
    final cost = getRoomUpgradeCost(room.id, keyName, level);
    final capacityWarning =
        keyName == RoomUpgradeKey.capacity &&
        room.recentSessions.isNotEmpty &&
        room.recentUtilization < 0.7;
    final effect = roomUpgradeEffect(room.id, keyName, room.upgrades);
    return _UpgradeCard(
      key: Key('room-upgrade-${room.id.name}-${keyName.name}'),
      effect: effect,
      level: level,
      maxLevel: maxLevel,
      cost: cost,
      currency: Currency.coins,
      affordable: snapshot.coins >= cost,
      recommended: recommended && !capacityWarning,
      warning: capacityWarning
          ? 'Сначала заполните текущие места хотя бы на 70%.'
          : null,
      maxed: maxed,
      onBuy: onBuy,
    );
  }
}

class _UpgradeCard extends StatelessWidget {
  const _UpgradeCard({
    super.key,
    required this.effect,
    required this.level,
    required this.maxLevel,
    required this.cost,
    required this.currency,
    required this.affordable,
    required this.recommended,
    required this.maxed,
    required this.onBuy,
    this.warning,
  });

  final UpgradeEffectView effect;
  final int level;
  final int maxLevel;
  final int cost;
  final Currency currency;
  final bool affordable;
  final bool recommended;
  final bool maxed;
  final VoidCallback onBuy;
  final String? warning;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label:
          '${effect.title}. ${effect.primary}. ${effect.secondary}. Уровень $level из $maxLevel.',
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: GameColors.paper,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(
            color: recommended ? GameColors.gold : GameColors.cream,
            width: recommended ? 2.5 : 1.5,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x38001920),
              blurRadius: 12,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            GameAssetIcon(effect.iconAsset, size: 48),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          effect.title,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: GameColors.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Text(
                        'УР. $level/$maxLevel',
                        style: const TextStyle(
                          color: GameColors.teal,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    effect.primary,
                    key: const Key('upgrade-primary-effect'),
                    style: const TextStyle(
                      color: GameColors.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    warning ?? effect.secondary,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: warning == null
                          ? const Color(0xFF5E6D69)
                          : const Color(0xFFB54C38),
                      fontSize: 10.5,
                      height: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (recommended)
                    const Padding(
                      padding: EdgeInsets.only(top: 3),
                      child: Text(
                        '★ РЕКОМЕНДУЕМ СЕЙЧАС',
                        style: TextStyle(
                          color: Color(0xFFB26900),
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 84,
              child: FilledButton(
                key: const Key('buy-upgrade-button'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: const Size(76, 48),
                  backgroundColor: GameColors.teal,
                  disabledBackgroundColor: const Color(0xFFD8D5C9),
                  disabledForegroundColor: const Color(0xFF7A7A72),
                ),
                onPressed: maxed || !affordable ? null : onBuy,
                child: maxed
                    ? const Text(
                        'MAX',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      )
                    : FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '${formatInt(cost)} ${currency == Currency.coins ? 'мон.' : 'реп.'}',
                          maxLines: 1,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
