import { ROOM_BLUEPRINTS, ROOM_IDS, type RoomId, type RoomUpgradeId } from '../content/rooms';
import {
  LEGACY_BACKUP_KEY,
  LEGACY_SAVE_KEY,
  V2_SAVE_KEY,
  makeDefaultProgressV2,
  type ProgressV2,
  type RoomLifecycleStage,
  type RoomProgressV2,
} from './schema';

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type ProgressLoadResult = {
  progress: ProgressV2;
  source: 'v2' | 'v1' | 'default';
  warnings: string[];
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finiteInteger = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < min) return fallback;
  return Math.min(max, Math.floor(value));
};

const booleanValue = (value: unknown, fallback: boolean) => (
  typeof value === 'boolean' ? value : fallback
);

const roomUpgradeLevel = (roomId: RoomId, upgradeId: RoomUpgradeId, value: unknown) => {
  const track = ROOM_BLUEPRINTS[roomId].upgrades.find((candidate) => candidate.id === upgradeId)!;
  return finiteInteger(value, 1, 1, track.maxLevel);
};

const parseRoomProgressV2 = (roomId: RoomId, value: unknown): RoomProgressV2 | null => {
  if (!isRecord(value)) return null;
  const lifecycleOptions: readonly RoomLifecycleStage[] = ['locked', 'permitted', 'renovating', 'equipping', 'open'];
  const lifecycle = lifecycleOptions.includes(value.lifecycle as RoomLifecycleStage)
    ? value.lifecycle as RoomLifecycleStage
    : null;
  if (!lifecycle || !isRecord(value.staff) || !isRecord(value.upgrades)) return null;

  const renovationStage = finiteInteger(value.renovationStage, 0, 0, 3) as 0 | 1 | 2 | 3;
  return {
    lifecycle,
    renovationStage,
    completedSessions: finiteInteger(value.completedSessions, 0),
    revenue: finiteInteger(value.revenue, 0),
    staff: {
      hired: booleanValue(value.staff.hired, false),
      level: finiteInteger(value.staff.level, 1, 1, 5),
    },
    upgrades: {
      staffSpeed: roomUpgradeLevel(roomId, 'staffSpeed', value.upgrades.staffSpeed),
      capacity: roomUpgradeLevel(roomId, 'capacity', value.upgrades.capacity),
      quality: roomUpgradeLevel(roomId, 'quality', value.upgrades.quality),
    },
  };
};

export const parseProgressV2 = (raw: string): ProgressV2 | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.rooms) || !isRecord(value.barUpgrades)) return null;

    const rooms = {} as Record<RoomId, RoomProgressV2>;
    for (const roomId of ROOM_IDS) {
      const room = parseRoomProgressV2(roomId, value.rooms[roomId]);
      if (!room) return null;
      rooms[roomId] = room;
    }

    const barUpgrades: Record<string, number> = {};
    for (const [key, level] of Object.entries(value.barUpgrades)) {
      barUpgrades[key] = finiteInteger(level, 1, 1, 20);
    }

    return {
      schemaVersion: 2,
      coins: finiteInteger(value.coins, 64),
      prestige: finiteInteger(value.prestige, 3),
      served: finiteInteger(value.served, 0),
      day: finiteInteger(value.day, 1, 1),
      soundEnabled: booleanValue(value.soundEnabled, true),
      totalOperatingRevenue: finiteInteger(value.totalOperatingRevenue, 0),
      totalDayBonus: finiteInteger(value.totalDayBonus, 0),
      barUpgrades,
      rooms,
      migratedFromV1: booleanValue(value.migratedFromV1, false),
    };
  } catch {
    return null;
  }
};

export const migrateLegacyProgress = (raw: string): ProgressV2 | null => {
  try {
    const legacy: unknown = JSON.parse(raw);
    if (!isRecord(legacy)) return null;

    const migrated = makeDefaultProgressV2();
    migrated.coins = finiteInteger(legacy.coins, migrated.coins);
    migrated.prestige = finiteInteger(legacy.reputation, migrated.prestige);
    migrated.served = finiteInteger(legacy.served, migrated.served);
    migrated.day = finiteInteger(legacy.day, migrated.day, 1);
    migrated.soundEnabled = booleanValue(legacy.soundEnabled, migrated.soundEnabled);
    migrated.totalOperatingRevenue = finiteInteger(legacy.totalOperatingRevenue, 0);
    migrated.totalDayBonus = finiteInteger(legacy.totalDayBonus, 0);
    migrated.migratedFromV1 = true;

    if (isRecord(legacy.upgrades)) {
      for (const [key, value] of Object.entries(legacy.upgrades)) {
        migrated.barUpgrades[key] = finiteInteger(value, 1, 1, 20);
      }
    }

    if (isRecord(legacy.rooms)) {
      for (const roomId of ROOM_IDS) {
        const oldRoom = legacy.rooms[roomId];
        if (!isRecord(oldRoom)) continue;
        const unlocked = oldRoom.unlocked === true;
        const oldUpgrades = isRecord(oldRoom.upgrades) ? oldRoom.upgrades : {};
        migrated.rooms[roomId] = {
          lifecycle: unlocked ? 'open' : 'locked',
          renovationStage: unlocked ? 3 : 0,
          completedSessions: finiteInteger(oldRoom.completedSessions, 0),
          revenue: finiteInteger(oldRoom.revenue, 0),
          staff: { hired: unlocked, level: roomUpgradeLevel(roomId, 'staffSpeed', oldUpgrades.staffSpeed) },
          upgrades: {
            staffSpeed: roomUpgradeLevel(roomId, 'staffSpeed', oldUpgrades.staffSpeed),
            capacity: roomUpgradeLevel(roomId, 'capacity', oldUpgrades.capacity),
            quality: roomUpgradeLevel(roomId, 'quality', oldUpgrades.quality),
          },
        };
      }
    }

    return migrated;
  } catch {
    return null;
  }
};

const safeGet = (storage: SaveStorage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: SaveStorage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const loadOrMigrateProgress = (storage: SaveStorage): ProgressLoadResult => {
  const warnings: string[] = [];
  const currentRaw = safeGet(storage, V2_SAVE_KEY);
  if (currentRaw) {
    const current = parseProgressV2(currentRaw);
    if (current) return { progress: current, source: 'v2', warnings };
    warnings.push('The v2 save is invalid; it was preserved and ignored.');
  }

  const legacyRaw = safeGet(storage, LEGACY_SAVE_KEY);
  if (!legacyRaw) return { progress: makeDefaultProgressV2(), source: 'default', warnings };

  if (!safeGet(storage, LEGACY_BACKUP_KEY) && !safeSet(storage, LEGACY_BACKUP_KEY, legacyRaw)) {
    warnings.push('The legacy save backup could not be written.');
  }

  const migrated = migrateLegacyProgress(legacyRaw);
  if (!migrated) {
    warnings.push('The legacy save is invalid; it was preserved and ignored.');
    return { progress: makeDefaultProgressV2(), source: 'default', warnings };
  }

  if (!safeSet(storage, V2_SAVE_KEY, JSON.stringify(migrated))) {
    warnings.push('The migrated v2 save could not be persisted.');
  }
  return { progress: migrated, source: 'v1', warnings };
};
