import { ROOM_IDS, type RoomId, type RoomUpgradeId } from '../content/rooms';

export const LEGACY_SAVE_KEY = 'hops-and-honey-save-v1';
export const LEGACY_BACKUP_KEY = 'hops-and-honey-save-v1-backup';
export const V2_SAVE_KEY = 'hops-and-honey-save-v2';

export type RoomLifecycleStage = 'locked' | 'permitted' | 'renovating' | 'equipping' | 'open';

export type RoomProgressV2 = {
  lifecycle: RoomLifecycleStage;
  renovationStage: 0 | 1 | 2 | 3;
  completedSessions: number;
  revenue: number;
  staff: {
    hired: boolean;
    level: number;
  };
  upgrades: Record<RoomUpgradeId, number>;
};

export type ProgressV2 = {
  schemaVersion: 2;
  coins: number;
  prestige: number;
  served: number;
  day: number;
  soundEnabled: boolean;
  totalOperatingRevenue: number;
  totalDayBonus: number;
  barUpgrades: Record<string, number>;
  rooms: Record<RoomId, RoomProgressV2>;
  migratedFromV1: boolean;
};

export const makeDefaultRoomProgress = (): RoomProgressV2 => ({
  lifecycle: 'locked',
  renovationStage: 0,
  completedSessions: 0,
  revenue: 0,
  staff: { hired: false, level: 1 },
  upgrades: { staffSpeed: 1, capacity: 1, quality: 1 },
});

export const makeDefaultProgressV2 = (): ProgressV2 => ({
  schemaVersion: 2,
  coins: 64,
  prestige: 3,
  served: 0,
  day: 1,
  soundEnabled: true,
  totalOperatingRevenue: 0,
  totalDayBonus: 0,
  barUpgrades: {
    moveSpeed: 1,
    orderSpeed: 1,
    prepSpeed: 1,
    cleanSpeed: 1,
    assortment: 1,
    advertising: 1,
  },
  rooms: Object.fromEntries(ROOM_IDS.map((roomId) => [roomId, makeDefaultRoomProgress()])) as Record<RoomId, RoomProgressV2>,
  migratedFromV1: false,
});
