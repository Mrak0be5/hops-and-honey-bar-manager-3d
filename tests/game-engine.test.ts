import { describe, expect, it } from 'vitest';
import { BAR_STATION, ENTRANCE, ENTRY_AISLE, SERVICE_GATE, GUEST_CHAIR_OFFSET, INITIAL_UPGRADES, ROOM_DEFINITIONS, ROOM_LAYOUTS, TABLE_LAYOUT, TABLE_RADIUS } from '../src/game/config';
import { GameEngine } from '../src/game/GameEngine';
import { findGridPath, isInsideWalkableZone, isWalkable, makeLevelObstacles, NAV_CELL_SIZE } from '../src/game/navigation';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const makeEngine = (storage: Storage | null = null) => new GameEngine({ rng: () => 0.5, storage });
const makeFundedEngine = (coins = 5_000, upgrades = INITIAL_UPGRADES) => {
  const storage = new MemoryStorage();
  storage.setItem('hops-and-honey-save-v1', JSON.stringify({
    coins,
    reputation: 3,
    served: 0,
    day: 1,
    upgrades,
    soundEnabled: true,
  }));
  return { engine: makeEngine(storage), storage };
};

describe('GameEngine', () => {
  it('runs the complete autonomous service loop and earns money', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(100);

    const state = engine.getSnapshot();
    expect(state.served).toBeGreaterThan(0);
    expect(state.coins).toBeGreaterThan(64);
    expect(state.patrons.length).toBeLessThanOrEqual(6);
    expect(state.tables.filter((table) => table.occupantId).length).toBeLessThanOrEqual(6);
  });

  it('buys and persists upgrades without saving transient renderer state', () => {
    const storage = new MemoryStorage();
    const first = makeEngine(storage);

    expect(first.purchaseUpgrade('moveSpeed')).toBe(true);
    expect(first.getSnapshot().upgrades.moveSpeed).toBe(2);
    expect(first.getSnapshot().coins).toBe(26);

    const restored = makeEngine(storage);
    expect(restored.getSnapshot().upgrades.moveSpeed).toBe(2);
    expect(restored.getSnapshot().coins).toBe(26);
    expect(restored.getSnapshot().patrons).toEqual([]);
    expect(restored.getSnapshot().bartender.state).toBe('idle');
  });

  it('freezes simulation time and actors while paused', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(4);
    engine.setPaused(true);
    const before = engine.getSnapshot();

    engine.advance(20);
    const after = engine.getSnapshot();
    expect(after.shiftProgress).toBe(before.shiftProgress);
    expect(after.patrons).toEqual(before.patrons);
  });

  it('unlocks a new day and awards the shift bonus', () => {
    const engine = makeEngine();
    engine.start();
    engine.advance(151);

    const state = engine.getSnapshot();
    expect(state.day).toBe(2);
    expect(state.lastEvent).not.toBeNull();
    expect(state.served).toBeGreaterThan(1);
  });

  it('keeps seated guests clear of the tabletop and facing their table', () => {
    for (const table of TABLE_LAYOUT) {
      const seatDistance = Math.hypot(table.seat.x - table.position.x, table.seat.z - table.position.z);
      const serviceDistance = Math.hypot(table.service.x - table.position.x, table.service.z - table.position.z);
      expect(seatDistance).toBeCloseTo(GUEST_CHAIR_OFFSET, 4);
      expect(seatDistance).toBeGreaterThan(TABLE_RADIUS + 0.2);
      expect(serviceDistance).toBeGreaterThan(TABLE_RADIUS + 0.35);
    }

    const engine = makeEngine();
    engine.start();
    engine.advance(14);
    const snapshot = engine.getSnapshot();
    const seatedPatron = snapshot.patrons.find((patron) => patron.state !== 'walking_in' && patron.state !== 'leaving');
    expect(seatedPatron).toBeDefined();
    const table = snapshot.tables[seatedPatron!.tableId];
    expect(seatedPatron!.target).toEqual(table.position);
  });

  it('finds obstacle-safe grid routes from the entrance to every seat', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    for (const table of TABLE_LAYOUT) {
      const route = findGridPath(ENTRANCE, table.seat, obstacles);
      expect(route.length, `table ${table.id} has no route`).toBeGreaterThan(0);
      for (const point of route.slice(0, -1)) {
        expect(isWalkable(point, obstacles), `table ${table.id} route clips at ${point.x},${point.z}`).toBe(true);
      }
      for (let index = 1; index < route.length; index += 1) {
        const dx = Math.abs(route[index].x - route[index - 1].x);
        const dz = Math.abs(route[index].z - route[index - 1].z);
        expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(NAV_CELL_SIZE * Math.SQRT2 + 0.06);
      }
    }
  });

  it('routes the bartender only through the open end of the counter', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    const toGate = findGridPath(BAR_STATION, SERVICE_GATE, obstacles);
    expect(toGate.length).toBeGreaterThan(0);
    for (const point of toGate.slice(0, -1)) expect(isWalkable(point, obstacles)).toBe(true);

    for (const table of TABLE_LAYOUT) {
      const route = findGridPath(SERVICE_GATE, table.service, obstacles);
      expect(route.length, `bar to table ${table.id} has no route`).toBeGreaterThan(0);
      for (const point of route) expect(isWalkable(point, obstacles, 0.26, [table.service])).toBe(true);
    }
  });

  it('connects every room to the bar through its doorway without crossing exterior void', () => {
    const obstacles = makeLevelObstacles(TABLE_LAYOUT.map((table) => table.position));
    expect(isInsideWalkableZone({ x: 0, z: 8 })).toBe(false);
    expect(isWalkable({ x: 0, z: 8 }, obstacles)).toBe(false);

    for (const definition of ROOM_DEFINITIONS) {
      const layout = ROOM_LAYOUTS[definition.id];
      for (const guestSpot of layout.guestSpots) {
        expect(isWalkable(guestSpot, obstacles), `${definition.id} guest spot overlaps furniture`).toBe(true);
        let cursor = TABLE_LAYOUT[0].seat;
        for (const stop of [layout.barPortal, layout.roomPortal, guestSpot]) {
          const route = findGridPath(cursor, stop, obstacles);
          expect(route.length, `${definition.id} cannot reach ${stop.x},${stop.z}`).toBeGreaterThan(0);
          for (const point of route) {
            expect(
              isWalkable(point, obstacles),
              `${definition.id} route clips at ${point.x},${point.z}`,
            ).toBe(true);
          }
          cursor = stop;
        }

        cursor = guestSpot;
        for (const stop of [layout.roomPortal, layout.barPortal, ENTRY_AISLE, ENTRANCE]) {
          const route = findGridPath(cursor, stop, obstacles);
          expect(route.length, `${definition.id} cannot exit through ${stop.x},${stop.z}`).toBeGreaterThan(0);
          for (const point of route) expect(isWalkable(point, obstacles)).toBe(true);
          cursor = stop;
        }
      }
    }
  });

  it('keeps optional rooms locked and inactive until they are repaired', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().rooms).toHaveLength(3);
    expect(engine.getSnapshot().rooms.every((room) => !room.unlocked && room.staffState === 'locked')).toBe(true);

    engine.start();
    engine.advance(100);
    expect(engine.getSnapshot().roomRevenue).toBe(0);
  });

  it('charges the repair price and sends only served bar guests into a room', () => {
    const { engine } = makeFundedEngine();
    const karaoke = ROOM_DEFINITIONS.find((room) => room.id === 'karaoke')!;

    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoom('karaoke')).toBe(false);
    expect(engine.getSnapshot().coins).toBe(5_000 - karaoke.unlockCost);
    expect(engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')?.staffState).toBe('waiting');

    engine.start();
    let sawWalkToRoom = false;
    let sawWaitingRoom = false;
    let sawInRoom = false;
    for (let tick = 0; tick < 720; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      expect(assigned.length).toBeLessThanOrEqual(snapshot.rooms.find((room) => room.id === 'karaoke')!.capacity);
      expect(assigned.every((patron) => patron.order !== null && patron.barServed)).toBe(true);
      sawWalkToRoom ||= assigned.some((patron) => patron.state === 'walking_to_room');
      sawWaitingRoom ||= assigned.some((patron) => patron.state === 'waiting_room');
      sawInRoom ||= assigned.some((patron) => patron.state === 'in_room');
      const activeGuests = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke' && patron.state === 'in_room').length;
      expect(snapshot.rooms.find((room) => room.id === 'karaoke')!.guests).toBe(activeGuests);
      if (snapshot.rooms.find((room) => room.id === 'karaoke')!.completedSessions > 0) break;
    }
    const room = engine.getSnapshot().rooms.find((item) => item.id === 'karaoke')!;
    expect(sawWalkToRoom).toBe(true);
    expect(sawWaitingRoom).toBe(true);
    expect(sawInRoom).toBe(true);
    expect(engine.getSnapshot().served).toBeGreaterThan(0);
    expect(room.completedSessions).toBeGreaterThanOrEqual(1);
    expect(room.revenue).toBe(room.completedSessions * karaoke.baseProfit);
    expect(engine.getSnapshot().roomRevenue).toBe(room.revenue);
  });

  it('waits for every reserved room guest before starting a larger session', () => {
    const fastUpgrades = {
      ...INITIAL_UPGRADES,
      moveSpeed: 10,
      orderSpeed: 10,
      prepSpeed: 10,
      cleanSpeed: 10,
      advertising: 8,
    };
    const { engine } = makeFundedEngine(5_000, fastUpgrades);
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    engine.start();

    let sawApproachingReservation = false;
    let verifiedServingBatch = false;
    for (let tick = 0; tick < 1_200; tick += 1) {
      engine.advance(0.25);
      const snapshot = engine.getSnapshot();
      const room = snapshot.rooms.find((item) => item.id === 'karaoke')!;
      const assigned = snapshot.patrons.filter((patron) => patron.roomId === 'karaoke'
        && (patron.state === 'walking_to_room' || patron.state === 'waiting_room' || patron.state === 'in_room'));
      if (room.staffState === 'welcoming' && assigned.some((patron) => patron.state === 'walking_to_room')) {
        sawApproachingReservation = true;
      }
      if (room.staffState === 'serving') {
        expect(assigned.some((patron) => patron.state === 'walking_to_room' || patron.state === 'waiting_room')).toBe(false);
        expect(assigned.every((patron) => patron.barServed)).toBe(true);
        expect(assigned.filter((patron) => patron.state === 'in_room')).toHaveLength(room.guests);
        if (sawApproachingReservation) {
          verifiedServingBatch = true;
          break;
        }
      }
    }
    expect(sawApproachingReservation).toBe(true);
    expect(verifiedServingBatch).toBe(true);
  });

  it('keeps room upgrades independent and restores them with room revenue', () => {
    const { engine, storage } = makeFundedEngine();
    expect(engine.purchaseRoomUpgrade('sauna', 'quality')).toBe(false);
    expect(engine.purchaseRoom('karaoke')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'staffSpeed')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'capacity')).toBe(true);
    expect(engine.purchaseRoomUpgrade('karaoke', 'quality')).toBe(true);

    engine.start();
    for (let tick = 0; tick < 720 && engine.getSnapshot().rooms.find((room) => room.id === 'karaoke')!.completedSessions === 0; tick += 1) {
      engine.advance(0.25);
    }
    const restored = makeEngine(storage).getSnapshot();
    const karaoke = restored.rooms.find((room) => room.id === 'karaoke')!;
    const sauna = restored.rooms.find((room) => room.id === 'sauna')!;
    expect(karaoke.unlocked).toBe(true);
    expect(karaoke.upgrades).toEqual({ staffSpeed: 2, capacity: 2, quality: 2 });
    expect(karaoke.capacity).toBe(2);
    expect(karaoke.completedSessions).toBeGreaterThanOrEqual(1);
    expect(karaoke.revenue).toBeGreaterThan(0);
    expect(sauna.unlocked).toBe(false);
    expect(sauna.upgrades).toEqual({ staffSpeed: 1, capacity: 1, quality: 1 });
  });

  it('prices higher-profit rooms above lower-profit rooms', () => {
    for (let index = 1; index < ROOM_DEFINITIONS.length; index += 1) {
      expect(ROOM_DEFINITIONS[index].baseProfit).toBeGreaterThan(ROOM_DEFINITIONS[index - 1].baseProfit);
      expect(ROOM_DEFINITIONS[index].unlockCost).toBeGreaterThan(ROOM_DEFINITIONS[index - 1].unlockCost);
    }
  });
});
