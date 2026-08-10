import { ROOM_UPGRADE_DEFS, UPGRADE_DEFS } from '../game/config';
import type { GameSnapshot, RoomState, RoomUpgradeKey, UpgradeKey } from '../game/types';

export type UpgradeRecommendation<Key extends string> = {
  key: Key;
  reason: string;
};

export type RoomUpgradeGuidance = {
  recommendation: UpgradeRecommendation<RoomUpgradeKey> | null;
  capacityWarning: string | null;
};

const availableBarUpgrade = (snapshot: GameSnapshot, key: UpgradeKey) => {
  const definition = UPGRADE_DEFS.find((upgrade) => upgrade.key === key);
  return Boolean(definition && snapshot.upgrades[key] < definition.maxLevel);
};

const firstAvailableBarUpgrade = (snapshot: GameSnapshot, keys: UpgradeKey[]) =>
  keys.find((key) => availableBarUpgrade(snapshot, key)) ?? null;

export function getBarUpgradeRecommendation(snapshot: GameSnapshot): UpgradeRecommendation<UpgradeKey> | null {
  const { barDiagnostics: diagnostics } = snapshot;
  let preferred: UpgradeKey;
  let reason: string;

  if (diagnostics.primaryBottleneck === 'cleaning' || diagnostics.dirtyTables >= 2) {
    preferred = 'cleanSpeed';
    reason = `${diagnostics.dirtyTables} грязных столика задерживают новых гостей`;
  } else if (diagnostics.primaryBottleneck === 'drinks' || diagnostics.waitingDrinks >= 2) {
    preferred = 'prepSpeed';
    reason = `${diagnostics.waitingDrinks} гостя ждут напитки`;
  } else if (diagnostics.primaryBottleneck === 'orders' || diagnostics.waitingOrders >= 2) {
    preferred = 'orderSpeed';
    reason = `${diagnostics.waitingOrders} гостя ждут приёма заказа`;
  } else if (diagnostics.primaryBottleneck === 'payments' || diagnostics.waitingPayments >= 2) {
    preferred = 'moveSpeed';
    reason = `${diagnostics.waitingPayments} гостя ждут расчёта`;
  } else if (diagnostics.openTables >= 2 && diagnostics.blockedArrivals === 0) {
    preferred = 'advertising';
    reason = `${diagnostics.openTables} свободных столика — бар готов принять больше гостей`;
  } else {
    preferred = 'assortment';
    reason = diagnostics.blockedArrivals > 0
      ? `Бар заполнен: поднимите доход с каждого заказа`
      : 'Повышает среднюю цену заказа без дополнительной нагрузки на зал';
  }

  const key = availableBarUpgrade(snapshot, preferred)
    ? preferred
    : firstAvailableBarUpgrade(snapshot, ['assortment', 'prepSpeed', 'orderSpeed', 'moveSpeed', 'cleanSpeed', 'advertising']);

  return key ? { key, reason } : null;
}

const roomUpgradeAvailable = (room: RoomState, key: RoomUpgradeKey) => {
  const definition = ROOM_UPGRADE_DEFS.find((upgrade) => upgrade.key === key);
  return Boolean(definition && room.upgrades[key] < definition.maxLevel);
};

export function getRoomUpgradeGuidance(room: RoomState): RoomUpgradeGuidance {
  if (!room.unlocked) return { recommendation: null, capacityWarning: null };

  const sessions = room.recentSessions.length;
  const utilizationPercent = Math.round(room.recentUtilization * 100);
  const capacityWarning = sessions >= 3 && room.recentUtilization < 0.7
    ? `Недавняя загрузка ${utilizationPercent}% — новое место пока будет простаивать`
    : null;

  if (sessions < 3 && roomUpgradeAvailable(room, 'quality')) {
    return {
      recommendation: { key: 'quality', reason: 'Доход с каждого гостя растёт сразу, даже при неполной комнате' },
      capacityWarning,
    };
  }

  if (room.recentUtilization >= 0.85 && roomUpgradeAvailable(room, 'capacity')) {
    return {
      recommendation: { key: 'capacity', reason: `Загрузка ${utilizationPercent}% — дополнительное место будет востребовано` },
      capacityWarning,
    };
  }

  if (room.recentUtilization < 0.7 && roomUpgradeAvailable(room, 'quality')) {
    return {
      recommendation: { key: 'quality', reason: `Загрузка ${utilizationPercent}%: выгоднее повысить доход с текущих гостей` },
      capacityWarning,
    };
  }

  if (roomUpgradeAvailable(room, 'staffSpeed')) {
    return {
      recommendation: { key: 'staffSpeed', reason: 'Сокращает сеанс, уборку и подготовку между группами' },
      capacityWarning,
    };
  }

  if (roomUpgradeAvailable(room, 'quality')) {
    return {
      recommendation: { key: 'quality', reason: 'Повышает доход с каждого обслуженного гостя' },
      capacityWarning,
    };
  }

  return { recommendation: null, capacityWarning };
}
