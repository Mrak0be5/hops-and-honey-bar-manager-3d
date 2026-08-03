export type RoomId = 'karaoke' | 'sauna' | 'massage';

export type RoomUpgradeId = 'staffSpeed' | 'capacity' | 'quality';

export const ROOM_LIFECYCLE_STAGE_IDS = ['permit', 'renovate', 'equip', 'hire'] as const;
export type RoomLifecycleStageId = (typeof ROOM_LIFECYCLE_STAGE_IDS)[number];
export type RoomLifecycleState = 'locked' | 'permitted' | 'renovating' | 'equipping' | 'open';
export type RoomRenovationStage = 0 | 1 | 2 | 3;
export type RoomUpgradeLevels = Record<RoomUpgradeId, number>;

export const ROOM_LIFECYCLE_STAGE_SHARES: Readonly<Record<RoomLifecycleStageId, number>> = Object.freeze({
  permit: 0.2,
  renovate: 0.35,
  equip: 0.3,
  hire: 0.15,
});

export type RoomLifecycleStageCosts = Readonly<Record<RoomLifecycleStageId, number>>;

export type RoomUpgradeTrack = Readonly<{
  id: RoomUpgradeId;
  displayName: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  effectPerLevel: number;
}>;

export type RoomStaffDefinition = Readonly<{
  role: 'karaoke_host' | 'sauna_attendant' | 'massage_therapist';
  displayName: string;
  serviceTaskName: string;
  salaryPerShift: number;
}>;

export type RoomBlueprint = Readonly<{
  id: RoomId;
  displayName: string;
  tagline: string;
  wingSize: Readonly<{ x: 12; z: 10 }>;
  totalOpenCost: number;
  stageCosts: RoomLifecycleStageCosts;
  /** Compatibility alias for UI code that still presents a single purchase. */
  unlockCost: number;
  baseProfit: number;
  serviceSeconds: number;
  baseCapacity: number;
  maxCapacity: number;
  staff: RoomStaffDefinition;
  upgrades: readonly RoomUpgradeTrack[];
  assetKeys: Readonly<{
    shell: string;
    repairedInterior: string;
    lockedInterior: string;
    lighting: string;
    vfx: string;
    audio: string;
  }>;
  availableInVerticalSlice: boolean;
}>;

const commonUpgradeTracks = (
  speedCost: number,
  capacityCost: number,
  qualityCost: number,
): readonly RoomUpgradeTrack[] => [
  {
    id: 'staffSpeed',
    displayName: 'Staff mastery',
    baseCost: speedCost,
    costGrowth: 1.45,
    maxLevel: 5,
    effectPerLevel: 0.12,
  },
  {
    id: 'capacity',
    displayName: 'Guest capacity',
    baseCost: capacityCost,
    costGrowth: 1.62,
    maxLevel: 5,
    effectPerLevel: 1,
  },
  {
    id: 'quality',
    displayName: 'Premium service',
    baseCost: qualityCost,
    costGrowth: 1.45,
    maxLevel: 5,
    effectPerLevel: 0.15,
  },
];

const makeStageCosts = (totalOpenCost: number): RoomLifecycleStageCosts => {
  const permit = Math.round(totalOpenCost * ROOM_LIFECYCLE_STAGE_SHARES.permit);
  const renovate = Math.round(totalOpenCost * ROOM_LIFECYCLE_STAGE_SHARES.renovate);
  const equip = Math.round(totalOpenCost * ROOM_LIFECYCLE_STAGE_SHARES.equip);
  // The final stage absorbs any sub-coin rounding so the ledger always lands
  // on the exact advertised opening total.
  const hire = totalOpenCost - permit - renovate - equip;
  return Object.freeze({ permit, renovate, equip, hire });
};

export const ROOM_BLUEPRINTS = {
  karaoke: {
    id: 'karaoke',
    displayName: 'Amber Karaoke',
    tagline: 'A stage, a host and high-margin evening sessions.',
    wingSize: { x: 12, z: 10 },
    totalOpenCost: 750,
    stageCosts: makeStageCosts(750),
    unlockCost: 750,
    baseProfit: 24,
    serviceSeconds: 32,
    baseCapacity: 1,
    maxCapacity: 4,
    staff: {
      role: 'karaoke_host',
      displayName: 'Karaoke host',
      serviceTaskName: 'Host karaoke session',
      salaryPerShift: 22,
    },
    upgrades: commonUpgradeTracks(80, 260, 95),
    assetKeys: {
      shell: 'venue.room.karaoke.shell',
      repairedInterior: 'venue.room.karaoke.repaired',
      lockedInterior: 'venue.room.karaoke.locked',
      lighting: 'venue.room.karaoke.lighting',
      vfx: 'fx.room.karaoke.session',
      audio: 'audio.room.karaoke.session',
    },
    availableInVerticalSlice: true,
  },
  sauna: {
    id: 'sauna',
    displayName: 'Amber Sauna',
    tagline: 'A premium steam room with slower, more profitable sessions.',
    wingSize: { x: 12, z: 10 },
    totalOpenCost: 1_800,
    stageCosts: makeStageCosts(1_800),
    unlockCost: 1_800,
    baseProfit: 48,
    serviceSeconds: 42,
    baseCapacity: 1,
    maxCapacity: 4,
    staff: {
      role: 'sauna_attendant',
      displayName: 'Sauna attendant',
      serviceTaskName: 'Run sauna session',
      salaryPerShift: 38,
    },
    upgrades: commonUpgradeTracks(140, 700, 165),
    assetKeys: {
      shell: 'venue.room.sauna.shell',
      repairedInterior: 'venue.room.sauna.repaired',
      lockedInterior: 'venue.room.sauna.locked',
      lighting: 'venue.room.sauna.lighting',
      vfx: 'fx.room.sauna.session',
      audio: 'audio.room.sauna.session',
    },
    availableInVerticalSlice: false,
  },
  massage: {
    id: 'massage',
    displayName: 'Amber Massage',
    tagline: 'A small luxury treatment room with the highest spend per guest.',
    wingSize: { x: 12, z: 10 },
    totalOpenCost: 3_600,
    stageCosts: makeStageCosts(3_600),
    unlockCost: 3_600,
    baseProfit: 95,
    serviceSeconds: 48,
    baseCapacity: 1,
    maxCapacity: 2,
    staff: {
      role: 'massage_therapist',
      displayName: 'Massage therapist',
      serviceTaskName: 'Perform massage session',
      salaryPerShift: 58,
    },
    upgrades: commonUpgradeTracks(220, 1_350, 250),
    assetKeys: {
      shell: 'venue.room.massage.shell',
      repairedInterior: 'venue.room.massage.repaired',
      lockedInterior: 'venue.room.massage.locked',
      lighting: 'venue.room.massage.lighting',
      vfx: 'fx.room.massage.session',
      audio: 'audio.room.massage.session',
    },
    availableInVerticalSlice: false,
  },
} as const satisfies Record<RoomId, RoomBlueprint>;

export const ROOM_IDS = Object.freeze(Object.keys(ROOM_BLUEPRINTS) as RoomId[]);

export const getRoomBlueprint = (roomId: RoomId): RoomBlueprint => ROOM_BLUEPRINTS[roomId];

export const getRoomLifecycleStageCost = (roomId: RoomId, stageId: RoomLifecycleStageId) => (
  getRoomBlueprint(roomId).stageCosts[stageId]
);

export const getRoomUpgradeCost = (roomId: RoomId, upgradeId: RoomUpgradeId, currentLevel: number) => {
  const track = getRoomBlueprint(roomId).upgrades.find((candidate) => candidate.id === upgradeId);
  if (!track) throw new Error(`Unknown room upgrade: ${roomId}.${upgradeId}`);
  if (!Number.isInteger(currentLevel) || currentLevel < 1 || currentLevel >= track.maxLevel) return 0;
  return Math.ceil(track.baseCost * track.costGrowth ** (currentLevel - 1));
};

export const getRoomSessionProfit = (roomId: RoomId, qualityLevel: number, guests: number) => {
  const room = getRoomBlueprint(roomId);
  const qualityTrack = room.upgrades.find((candidate) => candidate.id === 'quality')!;
  const safeQuality = Math.max(1, Math.min(qualityTrack.maxLevel, Math.floor(qualityLevel)));
  const safeGuests = Math.max(0, Math.min(room.maxCapacity, Math.floor(guests)));
  return Math.round(room.baseProfit * safeGuests * (1 + (safeQuality - 1) * qualityTrack.effectPerLevel));
};

export const getRoomCapacity = (roomId: RoomId, capacityLevel: number, physicalSlotCount?: number) => {
  const room = getRoomBlueprint(roomId);
  const track = room.upgrades.find((candidate) => candidate.id === 'capacity')!;
  const safeLevel = Math.max(1, Math.min(track.maxLevel, Math.floor(capacityLevel)));
  const physicalLimit = Math.max(1, Math.floor(physicalSlotCount ?? room.maxCapacity));
  return Math.min(room.maxCapacity, physicalLimit, room.baseCapacity + safeLevel - 1);
};

export const getRoomStaffSpeedMultiplier = (roomId: RoomId, staffSpeedLevel: number) => {
  const room = getRoomBlueprint(roomId);
  const track = room.upgrades.find((candidate) => candidate.id === 'staffSpeed')!;
  const safeLevel = Math.max(1, Math.min(track.maxLevel, Math.floor(staffSpeedLevel)));
  return (1 - track.effectPerLevel) ** (safeLevel - 1);
};
