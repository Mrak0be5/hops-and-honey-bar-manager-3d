import { describe, expect, it } from 'vitest';
import {
  getRoomBlueprint,
  getRoomLifecycleStageCost,
  getRoomSessionProfit,
  getRoomStaffSpeedMultiplier,
  getRoomUpgradeCost,
  ROOM_IDS,
  ROOM_LIFECYCLE_STAGE_IDS,
} from '../../src/v2/content/rooms';
import type { RoomId, RoomLifecycleState, RoomRenovationStage } from '../../src/v2/content/rooms';
import { AMBER_CLUB_VENUE } from '../../src/v2/level/venueBlueprint';
import { AmberClubSimulation, secondsToTicks } from '../../src/v2/simulation/AmberClubSimulation';

const BALANCE_SPEC = {
  karaoke: {
    total: 750,
    stages: { permit: 150, renovate: 263, equip: 225, hire: 112 },
    baseProfit: 24,
    serviceSeconds: 32,
    maxCapacity: 4,
    salary: 22,
  },
  sauna: {
    total: 1_800,
    stages: { permit: 360, renovate: 630, equip: 540, hire: 270 },
    baseProfit: 48,
    serviceSeconds: 42,
    maxCapacity: 4,
    salary: 38,
  },
  massage: {
    total: 3_600,
    stages: { permit: 720, renovate: 1_260, equip: 1_080, hire: 540 },
    baseProfit: 95,
    serviceSeconds: 48,
    maxCapacity: 2,
    salary: 58,
  },
} as const;

const LIFECYCLE_AFTER_STAGE: readonly Readonly<{
  lifecycle: RoomLifecycleState;
  renovationStage: RoomRenovationStage;
}>[] = [
  { lifecycle: 'permitted', renovationStage: 1 },
  { lifecycle: 'renovating', renovationStage: 2 },
  { lifecycle: 'equipping', renovationStage: 3 },
  { lifecycle: 'open', renovationStage: 3 },
];

const roomState = (simulation: AmberClubSimulation, roomId: RoomId) => (
  simulation.getState().rooms.find((room) => room.id === roomId)!
);

const advanceUntil = (
  simulation: AmberClubSimulation,
  predicate: () => boolean,
  maxTicks = 4_000,
) => {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (predicate()) return;
    simulation.tick();
  }
  throw new Error(`Condition was not reached within ${maxTicks} simulation ticks.`);
};

describe('Amber Club room economy specification', () => {
  it('keeps the approved totals, integer stage allocation, balance and five-level tracks', () => {
    for (const roomId of ROOM_IDS) {
      const definition = getRoomBlueprint(roomId);
      const expected = BALANCE_SPEC[roomId];
      expect(definition).toMatchObject({
        totalOpenCost: expected.total,
        unlockCost: expected.total,
        stageCosts: expected.stages,
        baseProfit: expected.baseProfit,
        serviceSeconds: expected.serviceSeconds,
        maxCapacity: expected.maxCapacity,
      });
      expect(definition.staff.salaryPerShift).toBe(expected.salary);
      expect(ROOM_LIFECYCLE_STAGE_IDS.reduce(
        (sum, stageId) => sum + getRoomLifecycleStageCost(roomId, stageId),
        0,
      )).toBe(expected.total);
      expect(definition.upgrades).toHaveLength(3);
      expect(definition.upgrades.every((track) => track.maxLevel === 5)).toBe(true);
      const physicalSlots = AMBER_CLUB_VENUE.slots.filter((slot) => (
        slot.kind === 'room_guest' && slot.roomId === roomId
      )).length;
      expect(physicalSlots).toBe(expected.maxCapacity);
    }
  });

  it.each(ROOM_IDS)('advances %s atomically through permit, renovation, equipment and hire', (roomId) => {
    const definition = getRoomBlueprint(roomId);
    const simulation = new AmberClubSimulation({
      seed: 31,
      autoSpawn: false,
      initialBalance: definition.totalOpenCost,
    });

    expect(roomState(simulation, roomId)).toMatchObject({
      lifecycle: 'locked',
      renovationStage: 0,
      unlocked: false,
      staff: { hired: false },
    });
    expect(simulation.getState().staff.some((staff) => staff.roomId === roomId)).toBe(false);

    ROOM_LIFECYCLE_STAGE_IDS.forEach((stageId, index) => {
      const balanceBefore = simulation.getState().balance;
      expect(simulation.advanceRoomLifecycle(roomId)).toBe(true);
      const state = simulation.getState();
      const room = roomState(simulation, roomId);
      expect(room).toMatchObject(LIFECYCLE_AFTER_STAGE[index]);
      expect(state.balance).toBe(balanceBefore - definition.stageCosts[stageId]);
      expect(state.ledger.at(-1)).toMatchObject({
        kind: 'room_lifecycle',
        amount: -definition.stageCosts[stageId],
        roomId,
      });
      expect(state.events).toContainEqual(expect.objectContaining({
        kind: 'room_lifecycle_advanced',
        roomId,
        lifecycleStageId: stageId,
      }));
      expect(room.staff.hired).toBe(stageId === 'hire');
      expect(state.staff.some((staff) => staff.roomId === roomId)).toBe(stageId === 'hire');
    });

    expect(simulation.getState().balance).toBe(0);
    expect(simulation.advanceRoomLifecycle(roomId)).toBe(false);
  });

  it('does not mutate lifecycle or ledger when funds are insufficient', () => {
    for (const roomId of ROOM_IDS) {
      const permitCost = getRoomLifecycleStageCost(roomId, 'permit');
      const simulation = new AmberClubSimulation({
        autoSpawn: false,
        initialBalance: permitCost - 1,
      });
      const before = simulation.getState();
      expect(simulation.advanceRoomLifecycle(roomId)).toBe(false);
      expect(simulation.unlockRoom(roomId)).toBe(false);
      const after = simulation.getState();
      expect(after.balance).toBe(before.balance);
      expect(after.ledger).toEqual(before.ledger);
      expect(roomState(simulation, roomId)).toMatchObject({
        lifecycle: 'locked',
        unlocked: false,
        staff: { hired: false },
      });
    }
  });

  it('charges only the missing lifecycle stages through the compatibility helper', () => {
    const simulation = new AmberClubSimulation({ autoSpawn: false, initialBalance: 750 });
    expect(simulation.advanceRoomLifecycle('karaoke')).toBe(true);
    expect(simulation.advanceRoomLifecycle('karaoke')).toBe(true);
    expect(simulation.unlockRoom('karaoke')).toBe(true);

    const state = simulation.getState();
    expect(state.balance).toBe(0);
    expect(state.ledger.at(-1)).toMatchObject({
      kind: 'room_unlock',
      amount: -(BALANCE_SPEC.karaoke.stages.equip + BALANCE_SPEC.karaoke.stages.hire),
    });
    expect(roomState(simulation, 'karaoke')).toMatchObject({
      lifecycle: 'open',
      renovationStage: 3,
      unlocked: true,
      staff: { hired: true, salaryPerShift: 22 },
    });
  });

  it('hydrates lifecycle and upgrade progress without ledger deductions and prioritizes initialRooms', () => {
    const simulation = new AmberClubSimulation({
      autoSpawn: false,
      initialBalance: 777,
      unlockedRooms: ['sauna'],
      initialRooms: {
        karaoke: {
          lifecycle: 'open',
          upgrades: { staffSpeed: 3, capacity: 5, quality: 4 },
          completedSessions: 7,
          revenue: 321,
        },
        sauna: {
          lifecycle: 'permitted',
          renovationStage: 1,
          upgrades: { staffSpeed: 2, capacity: 2, quality: 2 },
        },
      },
    });

    expect(simulation.getState().balance).toBe(777);
    expect(simulation.getState().ledger).toHaveLength(1);
    expect(roomState(simulation, 'karaoke')).toMatchObject({
      lifecycle: 'open',
      renovationStage: 3,
      unlocked: true,
      capacity: 4,
      completedSessions: 7,
      revenue: 321,
      staff: { hired: true, level: 3 },
      upgrades: { staffSpeed: 3, capacity: 5, quality: 4 },
    });
    expect(roomState(simulation, 'sauna')).toMatchObject({
      lifecycle: 'permitted',
      renovationStage: 1,
      unlocked: false,
      staff: { hired: false },
    });
    expect(simulation.getState().staff.find((staff) => staff.roomId === 'karaoke')).toMatchObject({
      level: 3,
      salaryPerShift: 22,
    });
    expect(simulation.getState().staff.some((staff) => staff.roomId === 'sauna')).toBe(false);
  });
});

describe('Amber Club room upgrades', () => {
  it.each(ROOM_IDS)('purchases every %s track to level five and applies the physical capacity cap', (roomId) => {
    const simulation = new AmberClubSimulation({
      autoSpawn: false,
      initialBalance: 1_000_000,
      unlockedRooms: [roomId],
    });
    let expectedBalance = simulation.getState().balance;

    for (const upgradeId of ['staffSpeed', 'capacity', 'quality'] as const) {
      for (let currentLevel = 1; currentLevel < 5; currentLevel += 1) {
        const cost = getRoomUpgradeCost(roomId, upgradeId, currentLevel);
        expect(simulation.purchaseRoomUpgrade(roomId, upgradeId)).toBe(true);
        expectedBalance -= cost;
      }
      expect(simulation.purchaseRoomUpgrade(roomId, upgradeId)).toBe(false);
      expect(roomState(simulation, roomId).upgrades[upgradeId]).toBe(5);
    }

    const state = simulation.getState();
    const room = roomState(simulation, roomId);
    const physicalSlots = AMBER_CLUB_VENUE.slots.filter((slot) => (
      slot.kind === 'room_guest' && slot.roomId === roomId
    )).length;
    expect(state.balance).toBe(expectedBalance);
    expect(room.capacity).toBe(Math.min(getRoomBlueprint(roomId).maxCapacity, physicalSlots));
    expect(state.staff.find((staff) => staff.roomId === roomId)?.level).toBe(5);
    expect(state.events).toContainEqual(expect.objectContaining({
      kind: 'room_upgrade_purchased',
      roomId,
      upgradeId: 'quality',
      upgradeLevel: 5,
    }));
  });

  it('rejects upgrades before hire and when the next level is unaffordable', () => {
    const locked = new AmberClubSimulation({ autoSpawn: false, initialBalance: 100_000 });
    expect(locked.purchaseRoomUpgrade('karaoke', 'quality')).toBe(false);

    const cost = getRoomUpgradeCost('karaoke', 'quality', 1);
    const poor = new AmberClubSimulation({
      autoSpawn: false,
      initialBalance: cost - 1,
      unlockedRooms: ['karaoke'],
    });
    const before = poor.getState();
    expect(poor.purchaseRoomUpgrade('karaoke', 'quality')).toBe(false);
    expect(poor.getState().balance).toBe(before.balance);
    expect(roomState(poor, 'karaoke').upgrades.quality).toBe(1);
  });

  it.each(ROOM_IDS)('applies %s speed to service duration and quality to paid profit', (roomId) => {
    const simulation = new AmberClubSimulation({
      seed: 71,
      autoSpawn: false,
      roomVisitChance: 1,
      initialRooms: {
        [roomId]: {
          lifecycle: 'open',
          upgrades: { staffSpeed: 2, capacity: 1, quality: 2 },
        },
      },
    });
    simulation.start();
    const guestId = simulation.spawnGuest()!;
    advanceUntil(simulation, () => (
      simulation.getState().guests.find((guest) => guest.id === guestId)?.phase === 'in_room'
    ));

    const staffTask = simulation.getState().staff.find((staff) => staff.roomId === roomId)?.task;
    expect(staffTask).toMatchObject({ kind: 'host_room', roomId });
    expect(staffTask?.totalTicks).toBe(secondsToTicks(
      getRoomBlueprint(roomId).serviceSeconds * getRoomStaffSpeedMultiplier(roomId, 2),
    ));

    advanceUntil(simulation, () => (
      simulation.getState().guests.find((guest) => guest.id === guestId)?.phase === 'departed'
    ));
    expect(roomState(simulation, roomId).revenue).toBe(getRoomSessionProfit(roomId, 2, 1));
  });
});

describe('deterministic room utility choice', () => {
  it('reproduces utility scores and the chosen room for the same seed', () => {
    const options = {
      seed: 0x51a7,
      autoSpawn: false,
      roomVisitChance: 1,
      unlockedRooms: ROOM_IDS,
    } as const;
    const first = new AmberClubSimulation(options);
    const second = new AmberClubSimulation(options);
    expect(second.getRoomChoiceUtilities('guest-1')).toEqual(first.getRoomChoiceUtilities('guest-1'));
    first.start();
    second.start();
    const firstGuest = first.spawnGuest()!;
    const secondGuest = second.spawnGuest()!;
    advanceUntil(first, () => Boolean(first.getState().guests[0]?.roomVisit));
    advanceUntil(second, () => Boolean(second.getState().guests[0]?.roomVisit));
    expect(second.getState().guests.find((guest) => guest.id === secondGuest)?.roomVisit?.roomId)
      .toBe(first.getState().guests.find((guest) => guest.id === firstGuest)?.roomVisit?.roomId);
  });

  it('excludes rooms without hired staff and rooms at physical capacity', () => {
    const unstaffed = new AmberClubSimulation({
      seed: 3,
      autoSpawn: false,
      initialRooms: {
        karaoke: { lifecycle: 'equipping' },
        sauna: { lifecycle: 'open' },
      },
    });
    expect(unstaffed.getRoomChoiceUtilities('guest-1').map((choice) => choice.roomId)).toEqual(['sauna']);

    const simulation = new AmberClubSimulation({
      seed: 11,
      autoSpawn: false,
      maxActiveGuests: 2,
      roomVisitChance: 1,
      unlockedRooms: ROOM_IDS,
    });
    simulation.start();
    const firstGuest = simulation.spawnGuest()!;
    advanceUntil(simulation, () => (
      simulation.getState().guests.find((guest) => guest.id === firstGuest)?.phase === 'choosing_room'
    ));
    expect(simulation.requestRoomVisit(firstGuest, 'massage')).toBe(true);
    const secondGuest = simulation.spawnGuest()!;
    expect(secondGuest).toBeTruthy();
    advanceUntil(simulation, () => (
      simulation.getState().guests.find((guest) => guest.id === secondGuest)?.phase === 'choosing_room'
    ));

    expect(roomState(simulation, 'massage').reservedGuestIds).toContain(firstGuest);
    expect(simulation.getRoomChoiceUtilities(secondGuest).some((choice) => choice.roomId === 'massage')).toBe(false);
    simulation.tick();
    expect(simulation.getState().guests.find((guest) => guest.id === secondGuest)?.roomVisit?.roomId)
      .not.toBe('massage');
  });
});
