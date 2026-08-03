import { describe, expect, it } from 'vitest';
import type { SimulationSnapshot } from '../../src/v2/simulation/types';
import { mapSimulationToView } from '../../src/v2/runtime/mapSimulationToView';

const snapshot = (overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot => ({
  started: true,
  paused: false,
  speed: 1,
  tick: 25,
  fixedDeltaSeconds: 0.04,
  simulationTimeSeconds: 1,
  balance: 340,
  servedGuests: 0,
  guests: [],
  staff: [],
  rooms: [
    { id: 'karaoke', unlocked: true, lifecycle: 'open', renovationStage: 3, capacity: 1, staff: { hired: true, role: 'karaoke_host', level: 1, salaryPerShift: 22 }, upgrades: { staffSpeed: 1, capacity: 1, quality: 1 }, reservedGuestIds: [], activeGuestIds: [], completedSessions: 0, revenue: 0 },
    { id: 'sauna', unlocked: false, lifecycle: 'locked', renovationStage: 0, capacity: 1, staff: { hired: false, role: 'sauna_attendant', level: 1, salaryPerShift: 38 }, upgrades: { staffSpeed: 1, capacity: 1, quality: 1 }, reservedGuestIds: [], activeGuestIds: [], completedSessions: 0, revenue: 0 },
    { id: 'massage', unlocked: false, lifecycle: 'locked', renovationStage: 0, capacity: 1, staff: { hired: false, role: 'massage_therapist', level: 1, salaryPerShift: 58 }, upgrades: { staffSpeed: 1, capacity: 1, quality: 1 }, reservedGuestIds: [], activeGuestIds: [], completedSessions: 0, revenue: 0 },
  ],
  queuedTasks: [],
  ledger: [],
  events: [],
  ...overrides,
});

describe('mapSimulationToView', () => {
  it('maps authoritative grid cells to world-space visual characters', () => {
    const view = mapSimulationToView(snapshot({
      guests: [{
        id: 'guest-1',
        phase: 'walking_to_bar',
        cell: { x: 42, z: 47 },
        route: [{ x: 41, z: 46 }],
        targetSlotId: 'bar-guest-1',
        seatSlotId: null,
        roomSlotId: null,
        ticksRemaining: 0,
        barVisit: { completed: false, paidAtTick: null },
        roomVisit: null,
      }],
    }));

    expect(view.characters).toHaveLength(1);
    expect(view.characters[0]).toMatchObject({ id: 'guest-1', role: 'patron', activity: 'walk', roomId: 'bar' });
    expect(view.characters[0].position).not.toEqual(view.characters[0].target);
  });

  it('uses room-specific activities only for guests already in that room', () => {
    const view = mapSimulationToView(snapshot({
      guests: [{
        id: 'guest-2',
        phase: 'in_room',
        cell: { x: 10, z: 30 },
        route: [],
        targetSlotId: null,
        seatSlotId: null,
        roomSlotId: 'karaoke-guest-1',
        ticksRemaining: 12,
        barVisit: { completed: true, paidAtTick: 10 },
        roomVisit: { roomId: 'karaoke', completed: false },
      }],
    }));

    expect(view.characters[0]).toMatchObject({ activity: 'karaoke', roomId: 'karaoke' });
  });

  it('exposes locked/open room state and affordability to the HUD', () => {
    const view = mapSimulationToView(snapshot());

    expect(view.rooms.find((room) => room.id === 'karaoke')).toMatchObject({ unlocked: true, status: 'open' });
    expect(view.rooms.find((room) => room.id === 'sauna')).toMatchObject({ unlocked: false, status: 'locked' });
    expect(view.rooms.find((room) => room.id === 'karaoke')?.upgrades[0].affordable).toBe(true);
  });

  it('keeps migrated prestige, served guests and day as projection bases', () => {
    const view = mapSimulationToView(snapshot(), {
      prestigeBase: 9,
      servedBase: 42,
      dayBase: 7,
      soundEnabled: false,
    });

    expect(view).toMatchObject({ prestige: 9, served: 42, day: 7, soundEnabled: false });
  });
});
