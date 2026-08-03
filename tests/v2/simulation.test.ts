import { describe, expect, it } from 'vitest';
import { getRoomBlueprint } from '../../src/v2/content/rooms';
import {
  AmberClubSimulation,
  BAR_SALE_PRICE,
  FIXED_DELTA_SECONDS,
  GUEST_MOVE_SPEED_METERS_PER_SECOND,
  secondsToTicks,
} from '../../src/v2/simulation/AmberClubSimulation';
import { Ledger } from '../../src/v2/simulation/Ledger';

const ROOM_PHASES = new Set(['walking_to_room', 'waiting_room', 'in_room']);

describe('Amber Club v2 fixed-step simulation', () => {
  it('starts manually and rejects every room request before barVisit.completed', () => {
    const simulation = new AmberClubSimulation({ seed: 7, autoSpawn: false, roomVisitChance: 1 });
    simulation.tick();
    expect(simulation.getState().tick).toBe(0);
    expect(simulation.getState().guests).toHaveLength(0);

    simulation.start();
    const guestId = simulation.spawnGuest();
    expect(guestId).toBeTruthy();
    expect(simulation.requestRoomVisit(guestId!, 'karaoke')).toBe(false);
    const guest = simulation.getState().guests.find((candidate) => candidate.id === guestId)!;
    expect(guest.barVisit.completed).toBe(false);
    expect(ROOM_PHASES.has(guest.phase)).toBe(false);
  });

  it('runs entry -> bar service -> payment -> karaoke -> exit with staff tasks and ledger order', () => {
    const simulation = new AmberClubSimulation({
      seed: 19,
      autoSpawn: false,
      roomVisitChance: 1,
      unlockedRooms: ['karaoke'],
    });
    simulation.start();
    const guestId = simulation.spawnGuest();
    expect(guestId).toBeTruthy();
    const observedPhases = new Set<string>();

    for (let tick = 0; tick < 2_000; tick += 1) {
      simulation.tick();
      const guest = simulation.getState().guests.find((candidate) => candidate.id === guestId)!;
      observedPhases.add(guest.phase);
      if (ROOM_PHASES.has(guest.phase)) expect(guest.barVisit.completed).toBe(true);
      if (guest.phase === 'departed') break;
    }

    const state = simulation.getState();
    const guest = state.guests.find((candidate) => candidate.id === guestId)!;
    expect(guest.phase).toBe('departed');
    expect(guest.barVisit.completed).toBe(true);
    expect(guest.roomVisit).toEqual({ roomId: 'karaoke', completed: true });
    for (const event of state.events) {
      if (event.kind === 'guest_phase_changed' && event.guestId === guestId && event.toPhase) {
        observedPhases.add(event.toPhase);
      }
    }
    for (const expectedPhase of [
      'walking_to_bar',
      'waiting_order',
      'ordering',
      'waiting_drink',
      'drinking',
      'waiting_payment',
      'paying',
      'walking_to_room',
      'waiting_room',
      'in_room',
      'leaving',
      'departed',
    ]) {
      expect(observedPhases.has(expectedPhase)).toBe(true);
    }

    const barEntryIndex = state.ledger.findIndex((entry) => entry.kind === 'bar_revenue' && entry.guestId === guestId);
    const roomEntryIndex = state.ledger.findIndex((entry) => entry.kind === 'room_revenue' && entry.guestId === guestId);
    expect(barEntryIndex).toBeGreaterThan(0);
    expect(roomEntryIndex).toBeGreaterThan(barEntryIndex);
    expect(state.balance).toBe(600 + BAR_SALE_PRICE + getRoomBlueprint('karaoke').baseProfit);
    expect(state.rooms.find((room) => room.id === 'karaoke')).toMatchObject({
      completedSessions: 1,
      revenue: getRoomBlueprint('karaoke').baseProfit,
      reservedGuestIds: [],
      activeGuestIds: [],
    });
    const completedTaskKinds = state.events
      .filter((event) => event.kind === 'task_completed' && event.guestId === guestId)
      .map((event) => event.taskKind);
    expect(completedTaskKinds).toEqual([
      'take_order',
      'prepare_drink',
      'deliver_drink',
      'take_payment',
      'host_room',
    ]);
  });

  it('keeps the room visit optional after payment', () => {
    const simulation = new AmberClubSimulation({ seed: 23, autoSpawn: false, roomVisitChance: 0 });
    simulation.start();
    const guestId = simulation.spawnGuest()!;
    for (let tick = 0; tick < 1_200; tick += 1) {
      simulation.tick();
      if (simulation.getState().guests.find((guest) => guest.id === guestId)?.phase === 'departed') break;
    }
    const state = simulation.getState();
    expect(state.guests.find((guest) => guest.id === guestId)?.roomVisit).toBeNull();
    expect(state.ledger.some((entry) => entry.kind === 'bar_revenue')).toBe(true);
    expect(state.ledger.some((entry) => entry.kind === 'room_revenue')).toBe(false);
  });

  it('is deterministic for the same seed and input command stream', () => {
    const options = {
      seed: 0x12345678,
      autoSpawn: true,
      spawnIntervalTicks: secondsToTicks(11),
      maxActiveGuests: 3,
      roomVisitChance: 0.72,
    } as const;
    const first = new AmberClubSimulation(options);
    const second = new AmberClubSimulation(options);
    first.start();
    second.start();
    first.advanceTicks(1_500);
    second.advanceTicks(1_500);
    expect(second.getState()).toEqual(first.getState());
  });

  it('moves at physical grid speed instead of one cell per fixed tick', () => {
    const simulation = new AmberClubSimulation({ seed: 101, autoSpawn: false });
    simulation.start();
    const guestId = simulation.spawnGuest()!;
    const spawnedGuest = simulation.getState().guests.find((guest) => guest.id === guestId)!;
    const route = [spawnedGuest.cell, ...spawnedGuest.route];
    const pathCostCells = route.slice(1).reduce((total, cell, index) => {
      const previous = route[index];
      const diagonal = previous.x !== cell.x && previous.z !== cell.z;
      return total + (diagonal ? Math.SQRT2 : 1);
    }, 0);
    const creditsPerTick = (
      GUEST_MOVE_SPEED_METERS_PER_SECOND * FIXED_DELTA_SECONDS / simulation.venue.grid.cellSize
    );
    const expectedArrivalTick = Math.ceil(pathCostCells / creditsPerTick - 1e-9);

    let arrivalTick = 0;
    while (arrivalTick <= expectedArrivalTick + 2) {
      simulation.tick();
      arrivalTick += 1;
      const phase = simulation.getState().guests.find((guest) => guest.id === guestId)?.phase;
      if (phase !== 'walking_to_bar') break;
    }

    expect(arrivalTick).toBe(expectedArrivalTick);
    expect(arrivalTick * FIXED_DELTA_SECONDS).toBeCloseTo(
      pathCostCells * simulation.venue.grid.cellSize / GUEST_MOVE_SPEED_METERS_PER_SECOND,
      1,
    );
    expect(arrivalTick * FIXED_DELTA_SECONDS).toBeGreaterThan(2);
    expect(arrivalTick * FIXED_DELTA_SECONDS).toBeLessThan(15);
  });

  it('supports pause, 1/2/3 speed, reset and clone-safe snapshots', () => {
    const simulation = new AmberClubSimulation({ seed: 41, autoSpawn: false });
    simulation.start();
    simulation.setPaused(true);
    simulation.advanceTicks(10);
    expect(simulation.getState().tick).toBe(0);
    simulation.setPaused(false);
    simulation.setSpeed(3);
    simulation.tick();
    expect(simulation.getState().tick).toBe(3);

    const snapshot = simulation.getState();
    (snapshot as { balance: number }).balance = -999;
    expect(simulation.getState().balance).toBe(600);

    simulation.reset(99);
    expect(simulation.getState()).toMatchObject({
      started: false,
      paused: false,
      speed: 1,
      tick: 0,
      balance: 600,
      guests: [],
    });
    simulation.tick();
    expect(simulation.getState().tick).toBe(0);
  });

  it('posts integer-only ledger entries and hires data-driven room staff on unlock', () => {
    const ledger = new Ledger(100);
    expect(() => ledger.post({ tick: 1, kind: 'bar_revenue', amount: 1.5, sourceId: 'bad' })).toThrow();
    expect(() => ledger.post({ tick: 1, kind: 'room_unlock', amount: -101, sourceId: 'overdraft' })).toThrow();

    const simulation = new AmberClubSimulation({
      seed: 5,
      autoSpawn: false,
      initialBalance: 2_000,
      unlockedRooms: ['karaoke'],
    });
    expect(simulation.unlockRoom('sauna')).toBe(true);
    const state = simulation.getState();
    expect(state.balance).toBe(2_000 - getRoomBlueprint('sauna').unlockCost);
    expect(state.staff).toContainEqual(expect.objectContaining({
      role: getRoomBlueprint('sauna').staff.role,
      roomId: 'sauna',
    }));
    expect(state.ledger.every((entry) => Number.isInteger(entry.amount) && Number.isInteger(entry.balanceAfter))).toBe(true);
  });
});
